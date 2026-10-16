import { Router } from 'express';
import { Role } from '@my-project/shared';
import { authorize } from '../../shared/middlewares/auth.middleware';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
export function ordersRoutes(service: OrdersService) {
  const router = Router(), c = new OrdersController(service);
  router.get('/', authorize(Role.CUSTOMER, Role.MANAGER), c.list);
  router.get('/:id/review-options', authorize(Role.MANAGER), c.options);
  router.get('/:id', authorize(Role.CUSTOMER, Role.MANAGER), c.detail);
  router.post('/', authorize(Role.CUSTOMER), c.create);
  router.put('/:id', authorize(Role.CUSTOMER), c.edit);
  router.post('/:id/submit', authorize(Role.CUSTOMER), c.submit);
  router.post('/:id/review', authorize(Role.MANAGER), c.review);
  return router;
}

