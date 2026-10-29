import type { RequestHandler } from 'express';
import { TripsService } from './trips.service';
import { parse } from '../../shared/utils/validation.util';
import { tripIdSchema, tripQuerySchema } from './trips.validation';
export class TripsController {
  constructor(private readonly service: TripsService) {}
  readiness: RequestHandler = async (req, res) => { res.json(await this.service.readiness(req.account, parse(tripIdSchema, req.params.id))); };
  release: RequestHandler = async (req, res) => { res.json(await this.service.releaseToDriver(req.account, parse(tripIdSchema, req.params.id), req.body)); };
  assignmentOptions: RequestHandler = async (req, res) => { res.json(await this.service.assignmentOptions(req.account, parse(tripIdSchema, req.params.id))); };
  assignments: RequestHandler = async (req, res) => { res.json(await this.service.assignments(req.account, parse(tripIdSchema, req.params.id))); };
  saveAssignments: RequestHandler = async (req, res) => { res.json(await this.service.saveAssignments(req.account, parse(tripIdSchema, req.params.id), req.body)); };
  review: RequestHandler = async (req, res) => { res.json(await this.service.reviewPlan(req.account, parse(tripIdSchema, req.params.id), req.body)); };
  submit: RequestHandler = async (req, res) => { res.json(await this.service.submitPlan(req.account, parse(tripIdSchema, req.params.id), req.body)); };
  save: RequestHandler = async (req, res) => { res.json(await this.service.savePlan(req.account, parse(tripIdSchema, req.params.id), req.body)); };
  previewRoute: RequestHandler = async (req, res) => { res.json(await this.service.previewRoute(req.account, parse(tripIdSchema, req.params.id), req.body)); };
  saveRoutePlan: RequestHandler = async (req, res) => { res.json(await this.service.saveRoutePlan(req.account, parse(tripIdSchema, req.params.id), req.body)); };
  list: RequestHandler = async (req, res) => { res.json(await this.service.list(req.account, parse(tripQuerySchema, req.query))); };
  detail: RequestHandler = async (req, res) => { res.json(await this.service.detail(req.account, parse(tripIdSchema, req.params.id))); };
  options: RequestHandler = async (req, res) => { res.json(await this.service.planOptions(req.account, parse(tripIdSchema, req.params.id))); };
}
