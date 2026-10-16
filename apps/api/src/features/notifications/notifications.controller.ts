import type { RequestHandler } from 'express';
import { NotificationsService } from './notifications.service';
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}
  list: RequestHandler = async (req, res) => { res.json(await this.service.list(req.account.id)); };
  read: RequestHandler = async (req, res) => { res.status(201).json(await this.service.read(req.account.id, String(req.params.id))); };
}

