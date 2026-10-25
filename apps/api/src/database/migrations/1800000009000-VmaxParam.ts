import { MigrationInterface, QueryRunner } from 'typeorm';

// Driver redesign (gap-analysis-driver.md 5.6, step H1): speed limit shown next to GPS speed on screen D1b.
// INSERT IGNORE keeps a value an admin already set; down removes only the row this migration inserted.
const ROW = ['VMAX', '80', 'Giới hạn tốc độ (km/h) hiển thị ở màn tài xế'];

export class VmaxParam1800000009000 implements MigrationInterface {
  name = 'VmaxParam1800000009000';

  async up(q: QueryRunner): Promise<void> {
    await q.query('INSERT IGNORE INTO system_parameters (param_code, param_value, description) VALUES (?, ?, ?)', ROW);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DELETE FROM system_parameters WHERE param_code = ? AND param_value = ? AND description = ?', ROW);
  }
}
