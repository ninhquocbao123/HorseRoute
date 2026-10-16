import { Router } from 'express';
import { HealthService } from './health.service';
export function healthRoutes(service: HealthService) {
  const router = Router();
  router.get('/', async (_req, res) => {
    try { res.json(await service.check()); }
    catch { res.status(503).json({ status: 'error', info: {}, error: { mysql: { status: 'down' } }, details: { mysql: { status: 'down' } } }); }
  });
  return router;
}

