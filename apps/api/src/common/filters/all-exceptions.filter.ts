import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const req = host.switchToHttp().getRequest();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : null;
    const message =
      typeof body === 'string' ? body : (body as { message?: string | string[] } | null)?.message ?? 'Internal server error';

    if (status >= 500) this.logger.error(exception instanceof Error ? exception.stack : String(exception));

    res.status(status).json({
      statusCode: status,
      message,
      ...(typeof body === 'object' && body && 'fields' in body ? { fields: (body as { fields: unknown }).fields } : {}),
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}

