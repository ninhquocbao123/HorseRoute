import { Router } from 'express';
import { Role } from '@my-project/shared';
import { authorize } from '../../shared/middlewares/auth.middleware';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';

export function vehiclesRoutes(service: VehiclesService) {
  const router = Router(), controller = new VehiclesController(service);
  router.use(authorize(Role.COORDINATOR, Role.MANAGER));
  router.get('/', controller.list);
  router.get('/:id', controller.detail);
  router.post('/', authorize(Role.COORDINATOR), controller.create);
  router.put('/:id', authorize(Role.COORDINATOR), controller.update);
  router.delete('/:id', authorize(Role.COORDINATOR), controller.remove);
  return router;
}
