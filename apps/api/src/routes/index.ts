import { tripsRoutes } from '../features/trips/trips.routes';
import { Router } from 'express';
import { Services } from '../shared/config/services';
import { TokenService } from '../shared/utils/jwt.util';
import { authenticate } from '../shared/middlewares/auth.middleware';
import { authRoutes } from '../features/auth/auth.routes';
import { healthRoutes } from '../features/health/health.routes';
import { usersRoutes } from '../features/users/users.routes';
import { ordersRoutes } from '../features/orders/orders.routes';
import { documentsRoutes } from '../features/documents/documents.routes';
import { notificationsRoutes } from '../features/notifications/notifications.routes';
import { vehiclesRoutes } from '../features/vehicles/vehicles.routes';
import { locationsRoutes } from '../features/locations/locations.routes';
import { trackingRoutes } from '../features/tracking/tracking.routes';
export function apiRoutes(services: Services, tokens: TokenService) {
  const router = Router();
  router.use('/auth', authRoutes(services.auth));
  router.use('/health', healthRoutes(services.health));
  // Every route below this boundary is authenticated by default.
  router.use(authenticate(services.users, tokens));
  router.use('/users', usersRoutes(services.users));
  router.use('/orders', ordersRoutes(services.orders));
  router.use('/documents', documentsRoutes(services.documents));
  router.use('/trips', tripsRoutes(services.trips));
  router.use('/vehicles', vehiclesRoutes(services.vehicles));
  router.use('/locations', locationsRoutes(services.locations));
  router.use('/tracking', trackingRoutes(services.tracking));
  router.use('/notifications', notificationsRoutes(services.notifications));
  return router;
}

