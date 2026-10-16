import type { ErrorRequestHandler } from 'express';
import { MulterError } from 'multer';
import { HttpError } from '../core/error.response';
export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) { next(error); return; }
  let statusCode = 500;
  let message: string | string[] = 'Internal server error';
  let fields: Record<string, string> | undefined;
  if (error instanceof HttpError) {
    statusCode = error.getStatus();
    const body = error.getResponse();
    message = typeof body === 'string' ? body : body.message;
    fields = typeof body === 'string' ? undefined : body.fields;
  } else if (error instanceof MulterError) {
    statusCode = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = error.code === 'LIMIT_FILE_SIZE' ? 'File không được vượt quá 5 MB.' : 'Dữ liệu tải lên không hợp lệ.';
  } else if (error?.type === 'entity.parse.failed') {
    statusCode = 400; message = 'JSON không hợp lệ.';
  } else if (error?.type === 'entity.too.large') {
    statusCode = 413; message = 'Nội dung yêu cầu quá lớn.';
  }
  // Avoid logging credentials, raw SQL, or provider response bodies.
  if (statusCode >= 500) console.error('API failure', { name: error?.name, path: req.path, statusCode });
  res.status(statusCode).json({ statusCode, message, ...(fields ? { fields } : {}), path: req.originalUrl, timestamp: new Date().toISOString() });
};

