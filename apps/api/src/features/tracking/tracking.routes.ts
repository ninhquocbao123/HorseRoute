import { Router } from 'express';
import { Role } from '@my-project/shared';
import { authorize } from '../../shared/middlewares/auth.middleware';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { uploadPhotos } from './tracking.upload';
import { createUserRateLimiter } from '../../shared/middlewares/rateLimiter.middleware';

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
  // Báo cáo sức khỏe ngựa: nháp → gửi (chỉ hộ tống người tạo; quyền theo chuyến kiểm tra trong service)
  router.patch('/horse-logs/:id', authorize(Role.DRIVER_ESCORT), uploadPhotos, controller.updateHorseReport);
  router.delete('/horse-logs/:id', authorize(Role.DRIVER_ESCORT), controller.deleteHorseReport);
  router.post('/horse-logs/:id/send', authorize(Role.DRIVER_ESCORT), controller.sendHorseReport);
  // Khách xem báo cáo đã gửi cho đơn của mình
  router.get('/orders/:orderId/horse-reports', authorize(Role.CUSTOMER), controller.customerHorseReports);
  router.post('/orders/:orderId/horse-reports/:id/view', authorize(Role.CUSTOMER), controller.viewHorseReport);
  // Hoạt động chăm sóc (gap-analysis-escort.md): chỉ hộ tống ghi; đọc cho mọi vai trò nội bộ trong phạm vi chuyến
  router.post('/trips/:tripId/care-activities', authorize(Role.DRIVER_ESCORT), controller.createCareActivity);
  router.get('/trips/:tripId/care-activities', authorize(...internal), controller.careActivities);
  router.post('/trips/:tripId/incidents', authorize(Role.DRIVER_ESCORT), uploadPhotos, controller.createIncident);
  router.get('/trips/:tripId/incidents', authorize(Role.DRIVER_ESCORT, Role.COORDINATOR, Role.MANAGER), controller.incidents);
  router.patch('/incidents/:id', authorize(Role.COORDINATOR), controller.updateIncident);
  router.post('/trips/:tripId/alerts', authorize(Role.COORDINATOR), controller.createAlert);
  router.get('/trips/:tripId/alerts', authorize(...internal), controller.alerts);
  router.get('/attachments/:id', authorize(...internal, Role.CUSTOMER), controller.attachment);

  // Giai đoạn 3: timeline và dashboard vận hành
  router.get('/orders/:orderId/timeline', authorize(Role.CUSTOMER), controller.orderTimeline);
  router.get('/trips/:tripId/timeline', authorize(...internal), controller.tripTimeline);
  router.get('/operations/active-trips', authorize(Role.MANAGER, Role.COORDINATOR, Role.SPECIALIST), controller.activeTrips);

  // Bản đồ + GPS (kế hoạch Bước 4 + 6): giới hạn theo người dùng thay cho giới hạn chung theo IP.
  const mapLimit = createUserRateLimiter(60);
  router.get('/trips/:tripId/map', mapLimit, authorize(...internal), controller.tripMap);
  router.post('/trips/:tripId/positions', createUserRateLimiter(30), authorize(Role.DRIVER_ESCORT), controller.recordPositions);
  router.get('/trips/:tripId/positions', mapLimit, authorize(...internal), controller.trackPoints);

  return router;
}
