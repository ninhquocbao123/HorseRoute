type LogFields = Record<string, string | number | boolean | undefined>;

// Never serialize raw errors: drivers may attach SQL, credentials or provider bodies.
const errorMessages: Record<string, string> = {
  INVALID_ENV: 'Biến môi trường không hợp lệ; kiểm tra các tên trong configFields.',
  INVALID_SSL_CONFIG: 'Kiểm tra DB_SSL và đường dẫn tuyệt đối DB_SSL_CA_PATH.',
  ENOENT: 'Không tìm thấy file; kiểm tra đường dẫn cấu hình và chứng chỉ SSL.',
  EACCES: 'Không có quyền truy cập tài nguyên.',
  ECONNREFUSED: 'Kết nối bị từ chối; kiểm tra dịch vụ, địa chỉ và cổng.',
  ETIMEDOUT: 'Kết nối quá thời gian chờ.',
  ENOTFOUND: 'Không phân giải được tên máy chủ.',
  EAI_AGAIN: 'Tạm thời không phân giải được tên máy chủ.',
  ECONNRESET: 'Kết nối bị đóng bởi phía bên kia.',
  EADDRINUSE: 'Cổng HTTP đã được sử dụng.',
  ER_ACCESS_DENIED_ERROR: 'MySQL từ chối xác thực; kiểm tra tài khoản và quyền.',
  ER_BAD_DB_ERROR: 'Database được cấu hình không tồn tại.',
  ER_NO_SUCH_TABLE: 'Thiếu bảng database; kiểm tra migration.',
  ER_DUP_ENTRY: 'Dữ liệu trùng ràng buộc duy nhất.',
  WRONGPASS: 'Redis từ chối xác thực; kiểm tra tài khoản và mật khẩu.',
  NOAUTH: 'Redis yêu cầu xác thực.',
  CERT_HAS_EXPIRED: 'Chứng chỉ TLS đã hết hạn.',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'Không xác minh được chứng chỉ TLS.',
  SELF_SIGNED_CERT_IN_CHAIN: 'Chuỗi chứng chỉ TLS không được tin cậy.',
};

export class ConfigurationError extends Error {
  constructor(public readonly code: 'INVALID_ENV' | 'INVALID_SSL_CONFIG', public readonly fields: string[]) {
    super(`Invalid configuration: ${fields.join(', ')}`);
  }
}

export function safeError(error: unknown): LogFields {
  const value = error as { code?: unknown; driverError?: { code?: unknown }; message?: unknown } | null;
  let candidate = value?.driverError?.code ?? value?.code;
  // ioredis ReplyError often has a protocol code only in its message.
  if (!candidate && typeof value?.message === 'string') {
    candidate = /^(WRONGPASS|NOAUTH)\b/.exec(value.message)?.[1];
  }
  const code = typeof candidate === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(candidate)
    ? candidate : 'UNKNOWN_ERROR';
  return { code, message: errorMessages[code] ?? 'Thao tác thất bại; kiểm tra cấu hình và thành phần được ghi trong log.',
    ...(error instanceof ConfigurationError ? { configFields: error.fields.filter(field => /^[A-Z][A-Z0-9_]*$/.test(field)).join(', ') } : {}) };
}

export class Logger {
  constructor(private readonly scope: string) {}
  private write(level: 'info' | 'warn' | 'error', event: string, fields: LogFields = {}) {
    const line = JSON.stringify({ ...fields, timestamp: new Date().toISOString(), level, scope: this.scope, event });
    if (level === 'info') console.log(line);
    else if (level === 'warn') console.warn(line);
    else console.error(line);
  }
  info(event: string, fields?: LogFields) { this.write('info', event, fields); }
  warn(event: string, fields?: LogFields) { this.write('warn', event, fields); }
  error(event: string, fields?: LogFields) { this.write('error', event, fields); }
}

