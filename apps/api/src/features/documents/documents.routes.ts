import { Router } from 'express';
import { Role } from '@my-project/shared';
import { authorize } from '../../shared/middlewares/auth.middleware';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { uploadDocument,uploadHorseDocuments } from './documents.upload';
import {parse,idSchema} from '../../shared/utils/validation.util';
export function documentsRoutes(service: DocumentsService) {
  const router = Router(), c = new DocumentsController(service);
  router.use(authorize(Role.CUSTOMER, Role.SPECIALIST, Role.MANAGER));
  router.get('/orders', c.list);
  router.get('/orders/:orderId', c.detail);
  router.get('/orders/:orderId/files/:id', c.download);
  router.post('/orders/:orderId/horses/:horseId/upload',authorize(Role.CUSTOMER),uploadHorseDocuments,async(req,res)=>{res.status(201).json(await service.uploadHorse(req.account,parse(idSchema,req.params.orderId),parse(idSchema,req.params.horseId),(req.files||[]) as Express.Multer.File[]));});
  router.post('/orders/:orderId/items/:id/upload', authorize(Role.CUSTOMER), uploadDocument, c.upload);
  router.post('/orders/:orderId/items/:id/review', authorize(Role.SPECIALIST), c.review);
  router.post('/orders/:orderId/items/:id/request', authorize(Role.SPECIALIST), c.request);
  router.post('/orders/:orderId/dossiers/:id', authorize(Role.SPECIALIST), uploadDocument, c.dossier);
  return router;
}

