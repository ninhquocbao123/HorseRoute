export type ErrorBody = { message: string | string[]; fields?: Record<string, string>; blockers?: import('../../features/readiness/readiness.service').ReadinessBlocker[] };
export class HttpError extends Error {
  constructor(public readonly statusCode: number, private readonly body: ErrorBody | string) {
    super(typeof body === 'string' ? body : String(body.message));
  }
  getStatus() { return this.statusCode; }
  getResponse() { return this.body; }
}
export class BadRequestException extends HttpError { constructor(body: ErrorBody | string = 'Bad Request') { super(400, body); } }
export class UnauthorizedException extends HttpError { constructor(body = 'Unauthorized') { super(401, body); } }
export class ForbiddenException extends HttpError { constructor(body = 'Forbidden') { super(403, body); } }
export class NotFoundException extends HttpError { constructor(body = 'Not Found') { super(404, body); } }
export class ConflictException extends HttpError { constructor(body: ErrorBody | string = 'Conflict') { super(409, body); } }
export class ServiceUnavailableException extends HttpError { constructor(body = 'Service unavailable') { super(503, body); } }

