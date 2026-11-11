import { EntityManager } from 'typeorm';

/**
 * Hệ quả của một khoản tiền vừa ghi vào order_receipts, dùng chung cho thanh toán trực tuyến và biên nhận thủ công của quản lý:
 * đủ cọc khi đơn đang APPROVED thì chuyển PREPARING; trả đủ toàn bộ thì ghi audit FULLY_PAID và báo tổ lái đang chờ giao.
 * Trả về trạng thái đơn sau khi áp dụng.
 */
export async function settleReceipt(m: EntityManager, input: {
  orderId: string | number; orderCode: string; orderStatus: string; deposit: number; total: number; paidAfter: number; actorId: string | number;
}): Promise<string> {
  let status = input.orderStatus;
  if (input.orderStatus === 'APPROVED' && input.paidAfter >= input.deposit) {
    status = 'PREPARING';
    await m.query("UPDATE orders SET status='PREPARING' WHERE id=? AND status='APPROVED'", [input.orderId]);
    await m.query(
      "INSERT INTO audit_logs (actor_id, entity_type, entity_id, action, new_value, reason) VALUES (?, 'ORDER', ?, 'STATUS_CHANGE', ?, ?)",
      [input.actorId, input.orderId, JSON.stringify({ status: 'PREPARING', trigger: 'DEPOSIT_PAID', paid: input.paidAfter }), 'Đã đủ tiền đặt cọc, chuyển sang chuẩn bị chuyến'],
    );
  }
  if (input.paidAfter >= input.total) {
    await m.query(
      "INSERT INTO audit_logs (actor_id, entity_type, entity_id, action, new_value, reason) VALUES (?, 'ORDER', ?, 'FULLY_PAID', ?, ?)",
      [input.actorId, input.orderId, JSON.stringify({ paid: input.paidAfter, total: input.total }), 'Đã thanh toán đủ toàn bộ chi phí vận chuyển'],
    );
    await notifyDeliveryCleared(m, input.orderId, input.orderCode);
  }
  return status;
}

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
