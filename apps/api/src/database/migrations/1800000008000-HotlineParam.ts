import { MigrationInterface, QueryRunner } from 'typeorm';

// Driver redesign (gap-analysis-driver.md 5.6, step F): the 24/7 rescue number shown on screen D2.
// INSERT IGNORE keeps a value an admin already set; down removes only the row this migration inserted.
const ROW = ['HOTLINE', '1900 1080', 'Số cứu hộ 24/7 hiển thị ở màn báo sự cố'];

export class HotlineParam1800000008000 implements MigrationInterface {
  name = 'HotlineParam1800000008000';

  async up(q: QueryRunner): Promise<void> {
    await q.query('INSERT IGNORE INTO system_parameters (param_code, param_value, description) VALUES (?, ?, ?)', ROW);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DELETE FROM system_parameters WHERE param_code = ? AND param_value = ? AND description = ?', ROW);
  }
}
