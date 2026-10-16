import type { RequestHandler } from 'express';
import { AuthService } from './auth.service';
import { loginSchema, registerSchema } from './auth.validation';
import { parse } from '../../shared/utils/validation.util';
export class AuthController {
  constructor(private readonly service: AuthService) {}
  login: RequestHandler = async (req, res) => { const dto = parse(loginSchema, req.body); res.json(await this.service.login(dto.email, dto.password)); };
  register: RequestHandler = async (req, res) => { res.status(201).json(await this.service.register(parse(registerSchema, req.body))); };
}

