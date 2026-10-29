import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * route_plan là nguồn lộ trình của chuyến mới. legs chỉ còn một bản ghi vận hành đại diện,
 * vì vậy hai FK địa điểm phải nullable; chuyến legacy vẫn giữ nguyên các FK hiện có.
 */
export class RepresentativeTripLeg1800000016000 implements MigrationInterface {
  name = 'RepresentativeTripLeg1800000016000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE legs
      MODIFY from_location_id BIGINT UNSIGNED NULL COMMENT 'FK -> locations.id; NULL khi dùng trips.route_plan',
      MODIFY to_location_id BIGINT UNSIGNED NULL COMMENT 'FK -> locations.id; NULL khi dùng trips.route_plan'`);
  }

  async down(): Promise<void> {
    throw new Error('Không thể ép NOT NULL khi đã có chặng đại diện; hãy khôi phục từ backup đã kiểm chứng.');
  }
}
