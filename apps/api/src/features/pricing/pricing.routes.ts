import { Router } from 'express';
import { Role } from '@my-project/shared';
import { authorize } from '../../shared/middlewares/auth.middleware';
import { idSchema, parse } from '../../shared/utils/validation.util';
import { PricingService } from './pricing.service';
export function publicPricingRoutes(service:PricingService){
 const r=Router();
 r.get('/current',async(_req,res)=>{res.set('Cache-Control','no-store').json(await service.current());});
 r.post('/estimate',async(req,res)=>{res.set('Cache-Control','no-store').json(await service.estimate(req.body));});return r;
}
export function managerPricingRoutes(service:PricingService){
 const r=Router();r.use(authorize(Role.MANAGER));
 r.get('/',async(req,res)=>{res.json(await service.list(req.account));});
 r.post('/',async(req,res)=>{res.status(201).json(await service.create(req.account,req.body));});
 r.put('/:id',async(req,res)=>{res.json(await service.update(req.account,parse(idSchema,req.params.id),req.body));});
 r.post('/:id/publish',async(req,res)=>{res.json(await service.publish(req.account,parse(idSchema,req.params.id),req.body));});return r;
}
