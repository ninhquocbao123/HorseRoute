import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Check-in điểm nghỉ giữa đường của chuyến theo lộ trình mới (trips.route_plan): legs chỉ có một chặng đại diện
 * và leg_milestones chỉ có 4 loại mốc, nên mỗi lần tài xế tới một điểm nghỉ được ghi ở bảng riêng.
 * Chỉ thêm bảng mới (re-runnable); down() xóa dữ liệu check-in điểm nghỉ.
 */
export class LegWaypointCheckins1800000017000 implements MigrationInterface {
  name = 'LegWaypointCheckins1800000017000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS leg_waypoint_checkins (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      leg_id BIGINT UNSIGNED NOT NULL COMMENT 'FK -> legs.id',
      waypoint_id VARCHAR(64) NOT NULL COMMENT 'id điểm trong trips.route_plan.waypoints',
      waypoint_label VARCHAR(255) NOT NULL COMMENT 'Tên điểm tại thời điểm check-in',
      occurred_at DATETIME NOT NULL,
      recorded_by BIGINT UNSIGNED NOT NULL COMMENT 'FK -> users.id',
      PRIMARY KEY (id),
      UNIQUE KEY uq_leg_waypoint_checkins (leg_id, waypoint_id),
      KEY fk_leg_waypoint_checkins_user (recorded_by),
      CONSTRAINT fk_leg_waypoint_checkins_leg FOREIGN KEY (leg_id) REFERENCES legs (id),
      CONSTRAINT fk_leg_waypoint_checkins_user FOREIGN KEY (recorded_by) REFERENCES users (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Check-in điểm nghỉ giữa đường'`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE IF EXISTS leg_waypoint_checkins');
  }
}
