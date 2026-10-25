import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentSimulation1800000012000 implements MigrationInterface {
  name = 'PaymentSimulation1800000012000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS payment_sessions (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      session_code VARCHAR(64) NOT NULL,
      order_id BIGINT UNSIGNED NOT NULL,
      quote_id BIGINT UNSIGNED NOT NULL,
      customer_id BIGINT UNSIGNED NOT NULL,
      payment_type ENUM('DEPOSIT','BALANCE') NOT NULL,
      payment_method ENUM('BANK_TRANSFER','E_WALLET','CARD') NOT NULL,
      amount BIGINT UNSIGNED NOT NULL,
      status ENUM('PENDING','SUCCESS','FAILED','CANCELLED') NOT NULL DEFAULT 'PENDING',
      failure_reason VARCHAR(500) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
      completed_at DATETIME(3) NULL,
      UNIQUE KEY uq_payment_session_code(session_code),
      KEY ix_pay_session_order(order_id, status),
      FOREIGN KEY(order_id) REFERENCES orders(id),
      FOREIGN KEY(quote_id) REFERENCES order_quotes(id),
      FOREIGN KEY(customer_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    const hasMethod = await q.query(`SHOW COLUMNS FROM order_receipts LIKE 'method'`);
    if (!hasMethod.length) {
      await q.query(`ALTER TABLE order_receipts ADD COLUMN method VARCHAR(32) NOT NULL DEFAULT 'BANK_TRANSFER' AFTER amount`);
    }

    const hasSource = await q.query(`SHOW COLUMNS FROM order_receipts LIKE 'source'`);
    if (!hasSource.length) {
      await q.query(`ALTER TABLE order_receipts ADD COLUMN source VARCHAR(32) NOT NULL DEFAULT 'MANUAL' AFTER method`);
    }

    const hasSessionId = await q.query(`SHOW COLUMNS FROM order_receipts LIKE 'session_id'`);
    if (!hasSessionId.length) {
      await q.query(`ALTER TABLE order_receipts ADD COLUMN session_id BIGINT UNSIGNED NULL AFTER source,
        ADD CONSTRAINT fk_receipt_session FOREIGN KEY(session_id) REFERENCES payment_sessions(id) ON DELETE SET NULL`);
    }
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE order_receipts DROP FOREIGN KEY fk_receipt_session`);
    await q.query(`ALTER TABLE order_receipts DROP COLUMN session_id, DROP COLUMN source, DROP COLUMN method`);
    await q.query(`DROP TABLE IF EXISTS payment_sessions`);
  }
}

