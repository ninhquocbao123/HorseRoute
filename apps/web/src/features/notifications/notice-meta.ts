/** Phân loại và đường dẫn của thông báo, dùng chung cho toast (NotificationToaster) và bảng chuông. */
export type LiveNotice = {
  id: string; content: string; createdAt: string; eventType?: string | null; relatedType?: string | null; relatedId?: string | null;
  orderId?: string | null; documentId?: string | null; horseId?: string | null;
};

const INCIDENT_EVENTS = new Set(['INCIDENT_REPORTED', 'HORSE_REPORT_ALERT', 'DELIVERY_EXCEPTION_OPENED']);
/** Sự cố: toast viền đỏ, nền đỏ nhạt, giữ tới khi tắt. */
export const isIncidentNotice = (eventType?: string | null) => !!eventType && (INCIDENT_EVENTS.has(eventType) || eventType.startsWith('INCIDENT'));

const TITLES: Record<string, string> = {
  INCIDENT_REPORTED: 'Sự cố trên chuyến', HORSE_REPORT_ALERT: 'Cảnh báo sức khỏe ngựa', DELIVERY_EXCEPTION_OPENED: 'Sự cố giao ngựa',
  DELIVERY_EXCEPTION_APPROVED: 'Ngoại lệ giao ngựa đã duyệt', DOCUMENT_SUPPLEMENT: 'Yêu cầu bổ sung giấy tờ', DOCUMENT_UPDATE: 'Cập nhật giấy tờ',
  DOCUMENT_SUBMITTED: 'Giấy tờ vừa nộp', DOCUMENT_RESUBMITTED: 'Khách đã nộp lại giấy tờ', QUOTE_APPROVED: 'Báo giá đã duyệt',
  PAYMENT_SUCCESS: 'Thanh toán thành công', PAYMENT_RECEIVED: 'Đã nhận thanh toán', ASSESSMENT_RESULT: 'Kết quả thẩm định',
  ORDER_CUSTOMS_UPDATED: 'Cập nhật thông quan', TRIP_ALERT: 'Cảnh báo điều phối', LEG_MILESTONE_UPDATED: 'Cập nhật hành trình',
  ORDER_LEG_PROGRESS: 'Cập nhật hành trình', LEG_COMPLETED: 'Hoàn thành chặng', CARE_ACTIVITY: 'Chăm sóc ngựa', HORSE_REPORT: 'Báo cáo sức khỏe ngựa',
};
export const noticeTitle = (eventType?: string | null) => (eventType && TITLES[eventType]) || 'Thông báo mới';

/** Trang mở khi bấm thông báo, theo vai trò người xem. */
export function noticeLink(role: string, notice: LiveNotice): string {
  const order = notice.orderId || (notice.relatedType === 'ORDER' ? notice.relatedId : null);
  const trip = notice.relatedType === 'TRIP' ? notice.relatedId : null;
  const q = (value: string) => encodeURIComponent(value);
  switch (role) {
    case 'CUSTOMER':
      if (!order) return '/dashboard?view=notifications';
      return `/dashboard?view=orders&order=${q(order)}${notice.horseId ? `&horse=${q(notice.horseId)}` : ''}${notice.documentId ? `&document=${q(notice.documentId)}` : ''}`;
    case 'MANAGER':
      if (trip) return `/dashboard/trips/${q(trip)}`;
      return order ? `/dashboard?view=orders&order=${q(order)}` : '/dashboard?view=notifications';
    case 'COORDINATOR':
      if (notice.relatedType === 'INCIDENT' && notice.relatedId) return `/coordinator/incidents?incident=${q(notice.relatedId)}`;
      if (trip) return `/coordinator/trips/${q(trip)}`;
      return '/coordinator/notifications';
    default:
      return '/dashboard?view=notifications';
  }
}

/** Báo cho các bảng chuông đang mở tải lại danh sách (số chưa đọc đổi cùng lúc với toast). */
const EVENT = 'horseroute:notices-changed';
export const publishNoticeChange = () => window.dispatchEvent(new Event(EVENT));
export function onNoticeChange(listener: () => void) {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
