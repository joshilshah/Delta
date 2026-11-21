import { createClient } from '@supabase/supabase-js';
import { AppError, mapDbError } from '../errors.js';

/**
 * Data-access layer over Supabase (PostgREST + RPC) using the SECRET key.
 * The secret key bypasses RLS, so this module must only ever run on the server, and
 * authorization decisions are made by the services that call it.
 *
 * Every dispatch-critical mutation is a single RPC to a SQL function (see
 * supabase/migrations/..._dispatch_functions.sql) so it runs in one transaction.
 */
export function createSupabaseClients({ url, publishableKey, secretKey }) {
  const opts = { auth: { persistSession: false, autoRefreshToken: false } };
  return {
    // Used only to validate user access tokens.
    authClient: createClient(url, publishableKey, opts),
    adminClient: createClient(url, secretKey, opts),
  };
}

const ACTIVE = ['accepted', 'in_progress'];
const OPEN = ['requested', 'searching', 'accepted', 'in_progress'];

export function createSupabaseStore(db) {
  const check = ({ data, error }) => {
    if (error) throw mapDbError(error);
    return data;
  };
  const rpc = async (fn, args) => check(await db.rpc(fn, args));

  return {
    async ping() {
      check(await db.from('profiles').select('id').limit(1));
      return true;
    },

    async getProfile(userId) {
      return check(await db.from('profiles').select('*').eq('id', userId).maybeSingle());
    },

    async getDriverByProfileId(profileId) {
      const driver = check(await db.from('drivers').select('*').eq('profile_id', profileId).maybeSingle());
      if (!driver) return null;
      const location = check(await db.from('driver_locations').select('latitude, longitude, updated_at')
        .eq('driver_id', driver.id).maybeSingle());
      return { ...driver, location };
    },

    async getDriverById(driverId) {
      return check(await db.from('drivers').select('*').eq('id', driverId).maybeSingle());
    },

    setDriverOnline: (driverId, online) => rpc('set_driver_online', { p_driver_id: driverId, p_online: online }),

    async upsertDriverLocation(driverId, latitude, longitude) {
      return check(await db.from('driver_locations')
        .upsert({ driver_id: driverId, latitude, longitude, updated_at: new Date().toISOString() })
        .select('latitude, longitude, updated_at').single());
    },

    async getRide(id) {
      return check(await db.from('rides').select('*').eq('id', id).maybeSingle());
    },

    async getRideByRequestKey(passengerId, key) {
      return check(await db.from('rides').select('*').eq('passenger_id', passengerId)
        .eq('request_key', key).maybeSingle());
    },

    async getOpenRideForPassenger(passengerId) {
      return check(await db.from('rides').select('*').eq('passenger_id', passengerId)
        .in('status', OPEN).maybeSingle());
    },

    async getActiveRideForDriver(driverId) {
      return check(await db.from('rides').select('*').eq('driver_id', driverId)
        .in('status', ACTIVE).maybeSingle());
    },

    /** Returns { ride, duplicate }. Throws ACTIVE_RIDE_EXISTS if the passenger already has an open ride. */
    async insertRide(row) {
      const { data, error } = await db.from('rides').insert(row).select('*').single();
      if (!error) return { ride: data, duplicate: false };
      if (error.code === '23505') {
        const same = await this.getRideByRequestKey(row.passenger_id, row.request_key);
        if (same) return { ride: same, duplicate: true };
        const open = await this.getOpenRideForPassenger(row.passenger_id);
        throw new AppError(409, 'ACTIVE_RIDE_EXISTS', 'You already have an active ride.', { ride_id: open?.id });
      }
      throw mapDbError(error);
    },

    async listOfferedDriverIds(rideId) {
      const rows = check(await db.from('ride_offers').select('driver_id').eq('ride_id', rideId));
      return rows.map((r) => r.driver_id);
    },

    async countOffersForRide(rideId) {
      const { count, error } = await db.from('ride_offers').select('id', { count: 'exact', head: true })
        .eq('ride_id', rideId);
      if (error) throw mapDbError(error);
      return count ?? 0;
    },

    async getLivePendingOffer(rideId) {
      return check(await db.from('ride_offers').select('*').eq('ride_id', rideId)
        .eq('status', 'pending').gt('expires_at', new Date().toISOString()).maybeSingle());
    },

    findEligibleDrivers: ({ lat, lng, radiusKm, staleSeconds, excludeDriverIds = [] }) =>
      rpc('find_eligible_drivers', {
        p_lat: lat, p_lng: lng, p_radius_km: radiusKm,
        p_stale_seconds: staleSeconds, p_exclude: excludeDriverIds,
      }),

    createOffer: ({ rideId, driverId, ttlSeconds }) =>
      rpc('create_offer', { p_ride_id: rideId, p_driver_id: driverId, p_ttl_seconds: ttlSeconds }),

    async listPendingOffersForDriver(driverId) {
      const rows = check(await db.from('ride_offers')
        .select('id, ride_id, status, offered_at, expires_at, rides(pickup_address, destination_address, distance_km, duration_minutes, estimated_fare, fare_breakdown)')
        .eq('driver_id', driverId).eq('status', 'pending')
        .gt('expires_at', new Date().toISOString()).order('offered_at', { ascending: false }));
      return rows.map(({ rides, ...offer }) => ({ ...offer, ride: rides }));
    },

    async getOffer(offerId) {
      return check(await db.from('ride_offers').select('*').eq('id', offerId).maybeSingle());
    },

    acceptOffer: (offerId, driverId) => rpc('accept_offer', { p_offer_id: offerId, p_driver_id: driverId }),
    rejectOffer: (offerId, driverId) => rpc('reject_offer', { p_offer_id: offerId, p_driver_id: driverId }),
    expireStaleOffers: () => rpc('expire_stale_offers', {}),
    markUnmatched: (rideId) => rpc('mark_ride_unmatched', { p_ride_id: rideId }),
    startRide: (rideId, driverId) => rpc('start_ride', { p_ride_id: rideId, p_driver_id: driverId }),
    completeRide: (rideId, driverId) => rpc('complete_ride', { p_ride_id: rideId, p_driver_id: driverId }),
    cancelRide: (rideId, role, actorId) =>
      rpc('cancel_ride', { p_ride_id: rideId, p_actor_role: role, p_actor_id: actorId }),

    /** Rides still waiting for dispatch with no live offer (e.g. server restarted mid-dispatch). */
    async listStalledRideIds(olderThanSeconds) {
      const cutoff = new Date(Date.now() - olderThanSeconds * 1000).toISOString();
      const rides = check(await db.from('rides').select('id').in('status', ['requested', 'searching'])
        .lt('updated_at', cutoff).limit(50));
      if (!rides.length) return [];
      const ids = rides.map((r) => r.id);
      const live = check(await db.from('ride_offers').select('ride_id').in('ride_id', ids)
        .eq('status', 'pending').gt('expires_at', new Date().toISOString()));
      const busy = new Set(live.map((o) => o.ride_id));
      return ids.filter((id) => !busy.has(id));
    },

    /** Contact details are read here, server-side, and only released by the service after authorization. */
    async getRideParties(ride) {
      const passenger = check(await db.from('profiles').select('full_name, phone').eq('id', ride.passenger_id).maybeSingle());
      let driver = null;
      if (ride.driver_id) {
        const d = check(await db.from('drivers').select('id, profile_id, vehicle_model, vehicle_registration, is_verified')
          .eq('id', ride.driver_id).maybeSingle());
        if (d) {
          const p = check(await db.from('profiles').select('full_name, phone').eq('id', d.profile_id).maybeSingle());
          driver = { ...d, full_name: p?.full_name, phone: p?.phone };
        }
      }
      return { passenger, driver };
    },
  };
}
