import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
import type { EntityManager } from 'typeorm';

// Mã 6 số dùng một lần gửi qua email (quên mật khẩu, xác minh email). Chỉ lưu bcrypt của mã.
export type CodePurpose = 'RESET_PASSWORD' | 'VERIFY_EMAIL';
export const CODE_TTL_MINUTES = 15;
export const CODE_MAX_ATTEMPTS = 5;
/** Không gửi mã mới cho cùng người và mục đích trong khoảng này, chống spam hộp thư. */
export const CODE_RESEND_SECONDS = 60;

export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

/** Tạo mã mới, vô hiệu mã cũ cùng mục đích. Trả null nếu vừa gửi chưa quá CODE_RESEND_SECONDS. */
export async function issueCode(m: EntityManager, userId: string, purpose: CodePurpose): Promise<string | null> {
  const [recent] = await m.query(
    'SELECT id FROM auth_codes WHERE user_id=? AND purpose=? AND used_at IS NULL AND created_at > UTC_TIMESTAMP() - INTERVAL ? SECOND FOR UPDATE',
    [userId, purpose, CODE_RESEND_SECONDS],
  );
  if (recent) return null;
  await m.query('UPDATE auth_codes SET used_at=UTC_TIMESTAMP() WHERE user_id=? AND purpose=? AND used_at IS NULL', [userId, purpose]);
  const code = newCode();
  await m.query('INSERT INTO auth_codes(user_id,purpose,code_hash,expires_at) VALUES (?,?,?,UTC_TIMESTAMP() + INTERVAL ? MINUTE)',
    [userId, purpose, await bcrypt.hash(code, 8), CODE_TTL_MINUTES]);
  return code;
}

/** Kiểm tra mã còn hiệu lực. Sai thì tăng số lần nhập; quá CODE_MAX_ATTEMPTS thì mã hết dùng được. Đúng thì đánh dấu đã dùng. */
export async function consumeCode(m: EntityManager, userId: string, purpose: CodePurpose, code: string): Promise<'ok' | 'invalid' | 'expired'> {
  const [row] = await m.query(
    `SELECT id,code_hash,attempts,expires_at < UTC_TIMESTAMP() expired FROM auth_codes
     WHERE user_id=? AND purpose=? AND used_at IS NULL ORDER BY id DESC LIMIT 1 FOR UPDATE`,
    [userId, purpose],
  );
  if (!row || Number(row.expired) === 1 || Number(row.attempts) >= CODE_MAX_ATTEMPTS) return 'expired';
  if (!/^\d{6}$/.test(code) || !await bcrypt.compare(code, row.code_hash)) {
    await m.query('UPDATE auth_codes SET attempts=attempts+1 WHERE id=?', [row.id]);
    return Number(row.attempts) + 1 >= CODE_MAX_ATTEMPTS ? 'expired' : 'invalid';
  }
  await m.query('UPDATE auth_codes SET used_at=UTC_TIMESTAMP() WHERE id=?', [row.id]);
  return 'ok';
}
