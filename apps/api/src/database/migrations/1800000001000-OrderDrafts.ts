import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/** Drafts may be incomplete. Operational horses are materialized only on submit. */
export class OrderDrafts1800000001000 implements MigrationInterface {
  async up(q: QueryRunner) {
    for (const name of ['origin_address', 'origin_country', 'destination_address', 'destination_country', 'desired_departure_date']) {
      const table = await q.getTable('orders');
      const old = table?.findColumnByName(name);
      if (!old) throw new Error('Cần schema WDP v2 trước khi chạy migration.');
      if (!old.isNullable) {
        const next = old.clone(); next.isNullable = true;
        await q.changeColumn('orders', old, next);
      }
    }
    for (const column of [
      new TableColumn({ name: 'draft_payload', type: 'json', isNullable: true }),
      new TableColumn({ name: 'client_request_id', type: 'varchar', length: '36', isNullable: true }),
    ]) if (!await q.hasColumn('orders', column.name)) await q.addColumn('orders', column);
    const table = await q.getTable('orders');
    if (!table?.indices.some(i => i.name === 'uq_orders_client_request')) await q.createIndex('orders', new TableIndex({ name: 'uq_orders_client_request', columnNames: ['customer_id', 'client_request_id'], isUnique: true }));
  }
  async down() { throw new Error('Không thu hẹp cột khi còn dữ liệu nháp chưa hoàn thiện.'); }
}
