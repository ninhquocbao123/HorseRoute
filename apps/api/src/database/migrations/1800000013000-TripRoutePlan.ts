import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class TripRoutePlan1800000013000 implements MigrationInterface {
  name = 'TripRoutePlan1800000013000';

  async up(q: QueryRunner): Promise<void> {
    await q.addColumns('trips', [
      new TableColumn({ name: 'route_plan', type: 'json', isNullable: true }),
      new TableColumn({ name: 'route_plan_revision', type: 'int', unsigned: true, default: 0 }),
    ]);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.dropColumn('trips', 'route_plan_revision');
    await q.dropColumn('trips', 'route_plan');
  }
}
