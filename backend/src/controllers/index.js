import {
  availabilitySchema, createRideSchema, estimateSchema, idParamSchema, locationUpdateSchema, parse,
} from '../validation/schemas.js';

// Controllers: validate input, call a service, shape the HTTP response. No business logic here.
export function createControllers({ rideService, driverService }) {
  const id = (req) => parse(idParamSchema, req.params).id;

  return {
    // ----- me -----
    async getMe(req, res) {
      const { user } = req;
      const driver = user.driver ? await driverService.getState(user.driver) : null;
      const activeRide = await rideService.getActiveRide(user);
      res.json({
        user: { id: user.id, email: user.email, role: user.role },
        profile: user.profile,
        driver,
        active_ride_id: activeRide?.id ?? null,
      });
    },

    async getProfile(req, res) {
      const { user } = req;
      const driver = user.driver ? await driverService.getState(user.driver) : null;
      res.json({ profile: user.profile, driver });
    },

    // ----- fares -----
    async estimateFare(req, res) {
      res.json(await rideService.estimate(parse(estimateSchema, req.body)));
    },

    // ----- rides -----
    async createRide(req, res) {
      const { ride, created } = await rideService.createRide(req.user, parse(createRideSchema, req.body));
      res.status(created ? 201 : 200).json({ ride });
    },
    async getActiveRide(req, res) {
      res.json({ ride: await rideService.getActiveRide(req.user) });
    },
    async getRide(req, res) {
      res.json({ ride: await rideService.getRide(req.user, id(req)) });
    },
    async cancelRide(req, res) {
      res.json({ ride: await rideService.cancelRide(req.user, id(req)) });
    },
    async startRide(req, res) {
      res.json({ ride: await rideService.startRide(req.user, id(req)) });
    },
    async completeRide(req, res) {
      res.json({ ride: await rideService.completeRide(req.user, id(req)) });
    },

    // ----- driver -----
    async setAvailability(req, res) {
      const { is_online } = parse(availabilitySchema, req.body);
      res.json({ driver: await driverService.setAvailability(req.user.driver, is_online) });
    },
    async updateLocation(req, res) {
      res.json({ driver: await driverService.updateLocation(req.user.driver, parse(locationUpdateSchema, req.body)) });
    },
    async listOffers(req, res) {
      res.json({ offers: await rideService.listOffers(req.user.driver), server_time: new Date().toISOString() });
    },
    async acceptOffer(req, res) {
      res.json({ ride: await rideService.acceptOffer(req.user.driver, id(req)) });
    },
    async rejectOffer(req, res) {
      res.json(await rideService.rejectOffer(req.user.driver, id(req)));
    },
  };
}
