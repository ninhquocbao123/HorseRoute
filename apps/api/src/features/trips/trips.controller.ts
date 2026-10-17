import type { RequestHandler } from 'express';
import { TripsService } from './trips.service';
import { parse } from '../../shared/utils/validation.util';
import { tripIdSchema, tripQuerySchema } from './trips.validation';
export class TripsController {
  constructor(private readonly service: TripsService) {}
  review: RequestHandler = async (req, res) => { res.json(await this.service.reviewPlan(req.account, parse(tripIdSchema, req.params.id), req.body)); };
  submit: RequestHandler = async (req, res) => { res.json(await this.service.submitPlan(req.account, parse(tripIdSchema, req.params.id), req.body)); };
  save: RequestHandler = async (req, res) => { res.json(await this.service.savePlan(req.account, parse(tripIdSchema, req.params.id), req.body)); };
  list: RequestHandler = async (req, res) => { res.json(await this.service.list(req.account, parse(tripQuerySchema, req.query))); };
  detail: RequestHandler = async (req, res) => { res.json(await this.service.detail(req.account, parse(tripIdSchema, req.params.id))); };
  options: RequestHandler = async (req, res) => { res.json(await this.service.planOptions(req.account, parse(tripIdSchema, req.params.id))); };
}
