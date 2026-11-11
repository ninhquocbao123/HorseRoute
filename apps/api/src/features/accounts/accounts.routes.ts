import { Router } from 'express';
import { Role } from '@my-project/shared';
import { authorize } from '../../shared/middlewares/auth.middleware';
import { idSchema, parse } from '../../shared/utils/validation.util';
import { AccountsService } from './accounts.service';

export function accountsRoutes(service: AccountsService) {
  const router = Router();
  router.use(authorize(Role.ADMIN));
  const id = (value: unknown) => parse(idSchema, value);
  router.get('/', async (req, res) => { res.json(await service.list(req.query)); });
  router.post('/', async (req, res) => { res.status(201).json(await service.create(req.account, req.body)); });
  router.patch('/:id', async (req, res) => { res.json(await service.update(req.account, id(req.params.id), req.body)); });
  router.post('/:id/lock', async (req, res) => { res.json(await service.setStatus(req.account, id(req.params.id), 'LOCKED', req.body)); });
  router.post('/:id/unlock', async (req, res) => { res.json(await service.setStatus(req.account, id(req.params.id), 'ACTIVE', req.body)); });
  router.post('/:id/reset-password', async (req, res) => { res.json(await service.resetPassword(req.account, id(req.params.id), req.body)); });
  return router;
}
