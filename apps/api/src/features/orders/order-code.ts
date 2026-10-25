import { EntityManager } from 'typeorm';
import { ConflictException } from '../../shared/core/error.response';

export function orderCodePrefix(now = new Date()) {
  const day = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'}).format(now).replace(/-/g, '');
  return `VCN-${day}-`;
}

// The unique order_code index arbitrates concurrent inserts; callers retry a
// rolled-back transaction on a collision, so each retry sees committed codes.
export async function nextOrderCode(manager: EntityManager) {
  const prefix = orderCodePrefix();
  const [row] = await manager.query(
    'SELECT COALESCE(MAX(CAST(RIGHT(order_code,4) AS UNSIGNED)),0) AS last_number FROM orders WHERE order_code REGEXP ?',
    [`^${prefix}[0-9]{4}$`],
  );
  const next = Number(row.last_number) + 1;
  if (next > 9999) throw new ConflictException('Đã hết số thứ tự đơn trong ngày. Vui lòng liên hệ quản lý.');
  return prefix + String(next).padStart(4, '0');
}
