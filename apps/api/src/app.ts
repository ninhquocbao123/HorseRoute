import 'reflect-metadata';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { Services } from './shared/config/services';
import { TokenService } from './shared/utils/jwt.util';
import { apiRoutes } from './routes';
import { createRateLimiter, TRACKMAP_PATH } from './shared/middlewares/rateLimiter.middleware';
import { errorHandler } from './shared/middlewares/error.middleware';
import { NotFoundException } from './shared/core/error.response';
import { openApiDocument } from './shared/config/openapi';
import { requestContext } from './shared/middlewares/request.middleware';
export function createApp(options: { services: Services; tokens: TokenService; corsOrigin: string; production?: boolean; requestLimit?: number }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestContext);
  app.use(helmet());
  app.use(compression());
  app.use(cors({ origin: options.corsOrigin.split(',').map(value => value.trim()).filter(Boolean), credentials: true, exposedHeaders: ['X-Request-ID'] }));
  app.use(express.json({ limit: '1mb' }));
  // Bản đồ/GPS có limiter riêng theo người dùng (tracking.routes.ts), không tính vào giới hạn chung theo IP.
  app.use('/api/v1', createRateLimiter(options.requestLimit, { skip: req => TRACKMAP_PATH.test(req.path) }), apiRoutes(options.services, options.tokens));
  if (!options.production) {
    app.get('/docs-json', (_req, res) => { res.json(openApiDocument); });
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  }
  app.use((_req, _res, next) => next(new NotFoundException('Not Found')));
  app.use(errorHandler);
  return app;
}

