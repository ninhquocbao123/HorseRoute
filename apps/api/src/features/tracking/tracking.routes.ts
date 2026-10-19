import { Router } from 'express';
import { Role } from '@my-project/shared';
import { authorize } from '../../shared/middlewares/auth.middleware';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { uploadPhotos } from './tracking.upload';

export function trackingRoutes(service: TrackingService) {
  const router = Router();
  const controller = new TrackingController(service);
  const internal = [Role.DRIVER_ESCORT, Role.COORDINATOR, Role.MANAGER, Role.SPECIALIST] as const;

  // Giai đoạn 1: chặng và mốc
  router.get('/driver/trips', authorize(Role.DRIVER_ESCORT), controller.driverTrips);
  router.get('/trips/:id', authorize(...internal), controller.tripDetail);
  router.post('/legs/:legId/milestones', authorize(Role.DRIVER_ESCORT), controller.recordMilestone);
  router.post('/legs/:legId/complete', authorize(Role.DRIVER_ESCORT), controller.completeLeg);
  router.patch('/legs/:legId/correct', authorize(Role.COORDINATOR, Role.MANAGER), controller.correctLeg);

  // Giai đoạn 2: nhật ký ngựa, sự cố, cảnh báo, tệp đính kèm (quyền theo chuyến kiểm tra trong service)
  router.post('/legs/:legId/horse-logs', authorize(Role.DRIVER_ESCORT), uploadPhotos, controller.createHorseLog);
  router.get('/trips/:tripId/horse-logs', authorize(...internal), controller.horseLogs);
  router.post('/trips/:tripId/incidents', authorize(Role.DRIVER_ESCORT), uploadPhotos, controller.createIncident);
  router.get('/trips/:tripId/incidents', authorize(Role.DRIVER_ESCORT, Role.COORDINATOR, Role.MANAGER), controller.incidents);
  router.patch('/incidents/:id', authorize(Role.COORDINATOR), controller.updateIncident);
  router.post('/trips/:tripId/alerts', authorize(Role.COORDINATOR), controller.createAlert);
  router.get('/trips/:tripId/alerts', authorize(...internal), controller.alerts);
  router.get('/attachments/:id', authorize(...internal), controller.attachment);

  // Giai đoạn 3: timeline và dashboard vận hành
  router.get('/orders/:orderId/timeline', authorize(Role.CUSTOMER), controller.orderTimeline);
  router.get('/trips/:tripId/timeline', authorize(...internal), controller.tripTimeline);
  router.get('/operations/active-trips', authorize(Role.MANAGER, Role.COORDINATOR, Role.SPECIALIST), controller.activeTrips);

  return router;
}
