import { Router } from 'express';
import { Role } from '@my-project/shared';
import { authorize } from '../../shared/middlewares/auth.middleware';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { idSchema,parse } from '../../shared/utils/validation.util';
export function ordersRoutes(service: OrdersService) {
  const router = Router(), c = new OrdersController(service);
  router.get('/', authorize(Role.CUSTOMER, Role.MANAGER), c.list);
  router.get('/customer-workspace', authorize(Role.CUSTOMER), async(req,res)=>{res.json(await service.customerWorkspace(req.account));});
  router.get('/:id/quote',authorize(Role.CUSTOMER,Role.MANAGER),async(req,res)=>{res.json(await service.quote(req.account,parse(idSchema,req.params.id)));});
  router.get('/:id/review-options', authorize(Role.MANAGER), c.options);
  router.get('/:id', authorize(Role.CUSTOMER, Role.MANAGER), c.detail);
  router.post('/', authorize(Role.CUSTOMER), c.create);
  router.put('/:id', authorize(Role.CUSTOMER), c.edit);
  router.delete('/:id', authorize(Role.CUSTOMER), c.remove);
  router.post('/:id/submit', authorize(Role.CUSTOMER), c.submit);
  router.post('/:id/review', authorize(Role.MANAGER), c.review);
  return router;
}

