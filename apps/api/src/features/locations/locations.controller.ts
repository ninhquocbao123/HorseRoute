import type { RequestHandler } from 'express';
import { LocationsService } from './locations.service';

export class LocationsController {
  constructor(private readonly service: LocationsService) {}
  list: RequestHandler = async (req, res) => { res.json(await this.service.list(req.account, req.query)); };
  detail: RequestHandler = async (req, res) => { res.json(await this.service.detail(req.account, req.params.id as string)); };
  create: RequestHandler = async (req, res) => { res.status(201).json(await this.service.create(req.account, req.body)); };
  update: RequestHandler = async (req, res) => { res.json(await this.service.update(req.account, req.params.id as string, req.body)); };
  remove: RequestHandler = async (req, res) => { await this.service.remove(req.account, req.params.id as string); res.status(204).end(); };
}
