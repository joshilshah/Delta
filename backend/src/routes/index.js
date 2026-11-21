import { Router } from 'express';
import { asyncHandler as h } from '../middleware/errorHandler.js';

export function createRouter({ controllers: c, auth }) {
  const router = Router();
  const { authenticate, requireRole } = auth;
  const passenger = requireRole('passenger');
  const driver = requireRole('driver');
  const anyRole = requireRole('passenger', 'driver');

  router.use(authenticate); // every route below requires a verified Supabase session

  // Authentication and profiles
  router.get('/me', h(c.getMe));
  router.get('/me/profile', h(c.getProfile));

  // Fare calculation (passengers)
  router.post('/fares/estimate', passenger, h(c.estimateFare));

  // Rides
  router.post('/rides', passenger, h(c.createRide));
  router.get('/rides/active', anyRole, h(c.getActiveRide)); // must precede /rides/:id
  router.get('/rides/:id', anyRole, h(c.getRide));
  router.post('/rides/:id/cancel', anyRole, h(c.cancelRide));
  router.post('/rides/:id/start', driver, h(c.startRide));
  router.post('/rides/:id/complete', driver, h(c.completeRide));

  // Driver
  router.patch('/drivers/availability', driver, h(c.setAvailability));
  router.post('/drivers/location', driver, h(c.updateLocation));
  router.get('/drivers/offers', driver, h(c.listOffers));
  router.post('/offers/:id/accept', driver, h(c.acceptOffer));
  router.post('/offers/:id/reject', driver, h(c.rejectOffer));

  return router;
}
