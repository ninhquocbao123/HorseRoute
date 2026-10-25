import { RouteDistanceService, routeDistanceSchema } from './route-distance';
import { Router } from 'express';
import { Role } from '@my-project/shared';
import { authorize } from '../../shared/middlewares/auth.middleware';
import { parse,idSchema } from '../../shared/utils/validation.util';
import { CustomerService } from './customer.service';
import { profileSchema } from './customer.validation';
import { uploadDocument } from '../documents/documents.upload';
import { z } from 'zod';
export function customerRoutes(s:CustomerService){const r=Router();const routes=new RouteDistanceService();r.use(authorize(Role.CUSTOMER));
 r.post('/route-distance',async(req,res)=>{res.json(await routes.estimate(parse(routeDistanceSchema,req.body)));});
 r.get('/profiles',async(req,res)=>{res.json(await s.list(req.account));});
 r.post('/profiles',async(req,res)=>{res.status(201).json(await s.save(req.account,parse(profileSchema,req.body)));});
 r.put('/profiles/:id',async(req,res)=>{res.json(await s.save(req.account,parse(profileSchema,req.body),parse(idSchema,req.params.id)));});
 r.get('/document-types',async(_req,res)=>{res.json(await s.documentTypes());});
 r.post('/profiles/:id/files',uploadDocument,async(req,res)=>{const {kind,slot}=parse(z.object({kind:z.enum(['PHOTO','DOCUMENT']),slot:z.string().max(30)}).strict(),req.body);res.status(201).json(await s.upload(req.account,parse(idSchema,req.params.id),kind,slot,req.file!));});
 r.get('/files/:id',async(req,res)=>{const f=await s.download(req.account,parse(idSchema,req.params.id));res.setHeader('Content-Type',({PNG:'image/png',JPG:'image/jpeg',PDF:'application/pdf'} as Record<string,string>)[f.file_type]);res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');res.send(f.buffer);});
 return r;}
