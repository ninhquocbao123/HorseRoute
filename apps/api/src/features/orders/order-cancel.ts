import { z } from 'zod';
import type { EntityManager } from 'typeorm';
import { Role } from '@my-project/shared';
import type { User } from '../users/users.model';
import { BadRequestException, ConflictException } from '../../shared/core/error.response';
import { syncTripResources } from '../trips/trip-resources';
import { parse } from '../../shared/utils/validation.util';

/**
 * A4 - Hủy đơn (quyết định Q2 của Long):
 * - Khách tự hủy khi đơn còn chờ duyệt hoặc cần bổ sung (chưa trả tiền). Đơn nháp thì xóa, không hủy.
 * - Quản lý hủy từ lúc chờ duyệt tới trước khi xe xuất phát, nêu lý do; đã thu tiền thì nhập số hoàn (0 nếu không hoàn).
 * - Xe đã xuất phát thì không hủy.
 * Hủy xong: trả xe và tổ lái đã giữ, hủy phiên thanh toán đang chờ, ghi audit, báo những người liên quan.
 */
export const cancelOrderSchema = z.object({
  reason: z.string().trim().max(255).optional(),
  refundAmount: z.number().int('Số tiền hoàn là số nguyên.').min(0, 'Số tiền hoàn không âm.').optional(),
}).strict();
export const CUSTOMER_CANCELLABLE = ['PENDING', 'NEED_INFO'];
export const MANAGER_CANCELLABLE = ['PENDING', 'NEED_INFO', 'APPROVED', 'PREPARING', 'READY'];
const fieldError = (fields: Record<string, string>) => new BadRequestException({ message: 'Vui lòng kiểm tra các trường được đánh dấu.', fields });
const vnd = (n: number) => n.toLocaleString('vi-VN') + ' đ';

type Order = { id: string | number; order_code: string; status: string; customer_id: string | number };
type Notify = (m: EntityManager, recipient: string, orderId: string, event: string, content: string) => Promise<void>;

export async function cancelOrder(m: EntityManager, user: User, order: Order, body: unknown, notify: Notify) {
  const dto = parse(cancelOrderSchema, body ?? {});
  const id = String(order.id);
  const customer = user.role === Role.CUSTOMER;
  const reason = dto.reason?.trim() || '';
  if (customer) {
    if (order.status === 'DRAFT') throw new ConflictException('Đơn nháp thì xóa, không cần hủy.');
    if (!CUSTOMER_CANCELLABLE.includes(order.status)) throw new ConflictException('Đơn đã được duyệt. Liên hệ quản lý để hủy và thỏa thuận hoàn cọc.');
    if (dto.refundAmount !== undefined) throw fieldError({ refundAmount: 'Chỉ quản lý quyết định số tiền hoàn.' });
  } else {
    if (!MANAGER_CANCELLABLE.includes(order.status)) throw new ConflictException(order.status === 'IN_TRANSIT' ? 'Xe đã xuất phát, không hủy được đơn.' : 'Đơn này không còn hủy được.');
    if (reason.length < 5) throw fieldError({ reason: 'Nêu lý do hủy, ít nhất 5 ký tự.' });
  }
  const [{ departed }] = await m.query(
    "SELECT COUNT(*) departed FROM legs l JOIN trips t ON t.id=l.trip_id WHERE t.order_id=? AND (l.actual_departure_at IS NOT NULL OR l.status<>'NOT_STARTED')", [id]);
  if (Number(departed)) throw new ConflictException('Xe đã xuất phát, không hủy được đơn.');
  const [{ paid }] = await m.query('SELECT COALESCE(SUM(amount),0) paid FROM order_receipts WHERE order_id=?', [id]);
  const paidBefore = Number(paid);
  if (paidBefore > 0 && dto.refundAmount === undefined) throw fieldError({ refundAmount: `Khách đã trả ${vnd(paidBefore)}. Nhập số tiền hoàn (0 nếu không hoàn).` });
  if ((dto.refundAmount ?? 0) > paidBefore) throw fieldError({ refundAmount: `Không hoàn quá số đã thu (${vnd(paidBefore)}).` });
  const refund = paidBefore > 0 ? dto.refundAmount! : 0;

  const result = await m.query("UPDATE orders SET status='CANCELLED' WHERE id=? AND status=?", [id, order.status]);
  if (!result.affectedRows) throw new ConflictException('Trạng thái đơn vừa thay đổi. Tải lại rồi thử lại.');
  if (paidBefore > 0) {
    await m.query('INSERT INTO order_refunds(order_id,amount,paid_before,reason,refunded_by) VALUES (?,?,?,?,?)', [id, refund, paidBefore, reason, user.id]);
  }
  await m.query("UPDATE payment_sessions SET status='CANCELLED' WHERE order_id=? AND status='PENDING'", [id]);
  // Đơn đã CANCELLED nên syncTripResources trả xe và tổ lái về rảnh (trừ khi đang thuộc chuyến khác).
  const trips: { id: string; plannedBy: string | null }[] = await m.query('SELECT CAST(id AS CHAR) id, CAST(planned_by AS CHAR) plannedBy FROM trips WHERE order_id=?', [id]);
  for (const trip of trips) await syncTripResources(m, trip.id, 'CANCELLED', String(user.id));
  await m.query("INSERT INTO audit_logs(actor_id,entity_type,entity_id,action,old_value,new_value,reason) VALUES (?,'ORDER',?,'CANCEL',?,?,?)",
    [user.id, id, JSON.stringify({ status: order.status, paid: paidBefore }), JSON.stringify({ status: 'CANCELLED', refund }), reason || null]);

  const text = `Đơn ${order.order_code} đã bị hủy${reason ? `: ${reason}` : ''}.`;
  if (customer) {
    const managers: { id: string }[] = await m.query("SELECT CAST(id AS CHAR) id FROM users WHERE role='MANAGER' AND account_status='ACTIVE'");
    for (const manager of managers) await notify(m, manager.id, id, 'ORDER_CANCELLED', `Khách đã tự hủy đơn ${order.order_code}${reason ? `: ${reason}` : ''}.`);
  } else {
    await notify(m, String(order.customer_id), id, 'ORDER_CANCELLED', paidBefore > 0 ? `${text} Số tiền được hoàn: ${vnd(refund)} trên ${vnd(paidBefore)} đã trả.` : text);
  }
  const crew: { id: string }[] = await m.query(
    `SELECT DISTINCT CAST(x.id AS CHAR) id FROM (SELECT a.user_id id FROM trip_assignments a JOIN trips t ON t.id=a.trip_id WHERE t.order_id=?
     UNION SELECT planned_by FROM trips WHERE order_id=? AND planned_by IS NOT NULL) x`, [id, id]);
  for (const person of crew) await notify(m, person.id, id, 'ORDER_CANCELLED', `${text} Chuyến của đơn này không chạy nữa.`);
  return { id, status: 'CANCELLED', paid: paidBefore, refund };
}
