import { MigrationInterface, QueryRunner } from 'typeorm';
export class TripFleet1800000015000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE trip_vehicles (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      trip_id BIGINT UNSIGNED NOT NULL,
      vehicle_id BIGINT UNSIGNED NOT NULL,
      horse_count INT UNSIGNED NULL,
      UNIQUE KEY uq_trip_vehicle(trip_id,vehicle_id),
      UNIQUE KEY uq_trip_vehicle_owner(id,trip_id),
      FOREIGN KEY(trip_id) REFERENCES trips(id),
      FOREIGN KEY(vehicle_id) REFERENCES vehicles(id)
    ) ENGINE=InnoDB`);
    await q.query(`ALTER TABLE trip_assignments ADD COLUMN trip_vehicle_id BIGINT UNSIGNED NULL,
      ADD CONSTRAINT fk_assignment_trip_vehicle FOREIGN KEY(trip_vehicle_id,trip_id) REFERENCES trip_vehicles(id,trip_id)`);
    // Preserve legacy vehicles. Only unambiguous one-vehicle rosters can be linked automatically.
    await q.query(`INSERT INTO trip_vehicles(trip_id,vehicle_id) SELECT DISTINCT trip_id,vehicle_id FROM legs WHERE vehicle_id IS NOT NULL`);
    await q.query(`UPDATE trip_vehicles tv JOIN
      (SELECT trip_id,MIN(id) id FROM trip_vehicles GROUP BY trip_id HAVING COUNT(*)=1) one_vehicle ON one_vehicle.id=tv.id
      JOIN trips t ON t.id=tv.trip_id
      SET tv.horse_count=(SELECT COUNT(*) FROM horses h WHERE h.order_id=t.order_id AND h.order_status='NORMAL')`);
    await q.query(`UPDATE trip_assignments a JOIN
      (SELECT trip_id,MIN(id) AS id FROM trip_vehicles GROUP BY trip_id HAVING COUNT(*)=1) v
      ON v.trip_id=a.trip_id SET a.trip_vehicle_id=v.id`);
  }
  async down(): Promise<void> { throw new Error('Không tự xóa phân công nhiều xe; khôi phục bằng kế hoạch dữ liệu đã kiểm chứng.'); }
}
