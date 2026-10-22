import { rateLimit, type Options } from 'express-rate-limit';
import type { Request } from 'express';

/** Đường bản đồ/GPS (kế hoạch Bước 6): không tính vào giới hạn chung theo IP, có giới hạn riêng theo người dùng. */
export const TRACKMAP_PATH = /^\/tracking\/trips\/[^/]+\/(map|positions)$/;

export const createRateLimiter = (limit = 100, options: Pick<Partial<Options>, 'skip' | 'keyGenerator'> = {}) => rateLimit({
  windowMs: 60_000, limit, standardHeaders: 'draft-7', legacyHeaders: false, ...options,
  handler: (req, res) => { res.status(429).json({ statusCode: 429, message: 'ThrottlerException: Too Many Requests', requestId: req.requestId, path: req.originalUrl, timestamp: new Date().toISOString() }); },
});


/** Giới hạn theo tài khoản (đặt sau xác thực): demo nhiều tab trên cùng một IP không chặn lẫn nhau. */
export const createUserRateLimiter = (limit: number) => createRateLimiter(limit, {
  keyGenerator: (req: Request) => `user:${req.account?.id ?? 'anonymous'}`,
});
