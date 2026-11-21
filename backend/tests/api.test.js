import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb, createUser, placeDriver, resetState, lapseOffer, PICKUP, DESTINATION, northKm } from './helpers/db.js';
import { createPgStore } from './helpers/pgStore.js';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/index.js';
import { AppError } from '../src/errors.js';

const config = loadConfig({});
const quiet = { error() {}, warn() {}, log() {} };
let db, store, server, base, dispatch, p1, p2, d1, d2, d3, routeMode;

// Fake auth: the bearer token IS the user id (stands in for Supabase JWT validation).
const verifyToken = async (token) => (token === 'bad' ? null : { id: token });
const routeService = {
  async getRoute() {
    if (routeMode === 'down') throw new AppError(502, 'ROUTING_UNAVAILABLE', 'Routing down');
    return { distanceKm: 8, durationMinutes: 20, source: 'test' };
  },
};

async function call(method, path, user, body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user.id ?? user}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}
const bookBody = (key = 'booking-key-0001') => ({ pickup: PICKUP, destination: DESTINATION, idempotencyKey: key });
const online = (d, km) => placeDriver(db, d.driverId, { lat: northKm(km), lng: PICKUP.longitude });

describe('HTTP API', () => {
  before(async () => {
    db = await createTestDb();
    store = createPgStore(db);
    const built = createApp({ config, store, routeService, verifyToken, logger: quiet });
    dispatch = built.dispatchService;
    server = built.app.listen(0);
    base = `http://127.0.0.1:${server.address().port}`;
    [p1, p2] = await Promise.all([createUser(db), createUser(db)]);
    [d1, d2, d3] = await Promise.all([1, 2, 3].map(() => createUser(db, { role: 'driver', vehicle: 'Swift' })));
  });
  after(() => server.close());
  beforeEach(async () => { routeMode = 'ok'; await resetState(db); });

  test('authentication is required and tokens are verified', async () => {
    assert.equal((await call('GET', '/api/me')).status, 401);
    assert.equal((await call('GET', '/api/me', 'bad')).status, 401);
    const me = await call('GET', '/api/me', p1);
    assert.equal(me.status, 200);
    assert.equal(me.body.user.role, 'passenger');
    assert.equal((await call('GET', '/api/me/profile', d1)).body.driver.is_verified, false);
  });

  test('role-based authorization', async () => {
    assert.equal((await call('POST', '/api/rides', d1, bookBody())).status, 403);
    assert.equal((await call('PATCH', '/api/drivers/availability', p1, { is_online: true })).status, 403);
    assert.equal((await call('GET', '/api/drivers/offers', p1)).status, 403);
    assert.equal((await call('POST', `/api/rides/${crypto.randomUUID()}/start`, p1)).status, 403);
  });

  test('fare estimate is computed server-side and ignores client-supplied numbers', async () => {
    const res = await call('POST', '/api/fares/estimate', p1, { ...bookBody(), distance_km: 1, estimated_fare: 1 });
    assert.equal(res.status, 200);
    assert.equal(res.body.estimated_fare, 176);
    assert.equal(res.body.distance_km, 8);
    assert.equal(res.body.breakdown.distance_charge, 96);
  });

  test('validation: invalid pickup/destination are rejected before booking', async () => {
    const bad = [
      { ...bookBody(), pickup: { address: 'x', latitude: 999, longitude: 0 } },
      { ...bookBody(), destination: { address: 'Somewhere', latitude: 'abc', longitude: 0 } },
      { ...bookBody(), idempotencyKey: 'short' },
      { destination: DESTINATION, idempotencyKey: 'booking-key-0001' },
    ];
    for (const b of bad) assert.equal((await call('POST', '/api/rides', p1, b)).status, 400);
    const same = await call('POST', '/api/rides', p1, { ...bookBody(), destination: PICKUP });
    assert.equal(same.status, 422);
    assert.equal(same.body.error.code, 'INVALID_LOCATION');
    assert.equal((await db.query('select count(*)::int c from public.rides')).rows[0].c, 0);
  });

  test('Google Maps failure => 502 and no ride is created', async () => {
    routeMode = 'down';
    const res = await call('POST', '/api/rides', p1, bookBody());
    assert.equal(res.status, 502);
    assert.equal(res.body.error.code, 'ROUTING_UNAVAILABLE');
    assert.equal((await db.query('select count(*)::int c from public.rides')).rows[0].c, 0);
  });

  test('no drivers online => ride is unmatched with a clear state, and retry works', async () => {
    const res = await call('POST', '/api/rides', p1, bookBody('booking-key-0001'));
    assert.equal(res.status, 201);
    assert.equal(res.body.ride.status, 'unmatched');
    await online(d1, 1);
    const retry = await call('POST', '/api/rides', p1, bookBody('booking-key-0002'));
    assert.equal(retry.body.ride.status, 'searching');
  });

  test('full happy path with correct contact-detail visibility at every step', async () => {
    await online(d1, 1);
    const created = await call('POST', '/api/rides', p1, bookBody());
    const rideId = created.body.ride.id;
    assert.equal(created.body.ride.status, 'searching');
    assert.equal(created.body.ride.estimated_fare, 176);
    assert.equal(created.body.ride.driver, undefined);                 // no driver info before a match

    const offers = (await call('GET', '/api/drivers/offers', d1)).body.offers;
    assert.equal(offers.length, 1);
    assert.equal(offers[0].estimated_fare, 176);
    assert.equal(offers[0].passenger, undefined);
    assert.ok(!JSON.stringify(offers).includes(p1.phone));             // no passenger phone in the offer
    assert.equal((await call('GET', '/api/drivers/offers', d2)).body.offers.length, 0);
    assert.equal((await call('POST', `/api/offers/${offers[0].id}/accept`, d2)).status, 404);

    const accepted = await call('POST', `/api/offers/${offers[0].id}/accept`, d1);
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.ride.passenger.phone, p1.phone);

    const pView = (await call('GET', `/api/rides/${rideId}`, p1)).body.ride;
    assert.equal(pView.status, 'accepted');
    assert.equal(pView.driver.phone, d1.phone);
    assert.equal(pView.driver.vehicle_model, 'Swift');
    assert.equal(pView.driver.is_verified, false);

    // unrelated users cannot see it (404, not even confirming it exists)
    assert.equal((await call('GET', `/api/rides/${rideId}`, p2)).status, 404);
    assert.equal((await call('GET', `/api/rides/${rideId}`, d2)).status, 404);
    assert.equal((await call('POST', `/api/rides/${rideId}/cancel`, p2)).status, 404);
    assert.equal((await call('POST', `/api/rides/${rideId}/start`, d2)).status, 404);

    assert.equal((await call('POST', `/api/rides/${rideId}/complete`, d1)).status, 409); // cannot skip start
    assert.equal((await call('POST', `/api/rides/${rideId}/cancel`, p1)).status, 200);
  });

  test('start and complete, then the driver is free again and phones are hidden', async () => {
    await online(d1, 1);
    const rideId = (await call('POST', '/api/rides', p1, bookBody())).body.ride.id;
    const [offer] = (await call('GET', '/api/drivers/offers', d1)).body.offers;
    await call('POST', `/api/offers/${offer.id}/accept`, d1);
    assert.equal((await call('POST', `/api/rides/${rideId}/start`, d1)).body.ride.status, 'in_progress');
    assert.equal((await call('POST', `/api/rides/${rideId}/cancel`, p1)).status, 409); // not once in progress
    assert.equal((await call('GET', '/api/me', d1)).body.active_ride_id, rideId);       // refresh recovery
    const done = await call('POST', `/api/rides/${rideId}/complete`, d1);
    assert.equal(done.body.ride.status, 'completed');
    assert.equal(done.body.ride.passenger.phone, null);
    assert.equal((await call('GET', `/api/rides/${rideId}`, p1)).body.ride.driver.phone, null);
    assert.equal((await call('POST', `/api/rides/${rideId}/start`, d1)).status, 409);   // never back to active
    assert.equal((await call('GET', '/api/me', d1)).body.active_ride_id, null);
    // passenger may book again
    assert.equal((await call('POST', '/api/rides', p1, bookBody('booking-key-0009'))).status, 201);
  });

  test('driver reject => next driver gets the offer; expiry via worker does the same', async () => {
    await online(d1, 1); await online(d2, 2); await online(d3, 3);
    await call('POST', '/api/rides', p1, bookBody());
    const [o1] = (await call('GET', '/api/drivers/offers', d1)).body.offers;
    assert.equal((await call('POST', `/api/offers/${o1.id}/reject`, d1)).status, 200);
    assert.equal((await call('GET', '/api/drivers/offers', d1)).body.offers.length, 0);
    const [o2] = (await call('GET', '/api/drivers/offers', d2)).body.offers;
    assert.ok(o2);
    await lapseOffer(db, o2.id);
    await dispatch.sweep();
    assert.equal((await call('POST', `/api/offers/${o2.id}/accept`, d2)).status, 409); // lapsed => no longer pending
    assert.equal((await call('GET', '/api/drivers/offers', d3)).body.offers.length, 1);
  });

  test('repeated clicks create exactly one ride (idempotency + one open ride)', async () => {
    await online(d1, 1);
    const results = await Promise.all([1, 2, 3, 4].map(() => call('POST', '/api/rides', p1, bookBody())));
    assert.ok(results.every((r) => [200, 201].includes(r.status)));
    assert.equal(new Set(results.map((r) => r.body.ride.id)).size, 1);
    const other = await call('POST', '/api/rides', p1, bookBody('different-key-001'));
    assert.equal(other.status, 409);
    assert.equal(other.body.error.code, 'ACTIVE_RIDE_EXISTS');
    assert.equal((await db.query('select count(*)::int c from public.rides')).rows[0].c, 1);
  });

  test('availability: going offline mid-offer hands the ride on; blocked during an active ride', async () => {
    await online(d1, 1); await online(d2, 2);
    await call('POST', '/api/rides', p1, bookBody());
    assert.equal((await call('GET', '/api/drivers/offers', d1)).body.offers.length, 1);
    const off = await call('PATCH', '/api/drivers/availability', d1, { is_online: false });
    assert.equal(off.body.driver.is_online, false);
    assert.equal((await call('GET', '/api/drivers/offers', d1)).body.offers.length, 0);
    const [offer] = (await call('GET', '/api/drivers/offers', d2)).body.offers;
    assert.ok(offer);
    await call('POST', `/api/offers/${offer.id}/accept`, d2);
    assert.equal((await call('PATCH', '/api/drivers/availability', d2, { is_online: false })).status, 409);
  });

  test('driver location: validated, requires online, and freshness is reported', async () => {
    assert.equal((await call('POST', '/api/drivers/location', d1, { latitude: 12.9, longitude: 77.6 })).status, 409);
    await call('PATCH', '/api/drivers/availability', d1, { is_online: true });
    assert.equal((await call('POST', '/api/drivers/location', d1, { latitude: 95, longitude: 77.6 })).status, 400);
    const ok = await call('POST', '/api/drivers/location', d1, { latitude: 12.9, longitude: 77.6 });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.driver.location_is_fresh, true);
  });

  test('database failure => 503 with a friendly message', async () => {
    const failing = createApp({
      config, routeService, verifyToken, logger: quiet,
      store: { ...store, getProfile: async () => { throw new Error('connection refused'); } },
    });
    const s = failing.app.listen(0);
    const res = await fetch(`http://127.0.0.1:${s.address().port}/api/me`, { headers: { Authorization: `Bearer ${p1.id}` } });
    s.close();
    assert.equal(res.status, 503);
    assert.equal((await res.json()).error.code, 'DATABASE_UNAVAILABLE');
  });

  test('malformed ids and bodies get 400, unknown routes 404', async () => {
    assert.equal((await call('GET', '/api/rides/not-a-uuid', p1)).status, 400);
    assert.equal((await call('GET', '/api/nope', p1)).status, 404);
    const res = await fetch(`${base}/api/rides`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p1.id}` }, body: '{bad' });
    assert.equal(res.status, 400);
  });
});

