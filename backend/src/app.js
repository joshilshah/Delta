import express from 'express';
import cors from 'cors';
import { createControllers } from './controllers/index.js';
import { createRouter } from './routes/index.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { createFareService } from './services/fareService.js';
import { createDispatchService } from './services/dispatchService.js';
import { createRideService } from './services/rideService.js';
import { createDriverService } from './services/driverService.js';

/**
 * Wire everything together from injected dependencies (store, routeService, verifyToken),
 * so the whole HTTP stack can be exercised in tests without Supabase or Google.
 */
export function createApp({ config, store, routeService, verifyToken, logger = console }) {
  const fareService = createFareService({ routeService, pricing: config.pricing });
  const dispatchService = createDispatchService({ store, matching: config.matching, logger });
  const rideService = createRideService({
    store, fareService, dispatchService, minTripMeters: config.minTripMeters,
  });
  const driverService = createDriverService({
    store, dispatchService, staleSeconds: config.matching.locationStaleSeconds,
  });
  const controllers = createControllers({ rideService, driverService });
  const auth = createAuthMiddleware({ verifyToken, store });

  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: config.frontendOrigin, credentials: false }));
  app.use(express.json({ limit: '20kb' }));

  app.get('/health', async (_req, res) => {
    try {
      await store.ping();
      res.json({ status: 'ok', database: 'up' });
    } catch {
      res.status(503).json({ status: 'degraded', database: 'down' });
    }
  });

  app.use('/api', createRouter({ controllers, auth }));
  app.use(notFound);
  app.use(errorHandler(logger));

  return { app, dispatchService };
}
