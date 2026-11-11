import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A4 (docs/ke-hoach-xu-ly-loi-10-11-2026.md): hủy đơn và hoàn cọc.
 * order_receipts.amount là số không dấu nên tiền hoàn ghi ở bảng riêng; mỗi đơn hoàn tối đa một lần, khi hủy.
 * Chạy lại được. down() chỉ xóa bảng khi chưa có khoản hoàn nào.
 */
export class OrderRefunds1800000095000 implements MigrationInterface {
  name = 'OrderRefunds1800000095000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS order_refunds (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      order_id BIGINT UNSIGNED NOT NULL COMMENT 'FK -> orders.id',
      amount BIGINT UNSIGNED NOT NULL COMMENT 'Số tiền hoàn cho khách (VND), không vượt số đã thu',
      paid_before BIGINT UNSIGNED NOT NULL COMMENT 'Tổng đã thu tại lúc hủy',
      reason VARCHAR(255) NOT NULL COMMENT 'Lý do hủy và mức hoàn',
      refunded_by BIGINT UNSIGNED NOT NULL COMMENT 'Quản lý quyết định',
      refunded_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
      PRIMARY KEY (id),
      UNIQUE KEY uq_order_refunds_order (order_id),
      CONSTRAINT fk_order_refunds_order FOREIGN KEY (order_id) REFERENCES orders (id),
      CONSTRAINT fk_order_refunds_user FOREIGN KEY (refunded_by) REFERENCES users (id),
      CONSTRAINT ck_order_refunds_amount CHECK (amount <= paid_before)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Hoàn tiền khi hủy đơn'`);
  }

  async down(q: QueryRunner): Promise<void> {
    const [row] = await q.query("SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_refunds'");
    if (!Number(row.n)) return;
    const [used] = await q.query('SELECT COUNT(*) n FROM order_refunds');
    if (Number(used.n)) throw new Error('Đã có khoản hoàn tiền; không tự động xóa bảng order_refunds.');
    await q.query('DROP TABLE order_refunds');
  }
}
