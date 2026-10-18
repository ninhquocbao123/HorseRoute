import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

// No backfill: current rules/checklists cannot prove what an old approval required.
export class OrderRequirements1800000004000 implements MigrationInterface {
  async up(q: QueryRunner) {
    if (!await q.hasColumn('orders', 'requirements_snapshot')) {
      await q.addColumn('orders', new TableColumn({ name: 'requirements_snapshot', type: 'json', isNullable: true }));
    }
  }
  async down() { throw new Error('Không xóa bản chụp yêu cầu của các đơn đã duyệt.'); }
}
