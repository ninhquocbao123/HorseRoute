import type { RequestHandler } from 'express';
import { OrdersService } from './orders.service';
import { parse, idSchema } from '../../shared/utils/validation.util';
import { draftOrderSchema, orderQuerySchema, reviewSchema } from './orders.validation';
export class OrdersController {
  constructor(private readonly service: OrdersService) {}
  remove: RequestHandler = async (req,res)=>{res.json(await this.service.deleteDraft(req.account,parse(idSchema,req.params.id)));};
  list: RequestHandler = async (req, res) => { res.json(await this.service.list(req.account, parse(orderQuerySchema, req.query))); };
  detail: RequestHandler = async (req, res) => { res.json(await this.service.detail(req.account, parse(idSchema, req.params.id))); };
  options: RequestHandler = async (req, res) => { res.json(await this.service.reviewOptions(req.account, parse(idSchema, req.params.id))); };
  create: RequestHandler = async (req, res) => { res.status(201).json(await this.service.save(req.account, parse(draftOrderSchema, req.body))); };
  edit: RequestHandler = async (req, res) => { res.json(await this.service.save(req.account, parse(draftOrderSchema, req.body), parse(idSchema, req.params.id))); };
  submit: RequestHandler = async (req, res) => { res.status(201).json(await this.service.submit(req.account, parse(idSchema, req.params.id))); };
  review: RequestHandler = async (req, res) => { res.status(201).json(await this.service.review(req.account, parse(idSchema, req.params.id), parse(reviewSchema, req.body))); };
}

