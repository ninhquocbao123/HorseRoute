import { Router } from 'express';
import { Role } from '@my-project/shared';
import { authorize } from '../../shared/middlewares/auth.middleware';
import { parse,idSchema } from '../../shared/utils/validation.util';
import { ManagerService } from './manager.service';
export function managerRoutes(s:ManagerService){const r=Router();r.use(authorize(Role.MANAGER));
 r.get('/overview',async(req,res)=>{res.json(await s.overview(req.account));});
 r.get('/intake',async(req,res)=>{res.json(await s.intake(req.account));});
 r.get('/orders/:id/context',async(req,res)=>{res.json(await s.context(req.account,parse(idSchema,req.params.id)));});
 r.get('/quote-orders',async(req,res)=>{res.json(await s.queue(req.account));});
 r.get('/orders/:id/quotes',async(req,res)=>{res.json(await s.quotes(req.account,parse(idSchema,req.params.id)));});
 r.post('/orders/:id/quotes',async(req,res)=>{res.status(201).json(await s.create(req.account,parse(idSchema,req.params.id),req.body));});
 r.post('/quotes/:id/review',async(req,res)=>{res.json(await s.review(req.account,parse(idSchema,req.params.id),req.body));});
 r.post('/quotes/:id/receipts',async(req,res)=>{res.status(201).json(await s.receipt(req.account,parse(idSchema,req.params.id),req.body));});
 r.get('/revenue',async(req,res)=>{res.json(await s.revenue(req.account,req.query));});return r;}
