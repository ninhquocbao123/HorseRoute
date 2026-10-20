import { MigrationInterface, QueryRunner } from 'typeorm';

// Approximate WGS84 seed for the 20 shared locations, matched by name+country and only where still empty,
// so coordinates a Specialist has already pinned are never overwritten. Airports are reliable; border gates,
// stations and stops are area-level (OpenStreetMap, ODbL) and should be re-pinned on the map.
const SEED: ReadonlyArray<[name: string, country: string, latitude: number, longitude: number]> = [
  ['Sân bay quốc tế Tân Sơn Nhất', 'VN', 10.8188, 106.652],
  ['Sân bay quốc tế Nội Bài', 'VN', 21.2187, 105.8072],
  ['Cửa khẩu Mộc Bài', 'VN', 11.076, 106.158],
  ['Trạm kiểm dịch Củ Chi', 'VN', 10.9744, 106.4949],
  ['Điểm dừng nghỉ Long Thành', 'VN', 10.7815, 106.9543],
  ['Trạm xăng Dầu Giây', 'VN', 10.9431, 107.1401],
  ['Changi Airport', 'SG', 1.3644, 103.9915],
  ['Tuas Checkpoint', 'SG', 1.3484, 103.6358],
  ['Hong Kong International Airport', 'HK', 22.308, 113.9185],
  ['Narita International Airport', 'JP', 35.772, 140.3929],
  ['Sydney Kingsford Smith Airport', 'AU', -33.9399, 151.1753],
  ['Melbourne Airport', 'AU', -37.669, 144.841],
  ['Incheon International Airport', 'KR', 37.4602, 126.4407],
  ['Kuala Lumpur International Airport', 'MY', 2.7456, 101.7099],
  ['Cửa khẩu Bavet', 'KH', 11.074, 106.1545],
  ['Narita Animal Quarantine Station', 'JP', 35.76, 140.38],
  ['Sha Tin Quarantine Stable', 'HK', 22.3997, 114.2044],
  ['Điểm dừng nghỉ Bến Lức', 'VN', 10.643, 106.4825],
  ['Trạm xăng Trảng Bom', 'VN', 10.9531, 107.0042],
  ['Bukit Kayu Hitam Border', 'MY', 6.5053, 100.4208],
];

const CHECKS: ReadonlyArray<[name: string, expression: string]> = [
  ['ck_locations_lat', 'latitude IS NULL OR latitude BETWEEN -90 AND 90'],
  ['ck_locations_lng', 'longitude IS NULL OR longitude BETWEEN -180 AND 180'],
  ['ck_locations_coords_pair', '(latitude IS NULL) = (longitude IS NULL)'],
];

export class LocationCoordinates1800000005000 implements MigrationInterface {
  async up(q: QueryRunner) {
    if (!await q.hasColumn('locations', 'latitude')) {
      await q.query("ALTER TABLE locations ADD COLUMN latitude DECIMAL(9,6) NULL COMMENT 'Vĩ độ WGS84' AFTER address");
    }
    if (!await q.hasColumn('locations', 'longitude')) {
      await q.query("ALTER TABLE locations ADD COLUMN longitude DECIMAL(9,6) NULL COMMENT 'Kinh độ WGS84' AFTER latitude");
    }
    const existing = new Set((await q.query(
      "SELECT CONSTRAINT_NAME AS name FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'locations' AND CONSTRAINT_TYPE = 'CHECK'",
    )).map((row: { name: string }) => row.name));
    for (const [name, expression] of CHECKS) {
      if (!existing.has(name)) await q.query(`ALTER TABLE locations ADD CONSTRAINT ${name} CHECK (${expression})`);
    }
    for (const [name, country, latitude, longitude] of SEED) {
      await q.query(
        'UPDATE locations SET latitude = ?, longitude = ? WHERE name = ? AND country = ? AND latitude IS NULL AND longitude IS NULL',
        [latitude, longitude, name, country],
      );
    }
  }
  async down() { throw new Error('Không xóa tọa độ địa điểm do Specialist đã ghim.'); }
}
