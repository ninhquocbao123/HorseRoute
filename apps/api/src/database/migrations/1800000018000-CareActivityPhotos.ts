import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ảnh cập nhật cho khách khi hộ tống ghi nhật ký chăm sóc (cho ăn / uống nước / nghỉ chân):
 * attachments thêm FK care_activity_id (NULLABLE, dữ liệu cũ giữ nguyên). Re-runnable: chỉ thêm khi chưa có.
 * down() xóa các tệp đính kèm của nhật ký chăm sóc rồi bỏ cột.
 */
const COLUMN = 'care_activity_id';
const FK = 'fk_attachments_care_activity_id';

async function hasColumn(q: QueryRunner): Promise<boolean> {
  const rows = await q.query(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = \'attachments\' AND COLUMN_NAME = ?',
    [COLUMN],
  );
  return rows.length > 0;
}

async function hasForeignKey(q: QueryRunner): Promise<boolean> {
  const rows = await q.query(
    'SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = \'attachments\' AND CONSTRAINT_NAME = ?',
    [FK],
  );
  return rows.length > 0;
}

export class CareActivityPhotos1800000018000 implements MigrationInterface {
  name = 'CareActivityPhotos1800000018000';

  async up(q: QueryRunner): Promise<void> {
    if (!(await hasColumn(q))) {
      await q.query(`ALTER TABLE attachments ADD COLUMN ${COLUMN} BIGINT UNSIGNED NULL COMMENT 'FK -> horse_care_activities.id' AFTER incident_id`);
    }
    if (!(await hasForeignKey(q))) {
      await q.query(`ALTER TABLE attachments ADD CONSTRAINT ${FK} FOREIGN KEY (${COLUMN}) REFERENCES horse_care_activities (id)`);
    }
  }

  async down(q: QueryRunner): Promise<void> {
    if (await hasForeignKey(q)) await q.query(`ALTER TABLE attachments DROP FOREIGN KEY ${FK}`);
    if (await hasColumn(q)) {
      await q.query(`DELETE FROM attachments WHERE ${COLUMN} IS NOT NULL`);
      await q.query(`ALTER TABLE attachments DROP COLUMN ${COLUMN}`);
    }
  }
}
