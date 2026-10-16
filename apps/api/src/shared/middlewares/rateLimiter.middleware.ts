import { rateLimit } from 'express-rate-limit';
export const createRateLimiter = (limit = 100) => rateLimit({
  windowMs: 60_000, limit, standardHeaders: 'draft-7', legacyHeaders: false,
  handler: (req, res) => { res.status(429).json({ statusCode: 429, message: 'ThrottlerException: Too Many Requests', requestId: req.requestId, path: req.originalUrl, timestamp: new Date().toISOString() }); },
});

