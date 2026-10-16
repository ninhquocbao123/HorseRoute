import { Router } from 'express';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
export function notificationsRoutes(service: NotificationsService) {
  const router = Router(), controller = new NotificationsController(service);
  router.get('/', controller.list); router.post('/:id/read', controller.read);
  return router;
}

