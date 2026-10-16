import { Router } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
export function authRoutes(service: AuthService) {
  const router = Router(), controller = new AuthController(service);
  router.post('/login', controller.login);
  router.post('/register', controller.register);
  return router;
}

