import { MigrationInterface, QueryRunner } from 'typeorm';
export class CrewReservations1800000091000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query("ALTER TABLE crew_profiles MODIFY work_status ENUM('AVAILABLE','RESERVED','IN_TRIP') NOT NULL DEFAULT 'AVAILABLE'");
  }
  async down(q: QueryRunner): Promise<void> {
    const rows = await q.query("SELECT user_id FROM crew_profiles WHERE work_status='RESERVED' LIMIT 1");
    if(rows.length) throw new Error('Resolve RESERVED crew before reverting; no automatic resource release.');
    await q.query("ALTER TABLE crew_profiles MODIFY work_status ENUM('AVAILABLE','IN_TRIP') NOT NULL DEFAULT 'AVAILABLE'");
  }
}
