import { Role } from '@my-project/shared';
import { authorize } from '../shared/middlewares/auth.middleware';
import { parse } from '../shared/utils/validation.util';
import { tripIdSchema } from '../features/trips/trips.validation';
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
export function apiRoutes(services: Services, tokens: TokenService) {
  const router = Router();
  router.use('/auth', authRoutes(services.auth));
  router.use('/health', healthRoutes(services.health));
  // Every route below this boundary is authenticated by default.
  router.use(authenticate(services.users, tokens));
  router.get('/trips/:id/readiness', authorize(Role.COORDINATOR, Role.MANAGER), async (req, res) => {
    res.json(await services.readiness.readiness(req.account, parse(tripIdSchema, req.params.id)));
  });
  router.post('/orders/:id/mark-ready', authorize(Role.MANAGER), async (req, res) => {
    res.json(await services.readiness.markReady(req.account, parse(tripIdSchema, req.params.id), req.body));
  });
  router.use('/users', usersRoutes(services.users));
  router.use('/orders', ordersRoutes(services.orders));
  router.use('/documents', documentsRoutes(services.documents));
  router.use('/trips', tripsRoutes(services.trips));
  router.use('/notifications', notificationsRoutes(services.notifications));
  return router;
}

