// Phân loại lỗi khi tải tài khoản đang đăng nhập (/users/me).
// Chỉ coi là hết phiên khi máy chủ trả lời rõ là token hoặc tài khoản không dùng được nữa.
// Quá nhiều request (429), máy chủ lỗi (5xx) hay mất mạng là lỗi tạm thời: giữ phiên và thử lại.
export type MeFailure = 'expired' | 'retry';

export function meFailure(status?: number): MeFailure {
  if (status === undefined || status === 408 || status === 429 || status >= 500) return 'retry';
  return status >= 400 ? 'expired' : 'retry';
}

/** Thời gian chờ trước lần thử lại thứ `attempt` (0, 1, 2...): theo Retry-After nếu máy chủ gửi, không thì 1, 2, 4, 8 giây. */
export function retryDelay(attempt: number, retryAfter?: string | null): number {
  const seconds = Number(retryAfter);
  if (retryAfter && Number.isFinite(seconds) && seconds > 0) return Math.min(seconds, 30) * 1000;
  return Math.min(1000 * 2 ** attempt, 8000);
}

export const ME_RETRIES = 4;
