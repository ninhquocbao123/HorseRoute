import type { RequestHandler } from 'express';
import { AuthService } from './auth.service';
import { emailSchema, loginSchema, registerSchema, resetPasswordSchema, verifyEmailSchema } from './auth.validation';
import { parse } from '../../shared/utils/validation.util';
export class AuthController {
  constructor(private readonly service: AuthService) {}
  login: RequestHandler = async (req, res) => { const dto = parse(loginSchema, req.body); res.json(await this.service.login(dto.email, dto.password)); };
  register: RequestHandler = async (req, res) => { res.status(201).json(await this.service.register(parse(registerSchema, req.body))); };
  verifyEmail: RequestHandler = async (req, res) => { const dto = parse(verifyEmailSchema, req.body); res.json(await this.service.verifyEmail(dto.email, dto.code)); };
  resendVerification: RequestHandler = async (req, res) => { res.json(await this.service.resendVerification(parse(emailSchema, req.body).email)); };
  forgotPassword: RequestHandler = async (req, res) => { res.json(await this.service.forgotPassword(parse(emailSchema, req.body).email)); };
  resetPassword: RequestHandler = async (req, res) => { const dto = parse(resetPasswordSchema, req.body); res.json(await this.service.resetPassword(dto.email, dto.code, dto.password)); };
}

