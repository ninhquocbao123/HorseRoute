import { MigrationInterface, QueryRunner } from 'typeorm';
import { baselineTables } from '../baseline-schema';

// DB trống: dựng lược đồ gốc WDP v2. DB đã có bảng users theo v2 (như DB chung): bỏ qua, không đụng dữ liệu.
export class Init1700000000000 implements MigrationInterface {
  name = 'Init1700000000000';

  public async up(q: QueryRunner): Promise<void> {
    if (await q.hasTable('users')) {
      if (await q.hasColumn('users', 'full_name')) return;
      throw new Error('Bảng users không theo schema WDP v2. Không tự sửa để tránh mất dữ liệu.');
    }
    await q.query('SET FOREIGN_KEY_CHECKS=0');
    try {
      for (const statement of baselineTables) await q.query(statement);
    } finally {
      await q.query('SET FOREIGN_KEY_CHECKS=1');
    }
  }

  public async down(_q: QueryRunner): Promise<void> {
    throw new Error('Không tự động xóa bảng users có dữ liệu WDP.');
  }
}
