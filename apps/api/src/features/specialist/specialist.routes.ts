import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@my-project/shared';
import { authorize } from '../../shared/middlewares/auth.middleware';
import { parse,idSchema } from '../../shared/utils/validation.util';
import { SpecialistService } from './specialist.service';
export function specialistRoutes(s:SpecialistService){const r=Router();r.use(authorize(Role.SPECIALIST));
  r.get('/orders',async(req,res)=>{res.json(await s.queue(req.account));});
  r.get('/orders/:id',async(req,res)=>{res.json(await s.detail(req.account,parse(idSchema,req.params.id)));});
  r.post('/orders/:id/accept',async(req,res)=>{parse(z.object({}).strict(),req.body);res.json(await s.accept(req.account,parse(idSchema,req.params.id)));});
  r.post('/orders/:id/conclude',async(req,res)=>{const d=parse(z.object({decision:z.enum(['APPROVED','NEED_INFO','REJECTED']),note:z.string().trim().max(2000),revision:z.number().int().min(1)}).strict(),req.body);res.json(await s.conclude(req.account,parse(idSchema,req.params.id),d.decision,d.note,d.revision));});
  r.get('/orders/:id/photos/:fileId',async(req,res)=>{const file=await s.photo(req.account,parse(idSchema,req.params.id),parse(idSchema,req.params.fileId));res.setHeader('Content-Type',file.file_type==='PNG'?'image/png':'image/jpeg');res.setHeader('Cache-Control','private, no-store');res.send(file.buffer);});
  return r;
}
