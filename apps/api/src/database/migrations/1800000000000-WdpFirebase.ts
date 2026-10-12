import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class WdpFirebase1800000000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    if (!await q.hasColumn('users', 'full_name')) throw new Error('Cần schema WDP v2. Không chạy migration này trên database myapp cũ.');
    if (!await q.hasColumn('users', 'firebase_uid')) {
      await q.addColumn('users', new TableColumn({ name: 'firebase_uid', type: 'varchar', length: '128', isNullable: true }));
    }
    const table = await q.getTable('users');
    if (!table?.indices.some(i => i.isUnique && i.columnNames.length === 1 && i.columnNames[0] === 'firebase_uid'))
      await q.createIndex('users', new TableIndex({ name: 'uq_users_firebase_uid', columnNames: ['firebase_uid'], isUnique: true }));
  }
  async down() { throw new Error('Không tự xóa liên kết Firebase. Cần kế hoạch khôi phục dữ liệu riêng.'); }
}
