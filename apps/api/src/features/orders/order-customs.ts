/**
 * B13: thông tin thông quan của chuyến quốc tế, lưu trong orders.booking_details (không cần migration).
 * - customsCode: số tờ khai hải quan (thường chỉ có sau khi có giấy kiểm dịch, nên đặt đơn không bắt buộc).
 * - importPermit: số giấy phép nhập khẩu của nước nhận.
 * - border: cửa khẩu dự kiến (tự lập lộ trình ưu tiên cửa khẩu này).
 */
import { z } from 'zod';
import { EntityManager } from 'typeorm';
import { Role } from '@my-project/shared';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '../../shared/core/error.response';
import { User } from '../users/users.model';

export const customsInfoSchema = z.object({
  customsCode: z.string().trim().max(80),
  importPermit: z.string().trim().max(80),
  border: z.string().trim().max(120),
}).strict();
export type CustomsInfo = z.infer<typeof customsInfoSchema>;

/** Sau khi gửi đơn tới trước khi giao xong: khách, chuyên viên, quản lý bổ sung được. Đơn nháp/cần bổ sung sửa trong form đặt đơn. */
export const CUSTOMS_EDITABLE = ['PENDING', 'APPROVED', 'PREPARING', 'READY', 'IN_TRANSIT'];

const json = (value: unknown): Record<string, any> | null => {
  if (!value) return null;
  if (typeof value === 'string') { try { return JSON.parse(value); } catch { return null; } }
  return value as Record<string, any>;
};
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
export const customsOf = (bookingDetails: unknown): CustomsInfo => {
  const booking = json(bookingDetails) ?? {};
  return { customsCode: text(booking.customsCode), importPermit: text(booking.importPermit), border: text(booking.border) };
};
export const isInternational = (origin: string | null | undefined, destination: string | null | undefined) =>
  !!origin && !!destination && origin.trim().toUpperCase() !== destination.trim().toUpperCase();

export async function updateCustoms(m: EntityManager, user: User, id: string, body: unknown) {
  if (![Role.CUSTOMER, Role.SPECIALIST, Role.MANAGER].includes(user.role as Role)) throw new ForbiddenException('Không đủ quyền sửa thông tin thông quan.');
  const parsed = customsInfoSchema.safeParse(body);
  if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Thông tin thông quan không hợp lệ.');
  const [order] = await m.query('SELECT id,order_code,customer_id,status,origin_country,destination_country,booking_details FROM orders WHERE id=? FOR UPDATE', [id]);
  if (!order || (user.role === Role.CUSTOMER && String(order.customer_id) !== String(user.id))) throw new NotFoundException('Không tìm thấy đơn.');
  if (!isInternational(order.origin_country, order.destination_country)) throw new ConflictException('Chỉ chuyến quốc tế mới có thông tin thông quan.');
  if (!CUSTOMS_EDITABLE.includes(order.status)) throw new ConflictException('Đơn ở trạng thái này không sửa được thông tin thông quan.');
  const before = customsOf(order.booking_details), after = parsed.data;
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    const booking = { ...(json(order.booking_details) ?? {}), ...after };
    await m.query('UPDATE orders SET booking_details=? WHERE id=?', [JSON.stringify(booking), id]);
    await m.query("INSERT INTO audit_logs(actor_id,entity_type,entity_id,action,old_value,new_value) VALUES (?,'ORDER',?,'UPDATE_CUSTOMS',?,?)",
      [user.id, id, JSON.stringify(before), JSON.stringify(after)]);
    // Điều phối viên phụ trách cần biết khi khách hay chuyên viên vừa bổ sung số tờ khai.
    const [trip] = await m.query('SELECT planned_by FROM trips WHERE order_id=? AND planned_by IS NOT NULL LIMIT 1', [id]);
    if (trip?.planned_by && String(trip.planned_by) !== String(user.id)) {
      await m.query("INSERT INTO notifications(recipient_id,event_type,content,related_type,related_id,channel) VALUES (?,'ORDER_CUSTOMS_UPDATED',?,'ORDER',?,'IN_APP')",
        [trip.planned_by, after.customsCode ? `Đơn ${order.order_code} đã có số tờ khai hải quan ${after.customsCode}.` : `Đơn ${order.order_code} vừa cập nhật thông tin thông quan.`, id]);
    }
  }
  return { id: String(id), ...after };
}
