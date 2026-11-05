import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * G2 (docs/mobile-design/01-data-inventory.md): hàng chờ trên mobile gửi lại khi mất phản hồi, cùng một mục không được tạo hai bản ghi.
 * Khóa theo người tạo + mã do máy sinh, giống orders.client_request_id. Dữ liệu cũ để NULL (MySQL cho nhiều NULL trong khóa duy nhất).
 * Re-runnable; down() bỏ cột và khóa, không mất dữ liệu nghiệp vụ.
 */
const TABLES = [
  { table: 'incidents', owner: 'reported_by', index: 'uq_incidents_client_request' },
  { table: 'horse_logs', owner: 'created_by', index: 'uq_horse_logs_client_request' },
  { table: 'horse_care_activities', owner: 'created_by', index: 'uq_care_client_request' },
];

export class ClientRequestIds1800000092000 implements MigrationInterface {
  name = 'ClientRequestIds1800000092000';

  async up(q: QueryRunner): Promise<void> {
    for (const { table, index, owner } of TABLES) {
      if (!(await q.hasColumn(table, 'client_request_id'))) {
        await q.query(`ALTER TABLE ${table} ADD COLUMN client_request_id VARCHAR(64) NULL COMMENT 'Mã do máy sinh để chống gửi trùng (G2)'`);
      }
      const existing = await q.query(`SHOW INDEX FROM ${table} WHERE Key_name = ?`, [index]);
      if (!existing.length) await q.query(`ALTER TABLE ${table} ADD UNIQUE KEY ${index} (${owner}, client_request_id)`);
    }
  }

  async down(q: QueryRunner): Promise<void> {
    for (const { table, index } of TABLES) {
      const existing = await q.query(`SHOW INDEX FROM ${table} WHERE Key_name = ?`, [index]);
      if (existing.length) await q.query(`ALTER TABLE ${table} DROP INDEX ${index}`);
      if (await q.hasColumn(table, 'client_request_id')) await q.query(`ALTER TABLE ${table} DROP COLUMN client_request_id`);
    }
  }
}
