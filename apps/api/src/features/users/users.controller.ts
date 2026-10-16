import type { RequestHandler } from 'express';
import { UsersService } from './users.service';
import { parse } from '../../shared/utils/validation.util';
import { paginationSchema } from '../../shared/utils/pagination.util';
export class UsersController {
  constructor(private readonly service: UsersService) {}
  me: RequestHandler = async (req, res) => { res.json(req.account); };
  list: RequestHandler = async (req, res) => { res.json(await this.service.findAll(parse(paginationSchema, req.query))); };
}

