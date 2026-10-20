import { MigrationInterface, QueryRunner } from 'typeorm';

// location_routes: disposable route-geometry cache per location pair (expires via fetched_at), so it cascades
//   when a location is deleted. STRAIGHT rows record a failed Directions lookup so it is not retried every view.
// trip_positions: driver GPS, personal data purged after TRACK_POSITION_RETENTION_DAYS. The unique key makes
//   resending a queued batch idempotent (INSERT IGNORE).
export class TrackMap1800000006000 implements MigrationInterface {
  async up(q: QueryRunner) {
    if (!await q.hasTable('location_routes')) {
      await q.query(`CREATE TABLE location_routes (
        id bigint unsigned NOT NULL AUTO_INCREMENT,
        from_location_id bigint unsigned NOT NULL COMMENT 'FK -> locations.id',
        to_location_id bigint unsigned NOT NULL COMMENT 'FK -> locations.id',
        mode enum('ROAD','AIR','STRAIGHT') NOT NULL,
        coordinates json NOT NULL COMMENT '[[lng,lat],...] WGS84',
        distance_m int unsigned DEFAULT NULL,
        duration_s int unsigned DEFAULT NULL,
        fetched_at datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
        PRIMARY KEY (id),
        UNIQUE KEY uq_location_routes_pair_mode (from_location_id, to_location_id, mode),
        KEY idx_location_routes_to (to_location_id),
        CONSTRAINT fk_location_routes_from_location_id FOREIGN KEY (from_location_id) REFERENCES locations (id) ON DELETE CASCADE,
        CONSTRAINT fk_location_routes_to_location_id FOREIGN KEY (to_location_id) REFERENCES locations (id) ON DELETE CASCADE,
        CONSTRAINT ck_location_routes_coordinates CHECK (JSON_TYPE(coordinates) = 'ARRAY')
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cache hình học tuyến theo cặp địa điểm'`);
    }
    if (!await q.hasTable('trip_positions')) {
      await q.query(`CREATE TABLE trip_positions (
        id bigint unsigned NOT NULL AUTO_INCREMENT,
        trip_id bigint unsigned NOT NULL COMMENT 'FK -> trips.id',
        leg_id bigint unsigned DEFAULT NULL COMMENT 'FK -> legs.id (chặng lúc gửi)',
        user_id bigint unsigned NOT NULL COMMENT 'FK -> users.id (người gửi)',
        latitude decimal(9,6) NOT NULL,
        longitude decimal(9,6) NOT NULL,
        accuracy_m int unsigned DEFAULT NULL,
        speed_mps decimal(5,2) DEFAULT NULL,
        heading_deg smallint unsigned DEFAULT NULL,
        recorded_at datetime NOT NULL COMMENT 'Giờ trên thiết bị (UTC)',
        received_at datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
        PRIMARY KEY (id),
        UNIQUE KEY uq_trip_positions_point (trip_id, user_id, recorded_at),
        KEY idx_trip_positions_trip_time (trip_id, recorded_at),
        KEY idx_trip_positions_recorded (recorded_at),
        KEY idx_trip_positions_leg (leg_id),
        KEY idx_trip_positions_user (user_id),
        CONSTRAINT fk_trip_positions_trip_id FOREIGN KEY (trip_id) REFERENCES trips (id),
        CONSTRAINT fk_trip_positions_leg_id FOREIGN KEY (leg_id) REFERENCES legs (id),
        CONSTRAINT fk_trip_positions_user_id FOREIGN KEY (user_id) REFERENCES users (id),
        CONSTRAINT ck_trip_positions_lat CHECK (latitude BETWEEN -90 AND 90),
        CONSTRAINT ck_trip_positions_lng CHECK (longitude BETWEEN -180 AND 180),
        CONSTRAINT ck_trip_positions_speed CHECK (speed_mps IS NULL OR speed_mps >= 0),
        CONSTRAINT ck_trip_positions_heading CHECK (heading_deg IS NULL OR heading_deg < 360)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Vị trí GPS tài xế (tự xóa sau thời hạn lưu)'`);
    }
  }
  async down(q: QueryRunner) {
    // Cache and short-lived GPS only; no business record depends on these tables.
    await q.query('DROP TABLE IF EXISTS trip_positions');
    await q.query('DROP TABLE IF EXISTS location_routes');
  }
}
