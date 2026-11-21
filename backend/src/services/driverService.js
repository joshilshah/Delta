import { AppError } from '../errors.js';

export function createDriverService({ store, dispatchService, staleSeconds }) {
  const publicDriver = (d, activeRideId = null) => ({
    id: d.id,
    vehicle_model: d.vehicle_model,
    vehicle_registration: d.vehicle_registration,
    is_online: d.is_online,
    is_verified: Boolean(d.is_verified), // always false in Phase 1
    location: d.location ?? null,
    location_is_fresh: d.location
      ? Date.now() - new Date(d.location.updated_at).getTime() < staleSeconds * 1000
      : false,
    active_ride_id: activeRideId,
  });

  return {
    publicDriver,

    async getState(driver) {
      const fresh = await store.getDriverByProfileId(driver.profile_id);
      const active = await store.getActiveRideForDriver(driver.id);
      return publicDriver(fresh, active?.id ?? null);
    },

    async setAvailability(driver, isOnline) {
      const result = await store.setDriverOnline(driver.id, isOnline);
      // Offers withdrawn because the driver went offline: move those rides on immediately.
      for (const rideId of result.affected_ride_ids ?? []) await dispatchService.safeDispatch(rideId);
      return this.getState(driver);
    },

    async updateLocation(driver, { latitude, longitude }) {
      const current = await store.getDriverById(driver.id);
      if (!current?.is_online) {
        throw new AppError(409, 'DRIVER_OFFLINE', 'Go online before sharing your location.');
      }
      await store.upsertDriverLocation(driver.id, latitude, longitude);
      return this.getState(driver);
    },
  };
}
