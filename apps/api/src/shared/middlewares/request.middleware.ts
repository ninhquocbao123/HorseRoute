import { randomUUID } from 'crypto';
import type { Request, RequestHandler } from 'express';
import { Logger } from '../utils/logger.util';

const logger = new Logger('HTTP');

// Route templates avoid logging identifiers, arbitrary URLs and query secrets.
export function requestRoute(req: Request): string {
  return typeof req.route?.path === 'string' ? req.route.path : 'unmatched';
}

export const requestContext: RequestHandler = (req, res, next) => {
  req.requestId = randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  const started = process.hrtime.bigint();
  let logged = false;
  const complete = (aborted: boolean) => {
    if (logged) return;
    logged = true;
    logger.info('request_completed', {
      requestId: req.requestId,
      method: req.method,
      route: requestRoute(req),
      statusCode: aborted ? 499 : res.statusCode,
      aborted,
      durationMs: Math.round(Number(process.hrtime.bigint() - started) / 1e6),
    });
  };
  res.once('finish', () => complete(false));
  res.once('close', () => complete(!res.writableFinished));
  next();
};
