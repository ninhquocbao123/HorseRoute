import { Router } from 'express';
import { Role } from '@my-project/shared';
import { authorize } from '../../shared/middlewares/auth.middleware';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

export function locationsRoutes(service: LocationsService) {
  const router = Router(), controller = new LocationsController(service);
  router.use(authorize(Role.SPECIALIST, Role.COORDINATOR, Role.MANAGER));
  router.get('/', controller.list);
  router.get('/:id', controller.detail);
  router.post('/', authorize(Role.SPECIALIST), controller.create);
  router.put('/:id', authorize(Role.SPECIALIST), controller.update);
  router.delete('/:id', authorize(Role.SPECIALIST), controller.remove);
  return router;
}
