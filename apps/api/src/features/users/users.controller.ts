import type { RequestHandler } from 'express';
import { UsersService } from './users.service';
import { parse } from '../../shared/utils/validation.util';
import { paginationSchema } from '../../shared/utils/pagination.util';
export class UsersController {
  constructor(private readonly service: UsersService) {}
  me: RequestHandler = async (req, res) => { res.json(req.account); };
  updateProfile: RequestHandler = async (req,res) => { res.json(await this.service.updateProfile(req.account.id,req.body)); };
  changePassword: RequestHandler = async (req,res) => { res.json(await this.service.changePassword(req.account.id,req.body)); };
  list: RequestHandler = async (req, res) => { res.json(await this.service.findAll(parse(paginationSchema, req.query))); };
}

