import { Router } from 'express';
import { Role } from '@my-project/shared';
import { z } from 'zod';
import { authorize } from '../../shared/middlewares/auth.middleware';
import { createUserRateLimiter } from '../../shared/middlewares/rateLimiter.middleware';
import { parse } from '../../shared/utils/validation.util';
import { searchAddresses } from './trip-map-provider';

const searchSchema = z.object({ q: z.string().trim().min(3).max(200) }).strict();

export function mapsRoutes() {
  const router = Router();
  router.use(authorize(Role.COORDINATOR));
  router.use(createUserRateLimiter(30));
  router.get('/search', async (req, res) => {
    const { q } = parse(searchSchema, req.query);
    res.json({ items: await searchAddresses(q), attribution: 'Mapbox' });
  });
  return router;
}
