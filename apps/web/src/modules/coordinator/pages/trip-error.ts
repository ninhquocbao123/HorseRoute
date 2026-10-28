import { isAxiosError } from 'axios';

export function tripLoadError(error: unknown): string {
  if (!isAxiosError(error)) return 'Phản hồi chuyến không hợp lệ. Vui lòng thử lại.';
  const status = error.response?.status;
  const messages: Record<number, string> = {
    400: 'ID chuyến không hợp lệ.',
    401: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
    403: 'Tài khoản không được phép truy cập chuyến này.',
    404: 'Chuyến không tồn tại hoặc không được phân công cho tài khoản Coordinator này. Hãy mở chuyến từ danh sách của bạn.',
  };
  const message = status ? messages[status] || (status >= 500 ? 'API gặp lỗi phía máy chủ. Cần kiểm tra log API bằng mã yêu cầu bên dưới.' : 'API từ chối tải chuyến.') : 'Không kết nối được API. Kiểm tra API đang chạy, địa chỉ VITE_API_URL và cấu hình CORS.';
  const requestId = error.response?.data?.requestId;
  return `${status ? `HTTP ${status} · ` : ''}${message}${typeof requestId === 'string' ? ` Mã yêu cầu: ${requestId}` : ''}`;
}
