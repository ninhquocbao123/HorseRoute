import { Router } from 'express';
import { Role } from '@my-project/shared';
import { authorize } from '../../shared/middlewares/auth.middleware';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
export function usersRoutes(service: UsersService) {
  const router = Router(), controller = new UsersController(service);
  router.get('/me', controller.me);
  router.get('/', authorize(Role.ADMIN), controller.list);
  return router;
}

