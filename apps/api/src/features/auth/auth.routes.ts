import { Router } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
export function authRoutes(service: AuthService) {
  const router = Router(), controller = new AuthController(service);
  router.post('/login', controller.login);
  router.post('/register', controller.register);
  router.post('/verify-email', controller.verifyEmail);
  router.post('/resend-verification', controller.resendVerification);
  router.post('/forgot-password', controller.forgotPassword);
  router.post('/reset-password', controller.resetPassword);
  return router;
}

