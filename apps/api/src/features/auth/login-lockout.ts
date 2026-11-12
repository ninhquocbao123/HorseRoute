/**
 * A2: tạm khóa đăng nhập theo tài khoản khi sai mật khẩu nhiều lần (bổ sung cho giới hạn theo IP của N15).
 * Lần sai ghi vào audit_logs (action LOGIN_FAILED) nên không cần migration và để lại dấu vết cho Admin.
 * Đếm các lần sai trong `WINDOW_MINUTES` gần nhất, ghi sau (theo id, vì occurred_at chỉ chính xác tới giây) lần "mở" gần nhất: đăng nhập đúng (LOGIN_RESET),
 * tự đặt lại mật khẩu qua email (RESET_PASSWORD_BY_EMAIL), Admin đặt lại mật khẩu (RESET_PASSWORD).
 */
import type { DataSource } from 'typeorm';

export const MAX_FAILED_LOGINS = 5;
export const WINDOW_MINUTES = 15;
const UNLOCK_ACTIONS = ['LOGIN_RESET', 'RESET_PASSWORD_BY_EMAIL', 'RESET_PASSWORD'];

/** Thời điểm hết khóa (ms) nếu tài khoản đang bị khóa, ngược lại null. */
export async function lockedUntil(db: DataSource, userId: string, now = Date.now()): Promise<number | null> {
  const rows: { at: Date | string }[] = await db.query(
    `SELECT f.occurred_at AS at FROM audit_logs f
     WHERE f.entity_type='USER' AND f.entity_id=? AND f.action='LOGIN_FAILED' AND f.occurred_at >= ?
       AND f.id > COALESCE((SELECT MAX(u.id) FROM audit_logs u WHERE u.entity_type='USER' AND u.entity_id=? AND u.action IN (?)), 0)
     ORDER BY f.id DESC LIMIT ?`,
    [userId, new Date(now - WINDOW_MINUTES * 60_000), userId, UNLOCK_ACTIONS, MAX_FAILED_LOGINS],
  );
  if (rows.length < MAX_FAILED_LOGINS) return null;
  // Khóa tới khi lần sai cũ nhất trong 5 lần gần nhất ra khỏi cửa sổ 15 phút.
  const oldest = new Date(rows[rows.length - 1].at).getTime();
  const until = oldest + WINDOW_MINUTES * 60_000;
  return until > now ? until : null;
}

export async function recordFailedLogin(db: DataSource, userId: string) {
  await db.query("INSERT INTO audit_logs(actor_id,entity_type,entity_id,action,old_value,new_value,reason) VALUES (?,'USER',?,'LOGIN_FAILED',NULL,NULL,NULL)", [userId, userId]);
}

/** Đăng nhập đúng sau vài lần sai: xóa bộ đếm (chỉ ghi khi có lần sai còn hiệu lực, không ghi mỗi lần đăng nhập). */
export async function clearFailedLogins(db: DataSource, userId: string, now = Date.now()) {
  const [row] = await db.query(
    `SELECT COUNT(*) n FROM audit_logs f WHERE f.entity_type='USER' AND f.entity_id=? AND f.action='LOGIN_FAILED' AND f.occurred_at >= ?
       AND f.id > COALESCE((SELECT MAX(u.id) FROM audit_logs u WHERE u.entity_type='USER' AND u.entity_id=? AND u.action IN (?)), 0)`,
    [userId, new Date(now - WINDOW_MINUTES * 60_000), userId, UNLOCK_ACTIONS],
  );
  if (Number(row?.n) > 0) await db.query("INSERT INTO audit_logs(actor_id,entity_type,entity_id,action,old_value,new_value,reason) VALUES (?,'USER',?,'LOGIN_RESET',NULL,NULL,NULL)", [userId, userId]);
}
