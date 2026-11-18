import type { Notice, Page } from "./api/types";

/**
 * Phân loại thông báo và màn mở khi bấm (danh sách Thông báo, popup trong app, sau này thông báo đẩy).
 * Giữ cùng bảng với web: apps/web/src/features/notifications/notice-meta.ts.
 */
const INCIDENT_EVENTS = new Set([
  "INCIDENT_REPORTED",
  "HORSE_REPORT_ALERT",
  "DELIVERY_EXCEPTION_OPENED",
]);
export const isIncidentNotice = (eventType?: string | null) =>
  !!eventType && (INCIDENT_EVENTS.has(eventType) || eventType.startsWith("INCIDENT"));

const TITLES: Record<string, string> = {
  INCIDENT_REPORTED: "Sự cố trên chuyến",
  HORSE_REPORT_ALERT: "Cảnh báo sức khỏe ngựa",
  DELIVERY_EXCEPTION_OPENED: "Sự cố giao ngựa",
  DELIVERY_EXCEPTION_APPROVED: "Ngoại lệ giao ngựa đã duyệt",
  DOCUMENT_SUPPLEMENT: "Yêu cầu bổ sung giấy tờ",
  DOCUMENT_UPDATE: "Cập nhật giấy tờ",
  DOCUMENT_SUBMITTED: "Giấy tờ vừa nộp",
  DOCUMENT_RESUBMITTED: "Khách đã nộp lại giấy tờ",
  QUOTE_APPROVED: "Báo giá đã duyệt",
  PAYMENT_SUCCESS: "Thanh toán thành công",
  PAYMENT_RECEIVED: "Đã nhận thanh toán",
  ASSESSMENT_RESULT: "Kết quả thẩm định",
  ORDER_CUSTOMS_UPDATED: "Cập nhật thông quan",
  TRIP_ALERT: "Cảnh báo điều phối",
  LEG_MILESTONE_UPDATED: "Cập nhật hành trình",
  ORDER_LEG_PROGRESS: "Cập nhật hành trình",
  LEG_COMPLETED: "Hoàn thành chặng",
  CARE_ACTIVITY: "Chăm sóc ngựa",
  HORSE_REPORT: "Báo cáo sức khỏe ngựa",
};
export const noticeTitle = (eventType?: string | null) =>
  (eventType && TITLES[eventType]) || "Thông báo mới";

/** Thông báo về hành trình: mở màn theo dõi chuyến thay vì chi tiết đơn. */
const JOURNEY_EVENTS = new Set([
  "CARE_ACTIVITY",
  "ORDER_LEG_PROGRESS",
  "LEG_COMPLETED",
  "LEG_MILESTONE_UPDATED",
  "INCIDENT_REPORTED",
  "HORSE_REPORT",
  "HORSE_REPORT_ALERT",
  "TRIP_ALERT",
]);

/** Màn cần mở (dạng Page của App.tsx). null: không có màn riêng, ở lại danh sách Thông báo. */
export function routeNotice(
  role: string,
  notice: Pick<Notice, "event_type" | "related_type" | "related_id" | "order_id" | "horse_id" | "document_id">,
): Page | null {
  const orderId =
    notice.order_id || (notice.related_type === "ORDER" ? notice.related_id : undefined);
  if (role === "CUSTOMER") {
    // Yêu cầu bổ sung giấy tờ: mở thẳng màn nộp lại của đúng con ngựa, đánh dấu giấy tờ cần nộp (mục 2).
    if (notice.event_type === "DOCUMENT_SUPPLEMENT" && notice.horse_id)
      return {
        screen: "doc-resubmit",
        id: String(notice.horse_id),
        orderId: orderId ? String(orderId) : undefined,
        documentId: notice.document_id ? String(notice.document_id) : undefined,
      };
    if (!orderId) return null;
    if (notice.event_type && JOURNEY_EVENTS.has(notice.event_type))
      return { screen: "tracking", id: String(orderId) };
    if (notice.event_type?.startsWith("DOCUMENT"))
      return { screen: "documents", id: String(orderId) };
    return { screen: "order", id: String(orderId) };
  }
  if (role === "DRIVER_ESCORT") {
    if (notice.related_type === "TRIP" && notice.related_id)
      return { screen: "trip", tripId: String(notice.related_id) };
    return null;
  }
  return null;
}
