import { EntityManager } from 'typeorm';

/**
 * Đơn vừa trả đủ: báo tổ lái và điều phối của chuyến để tài xế đang đợi biết có thể giao.
 * Không ghi số tiền vì tổ lái không được xem. Đơn chưa có chuyến chạy thì không báo ai.
 */
export async function notifyDeliveryCleared(m: EntityManager, orderId: string | number, orderCode: string) {
  await m.query(
    `INSERT INTO notifications (recipient_id, event_type, content, related_type, related_id, channel)
     SELECT DISTINCT u.user_id, 'DELIVERY_CLEARED', ?, 'TRIP', t.id, 'IN_APP'
     FROM trips t
     JOIN orders o ON o.id = t.order_id AND o.status IN ('READY', 'IN_TRANSIT')
     JOIN (
       SELECT trip_id, user_id FROM trip_assignments
       UNION SELECT id, planned_by FROM trips
     ) u ON u.trip_id = t.id
     WHERE t.order_id = ? AND t.plan_status = 'APPROVED'`,
    [`Đơn ${orderCode} đã thanh toán đủ, tài xế có thể xác nhận giao ngựa.`, orderId]
  );
}
