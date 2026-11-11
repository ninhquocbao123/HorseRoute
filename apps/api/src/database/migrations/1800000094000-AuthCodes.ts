import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A2 (docs/ke-hoach-xu-ly-loi-10-11-2026.md): quên mật khẩu, xác minh email khi đăng ký, thu hồi phiên.
 * - users.token_version: tăng khi đổi, đặt lại mật khẩu hoặc khóa tài khoản; JWT mang số này, lệch là hết hiệu lực.
 * - auth_codes: mã 6 số dùng một lần gửi qua email, chỉ lưu bản băm, có hạn và giới hạn số lần nhập sai.
 * Chạy lại được.
 */
export class AuthCodes1800000094000 implements MigrationInterface {
  name = 'AuthCodes1800000094000';

  async up(q: QueryRunner): Promise<void> {
    const [column] = await q.query("SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='token_version'");
    if (!column) await q.query("ALTER TABLE users ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Tăng khi đổi mật khẩu hoặc khóa: JWT cũ hết hiệu lực'");
    await q.query(`CREATE TABLE IF NOT EXISTS auth_codes (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL COMMENT 'FK -> users.id',
      purpose ENUM('RESET_PASSWORD','VERIFY_EMAIL') NOT NULL,
      code_hash VARCHAR(100) NOT NULL COMMENT 'bcrypt của mã 6 số',
      attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
      PRIMARY KEY (id),
      KEY idx_auth_codes_user_purpose (user_id, purpose, created_at),
      CONSTRAINT fk_auth_codes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Mã một lần gửi qua email'`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE IF EXISTS auth_codes');
    const [column] = await q.query("SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='token_version'");
    if (column) await q.query('ALTER TABLE users DROP COLUMN token_version');
  }
}
