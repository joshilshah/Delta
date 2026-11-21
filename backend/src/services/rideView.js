import { allowedActions } from './rideStateMachine.js';

const CONTACT_STATUSES = ['accepted', 'in_progress'];          // phone numbers visible
const IDENTITY_STATUSES = ['accepted', 'in_progress', 'completed']; // names/vehicle visible

/**
 * Serialise a ride for ONE viewer. This is the only place contact details are released:
 *  - passengers see the driver only after a confirmed match (phone only while the ride is active)
 *  - drivers see the passenger only after accepting (phone only while the ride is active)
 */
export function buildRideView({ ride, parties, viewerRole, matching }) {
  const view = {
    id: ride.id,
    status: ride.status,
    pickup: { address: ride.pickup_address, latitude: ride.pickup_latitude, longitude: ride.pickup_longitude },
    destination: {
      address: ride.destination_address,
      latitude: ride.destination_latitude,
      longitude: ride.destination_longitude,
    },
    distance_km: Number(ride.distance_km),
    duration_minutes: Number(ride.duration_minutes),
    estimated_fare: Number(ride.estimated_fare),
    fare_breakdown: ride.fare_breakdown ?? null,
    currency: 'INR',
    cancelled_by: ride.cancelled_by ?? null,
    created_at: ride.created_at,
    accepted_at: ride.accepted_at,
    started_at: ride.started_at,
    completed_at: ride.completed_at,
    cancelled_at: ride.cancelled_at,
    viewer_role: viewerRole,
    allowed_actions: allowedActions(viewerRole, ride.status),
  };

  if (viewerRole === 'passenger') {
    if (parties?.driver && IDENTITY_STATUSES.includes(ride.status)) {
      view.driver = {
        name: parties.driver.full_name,
        vehicle_model: parties.driver.vehicle_model,
        vehicle_registration: parties.driver.vehicle_registration,
        is_verified: Boolean(parties.driver.is_verified), // always false in Phase 1 (demo driver)
        phone: CONTACT_STATUSES.includes(ride.status) ? parties.driver.phone : null,
      };
    }
    if (matching && ['requested', 'searching'].includes(ride.status)) view.matching = matching;
  } else if (viewerRole === 'driver') {
    if (parties?.passenger && IDENTITY_STATUSES.includes(ride.status)) {
      view.passenger = {
        name: parties.passenger.full_name,
        phone: CONTACT_STATUSES.includes(ride.status) ? parties.passenger.phone : null,
      };
    }
  }
  return view;
}
