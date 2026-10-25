import { MigrationInterface, QueryRunner } from 'typeorm';
export class ManagerQuotes1800000008000 implements MigrationInterface {
 name='ManagerQuotes1800000008000';
 async up(q:QueryRunner){
  await q.query(`CREATE TABLE IF NOT EXISTS order_quotes (
   id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, order_id BIGINT UNSIGNED NOT NULL,
   pricing_version_id BIGINT UNSIGNED NOT NULL, revision INT UNSIGNED NOT NULL DEFAULT 1,
   status ENUM('DRAFT','APPROVED','NEED_REVISION') NOT NULL DEFAULT 'DRAFT',
   input JSON NOT NULL, items JSON NOT NULL, subtotal BIGINT UNSIGNED NOT NULL,
   adjustment BIGINT NOT NULL DEFAULT 0, adjustment_reason VARCHAR(2000) NOT NULL,
   vat_percent DECIMAL(5,2) NOT NULL DEFAULT 0, vat_amount BIGINT UNSIGNED NOT NULL,
   total BIGINT UNSIGNED NOT NULL, deposit BIGINT UNSIGNED NOT NULL, deposit_percent DECIMAL(5,2) NOT NULL,
   validity_hours SMALLINT UNSIGNED NOT NULL, expires_at DATETIME(3) NULL,
   created_by BIGINT UNSIGNED NOT NULL, approved_by BIGINT UNSIGNED NULL,
   created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)), approved_at DATETIME(3) NULL,
   review_note VARCHAR(2000) NULL,
   KEY ix_quote_order(order_id,id), KEY ix_quote_status(status,approved_at),
   FOREIGN KEY(order_id) REFERENCES orders(id), FOREIGN KEY(pricing_version_id) REFERENCES pricing_versions(id),
   FOREIGN KEY(created_by) REFERENCES users(id), FOREIGN KEY(approved_by) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await q.query(`CREATE TABLE IF NOT EXISTS order_receipts (
   id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, order_id BIGINT UNSIGNED NOT NULL,
   quote_id BIGINT UNSIGNED NOT NULL, amount BIGINT UNSIGNED NOT NULL,
   reference VARCHAR(120) NOT NULL, received_at DATETIME(3) NOT NULL,
   recorded_by BIGINT UNSIGNED NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
   UNIQUE KEY uq_receipt_reference(reference), KEY ix_receipt_order(order_id,received_at),
   FOREIGN KEY(order_id) REFERENCES orders(id), FOREIGN KEY(quote_id) REFERENCES order_quotes(id),
   FOREIGN KEY(recorded_by) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
 }
 async down():Promise<void>{throw new Error('Không tự động xóa báo giá và lịch sử thu tiền.');}
}
