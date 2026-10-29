export const orderStatuses: Record<string, { label: string; tone: string; icon: string }> = {
  DRAFT: { label: 'Bản nháp đơn', tone: 'draft', icon: 'edit' },
  PENDING: { label: 'Chờ tiếp nhận', tone: 'pending', icon: 'clock' },
  NEED_INFO: { label: 'Cần bổ sung', tone: 'info', icon: 'warning' },
  REJECTED: { label: 'Đã từ chối', tone: 'danger', icon: 'close' },
  APPROVED: { label: 'Đơn đã duyệt', tone: 'approved', icon: 'check' },
  PREPARING: { label: 'Đang chuẩn bị', tone: 'preparing', icon: 'setting' },
  READY: { label: 'Sẵn sàng xuất phát', tone: 'ready', icon: 'check' },
  IN_TRANSIT: { label: 'Đang vận chuyển', tone: 'transit', icon: 'car' },
  DELIVERED: { label: 'Đã giao', tone: 'delivered', icon: 'check' },
  CANCELLED: { label: 'Đã hủy', tone: 'danger', icon: 'close' },
};
export const planStatuses: typeof orderStatuses = {
  DRAFT: { label: 'Bản nháp', tone: 'draft', icon: 'edit' },
  PENDING_APPROVAL: { label: 'Chờ duyệt', tone: 'pending', icon: 'clock' },
  APPROVED: { label: 'Đã duyệt', tone: 'delivered', icon: 'check' },
};
export function statusGuidance(order?: string, plan?: string): string {
  const fallback = 'Theo dõi trạng thái đơn và kế hoạch trước khi tiếp tục.';
  if (!order || !plan || !Object.prototype.hasOwnProperty.call(orderStatuses, order) || !Object.prototype.hasOwnProperty.call(planStatuses, plan)) return fallback;
  const priority: Record<string, string> = {
    NEED_INFO: 'Đơn cần bổ sung thông tin trước khi tiếp tục.',
    REJECTED: 'Đơn đã bị từ chối và không thể tiếp tục lập kế hoạch.',
    CANCELLED: 'Đơn đã bị hủy.',
    IN_TRANSIT: 'Chuyến đã xuất phát và đang được vận chuyển.',
    DELIVERED: 'Chuyến vận chuyển đã hoàn thành.',
  };
  if (priority[order]) return priority[order];
  if (plan === 'PENDING_APPROVAL') return 'Kế hoạch đã được gửi và đang chờ Manager duyệt.';
  if (order === 'PREPARING' && plan === 'DRAFT') return 'Hoàn thiện lộ trình, thời gian và phân công để gửi duyệt.';
  if (order === 'PREPARING' && plan === 'APPROVED') return 'Kế hoạch đã được duyệt; đang chờ Manager chuyển chuyến cho tổ tài xế.';
  if (order === 'READY' && plan === 'APPROVED') return 'Chuyến đã sẵn sàng; đang chờ tài xế xác nhận xuất phát.';
  return fallback;
}
