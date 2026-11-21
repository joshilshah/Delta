// Store implementation over a real Postgres connection (PGlite), calling the SAME SQL functions
// the production Supabase store calls via RPC. This lets service and API tests exercise the real
// dispatch SQL instead of a hand-written fake.
import { AppError, mapDbError } from '../../src/errors.js';

export function createPgStore(db) {
  const q = async (sql, params = []) => {
    try { return (await db.query(sql, params)).rows; } catch (err) { throw err.code === '23505' ? err : mapDbError(err); }
  };
  const one = async (sql, params) => (await q(sql, params))[0] ?? null;
  const fn = async (call, params) => (await one(`select ${call} as r`, params)).r;

  const store = {
    ping: async () => { await q('select 1'); return true; },
    getProfile: (id) => one('select * from public.profiles where id = $1', [id]),
    async getDriverByProfileId(profileId) {
      const d = await one('select * from public.drivers where profile_id = $1', [profileId]);
      if (!d) return null;
      const location = await one('select latitude, longitude, updated_at from public.driver_locations where driver_id = $1', [d.id]);
      return { ...d, location };
    },
    getDriverById: (id) => one('select * from public.drivers where id = $1', [id]),
    setDriverOnline: (id, online) => fn('public.set_driver_online($1, $2)', [id, online]),
    upsertDriverLocation: (id, lat, lng) => one(
      `insert into public.driver_locations (driver_id, latitude, longitude, updated_at) values ($1,$2,$3,now())
       on conflict (driver_id) do update set latitude=excluded.latitude, longitude=excluded.longitude, updated_at=now()
       returning latitude, longitude, updated_at`, [id, lat, lng]),
    getRide: (id) => one('select * from public.rides where id = $1', [id]),
    getRideByRequestKey: (pid, key) => one('select * from public.rides where passenger_id=$1 and request_key=$2', [pid, key]),
    getOpenRideForPassenger: (pid) => one(
      `select * from public.rides where passenger_id=$1 and status in ('requested','searching','accepted','in_progress')`, [pid]),
    getActiveRideForDriver: (did) => one(
      `select * from public.rides where driver_id=$1 and status in ('accepted','in_progress')`, [did]),
    async insertRide(r) {
      try {
        const ride = await one(
          `insert into public.rides (passenger_id, request_key, pickup_address, pickup_latitude, pickup_longitude,
             destination_address, destination_latitude, destination_longitude, distance_km, duration_minutes,
             estimated_fare, fare_breakdown)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb) returning *`,
          [r.passenger_id, r.request_key, r.pickup_address, r.pickup_latitude, r.pickup_longitude,
            r.destination_address, r.destination_latitude, r.destination_longitude, r.distance_km,
            r.duration_minutes, r.estimated_fare, JSON.stringify(r.fare_breakdown)]);
        return { ride, duplicate: false };
      } catch (err) {
        if (err.code !== '23505') throw err;
        const same = await store.getRideByRequestKey(r.passenger_id, r.request_key);
        if (same) return { ride: same, duplicate: true };
        const open = await store.getOpenRideForPassenger(r.passenger_id);
        throw new AppError(409, 'ACTIVE_RIDE_EXISTS', 'You already have an active ride.', { ride_id: open?.id });
      }
    },
    listOfferedDriverIds: async (rid) => (await q('select driver_id from public.ride_offers where ride_id=$1', [rid])).map((r) => r.driver_id),
    countOffersForRide: async (rid) => Number((await one('select count(*) c from public.ride_offers where ride_id=$1', [rid])).c),
    getLivePendingOffer: (rid) => one(`select * from public.ride_offers where ride_id=$1 and status='pending' and expires_at > now()`, [rid]),
    findEligibleDrivers: ({ lat, lng, radiusKm, staleSeconds, excludeDriverIds = [] }) =>
      q('select * from public.find_eligible_drivers($1,$2,$3,$4,$5::uuid[])', [lat, lng, radiusKm, staleSeconds, excludeDriverIds]),
    createOffer: ({ rideId, driverId, ttlSeconds }) => fn('public.create_offer($1,$2,$3)', [rideId, driverId, ttlSeconds]),
    async listPendingOffersForDriver(did) {
      const rows = await q(
        `select o.id, o.ride_id, o.status, o.offered_at, o.expires_at, r.pickup_address, r.destination_address,
                r.distance_km, r.duration_minutes, r.estimated_fare, r.fare_breakdown
           from public.ride_offers o join public.rides r on r.id = o.ride_id
          where o.driver_id=$1 and o.status='pending' and o.expires_at > now() order by o.offered_at desc`, [did]);
      return rows.map(({ pickup_address, destination_address, distance_km, duration_minutes, estimated_fare, fare_breakdown, ...o }) =>
        ({ ...o, ride: { pickup_address, destination_address, distance_km, duration_minutes, estimated_fare, fare_breakdown } }));
    },
    getOffer: (id) => one('select * from public.ride_offers where id=$1', [id]),
    acceptOffer: (oid, did) => fn('public.accept_offer($1,$2)', [oid, did]),
    rejectOffer: (oid, did) => fn('public.reject_offer($1,$2)', [oid, did]),
    expireStaleOffers: () => q('select * from public.expire_stale_offers()'),
    markUnmatched: (rid) => fn('public.mark_ride_unmatched($1)', [rid]),
    startRide: (rid, did) => fn('public.start_ride($1,$2)', [rid, did]),
    completeRide: (rid, did) => fn('public.complete_ride($1,$2)', [rid, did]),
    cancelRide: (rid, role, actor) => fn('public.cancel_ride($1,$2,$3)', [rid, role, actor]),
    async listStalledRideIds(olderThanSeconds) {
      const rows = await q(
        `select r.id from public.rides r
          where r.status in ('requested','searching') and r.updated_at < now() - make_interval(secs => $1)
            and not exists (select 1 from public.ride_offers o where o.ride_id=r.id and o.status='pending' and o.expires_at > now())`,
        [olderThanSeconds]);
      return rows.map((r) => r.id);
    },
    async getRideParties(ride) {
      const passenger = await one('select full_name, phone from public.profiles where id=$1', [ride.passenger_id]);
      let driver = null;
      if (ride.driver_id) {
        driver = await one(
          `select d.id, d.profile_id, d.vehicle_model, d.vehicle_registration, d.is_verified, p.full_name, p.phone
             from public.drivers d join public.profiles p on p.id = d.profile_id where d.id=$1`, [ride.driver_id]);
      }
      return { passenger, driver };
    },
  };
  return store;
}
