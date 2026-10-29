import { Router } from 'express';
import { Role } from '@my-project/shared';
import { authorize } from '../../shared/middlewares/auth.middleware';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { createUserRateLimiter } from '../../shared/middlewares/rateLimiter.middleware';
export function tripsRoutes(service: TripsService) {
  const router = Router(), controller = new TripsController(service);
  router.use(authorize(Role.COORDINATOR, Role.MANAGER));
  router.get('/:id/readiness', controller.readiness);
  router.post('/:id/start-transport', authorize(Role.MANAGER), controller.release);
  router.get('/:id/assignment-options', controller.assignmentOptions);
  router.get('/:id/assignments', controller.assignments);
  router.put('/:id/assignments', authorize(Role.COORDINATOR), controller.saveAssignments);
  router.post('/:id/review-plan', authorize(Role.MANAGER), controller.review);
  router.post('/:id/submit-plan', authorize(Role.COORDINATOR), controller.submit);
  router.put('/:id/plan', authorize(Role.COORDINATOR), controller.save);
  router.post('/:id/route-preview', authorize(Role.COORDINATOR), createUserRateLimiter(20), controller.previewRoute);
  router.put('/:id/route-plan', authorize(Role.COORDINATOR), controller.saveRoutePlan);
  router.get('/', controller.list);
  router.get('/:id/plan-options', controller.options);
  router.get('/:id', controller.detail);
  return router;
}
