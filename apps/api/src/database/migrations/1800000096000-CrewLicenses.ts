import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Mục 1 (doc/fix_final/hoan_thien_19-11-2026.md): bằng lái của tổ lái.
 * Thêm cột có thể để trống vào crew_profiles, không đổi dữ liệu cũ. Chạy lại được.
 */
const COLUMNS: [string, string][] = [
  ['license_number', "VARCHAR(20) NULL COMMENT 'Số giấy phép lái xe (12 chữ số)'"],
  ['license_class', "VARCHAR(5) NULL COMMENT 'Hạng bằng lái: B, C, D, E, FC...'"],
  ['license_expires_on', "DATE NULL COMMENT 'Ngày hết hạn bằng lái'"],
];

export class CrewLicenses1800000096000 implements MigrationInterface {
  name = 'CrewLicenses1800000096000';

  async up(q: QueryRunner): Promise<void> {
    for (const [name, definition] of COLUMNS) {
      const [exists] = await q.query("SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='crew_profiles' AND COLUMN_NAME=?", [name]);
      if (!exists) await q.query(`ALTER TABLE crew_profiles ADD COLUMN ${name} ${definition}`);
    }
  }

  async down(q: QueryRunner): Promise<void> {
    for (const [name] of [...COLUMNS].reverse()) {
      const [exists] = await q.query("SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='crew_profiles' AND COLUMN_NAME=?", [name]);
      if (exists) await q.query(`ALTER TABLE crew_profiles DROP COLUMN ${name}`);
    }
  }
}
