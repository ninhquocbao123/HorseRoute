import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Kế hoạch 10 (docs/mobile-design/10-thanh-toan-mobile-plan.md), mục 7:
 * - Loại sự cố DELIVERY_ISSUE. Loại này không gắn với hư hại nên damage_target để NULL (cột đã cho phép).
 * - delivery_exceptions: quản lý duyệt cho giao khi còn nợ, điều phối mở cho tài xế. Mỗi đơn tối đa một dòng.
 * - leg_milestones.actual_recipient_*: người nhận thực tế khi người khác nhận thay.
 * Re-runnable. down() chỉ bỏ DELIVERY_ISSUE khi chưa có sự cố nào dùng, để không làm hỏng dữ liệu.
 */
const BASE_TYPES = "'VEHICLE_BREAKDOWN','LONG_TRAFFIC_JAM','HORSE_MEDICAL'";
const typeColumn = (types: string) =>
  `ALTER TABLE incidents MODIFY COLUMN incident_type ENUM(${types}) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL`;

export class DeliveryExceptions1800000093000 implements MigrationInterface {
  name = 'DeliveryExceptions1800000093000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(typeColumn(`${BASE_TYPES},'DELIVERY_ISSUE'`));
    await q.query(`CREATE TABLE IF NOT EXISTS delivery_exceptions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      order_id BIGINT UNSIGNED NOT NULL COMMENT 'FK -> orders.id',
      reason VARCHAR(500) NOT NULL COMMENT 'Lý do quản lý cho giao khi còn nợ',
      due_at DATETIME NULL COMMENT 'Hạn khách trả phần còn nợ',
      status ENUM('APPROVED','OPENED') NOT NULL DEFAULT 'APPROVED',
      approved_by BIGINT UNSIGNED NOT NULL COMMENT 'Quản lý duyệt',
      approved_at DATETIME NOT NULL,
      opened_by BIGINT UNSIGNED NULL COMMENT 'Người mở cho tài xế',
      opened_at DATETIME NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_delivery_exceptions_order (order_id),
      CONSTRAINT fk_delivery_exceptions_order FOREIGN KEY (order_id) REFERENCES orders (id),
      CONSTRAINT fk_delivery_exceptions_approved_by FOREIGN KEY (approved_by) REFERENCES users (id),
      CONSTRAINT fk_delivery_exceptions_opened_by FOREIGN KEY (opened_by) REFERENCES users (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Ngoại lệ giao ngựa khi chưa trả đủ'`);
    if (!(await q.hasColumn('leg_milestones', 'actual_recipient_name'))) {
      await q.query(`ALTER TABLE leg_milestones
        ADD COLUMN actual_recipient_name VARCHAR(120) NULL COMMENT 'Người nhận thực tế khi khác người nhận trên đơn',
        ADD COLUMN actual_recipient_phone VARCHAR(30) NULL`);
    }
  }

  async down(q: QueryRunner): Promise<void> {
    if (await q.hasColumn('leg_milestones', 'actual_recipient_name')) {
      await q.query('ALTER TABLE leg_milestones DROP COLUMN actual_recipient_name, DROP COLUMN actual_recipient_phone');
    }
    await q.query('DROP TABLE IF EXISTS delivery_exceptions');
    const [used] = await q.query("SELECT COUNT(*) AS n FROM incidents WHERE incident_type='DELIVERY_ISSUE'");
    if (Number(used.n) === 0) await q.query(typeColumn(BASE_TYPES));
  }
}
