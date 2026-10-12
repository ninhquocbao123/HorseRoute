import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1700000000000 implements MigrationInterface {
  name = 'Init1700000000000';

  public async up(q: QueryRunner): Promise<void> {
    if (await q.hasColumn('users', 'full_name')) return;
    throw new Error('Hãy chuẩn bị schema WDP v2 trước. Migration cũ không còn được dùng để tạo bảng users.');
  }

  public async down(_q: QueryRunner): Promise<void> {
    throw new Error('Không tự động xóa bảng users có dữ liệu WDP.');
  }
}

