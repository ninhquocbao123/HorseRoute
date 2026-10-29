import { Router } from 'express';
import { parse, idSchema } from '../../shared/utils/validation.util';
import { createPaymentSessionSchema, completePaymentSessionSchema } from './payments.validation';
import { PaymentsService } from './payments.service';

export function paymentsRoutes(service: PaymentsService) {
  const router = Router();

  router.post('/vnpay', async(req,res)=>{const dto=parse(createPaymentSessionSchema,req.body);res.status(201).json(await service.createVnpay(req.account,dto,req.ip||req.socket.remoteAddress||'127.0.0.1'));});

  router.post('/sessions', async (req, res) => {
    const dto = parse(createPaymentSessionSchema, req.body);
    res.status(201).json(await service.createSession(req.account,dto));
  });

  router.post('/sessions/:code/complete', async (req, res) => {
    const code = req.params.code;
    const dto = parse(completePaymentSessionSchema, req.body);
    res.json(await service.completeSession(req.account,code,dto));
  });

  router.get('/sessions/:code', async (req, res) => {
    const code = req.params.code;
    res.json(await service.getSession(req.account, code));
  });

  router.get('/orders/:id', async (req, res) => {
    const id = parse(idSchema, req.params.id);
    res.json(await service.getOrderPayments(req.account, id));
  });

  return router;
}

