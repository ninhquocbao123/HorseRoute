import { MigrationInterface, QueryRunner } from 'typeorm';

// Driver redesign (gap-analysis-driver.md, step B): incident report fields from screen D2 and the order recipient
// shown on D1. Every column is NULLABLE with no DEFAULT, so existing rows stay valid and old clients keep working.
// incidents.sub_type is a free varchar on purpose: the allowed codes live in packages/shared (INCIDENT_SUB_TYPES),
// so adding a sub-type never needs a migration.
const COLUMNS: ReadonlyArray<[table: string, column: string, definition: string]> = [
  ['incidents', 'severity', "ENUM('RED','ORANGE','YELLOW') NULL COMMENT 'Mức độ do tài xế chọn' AFTER urgency"],
  ['incidents', 'sub_type', "VARCHAR(40) NULL COMMENT 'Mã loại con, danh sách trong packages/shared' AFTER severity"],
  ['incidents', 'damage_target', "ENUM('VEHICLE','HORSE','BOTH') NULL COMMENT 'Hư hại liên quan tới' AFTER sub_type"],
  ['incidents', 'latitude', "DECIMAL(9,6) NULL COMMENT 'Vĩ độ WGS84 lúc báo' AFTER damage_target"],
  ['incidents', 'longitude', "DECIMAL(9,6) NULL COMMENT 'Kinh độ WGS84 lúc báo' AFTER latitude"],
  ['incidents', 'location_text', "VARCHAR(255) NULL COMMENT 'Mô tả vị trí (reverse geocode)' AFTER longitude"],
  ['attachments', 'caption', "VARCHAR(100) NULL COMMENT 'Nhãn ảnh'"],
  ['orders', 'recipient_name', "VARCHAR(100) NULL COMMENT 'Người nhận tại điểm đến'"],
  ['orders', 'recipient_phone', "VARCHAR(20) NULL COMMENT 'SĐT người nhận' AFTER recipient_name"],
];

const CHECKS: ReadonlyArray<[name: string, expression: string]> = [
  ['ck_incidents_lat', 'latitude IS NULL OR latitude BETWEEN -90 AND 90'],
  ['ck_incidents_lng', 'longitude IS NULL OR longitude BETWEEN -180 AND 180'],
  ['ck_incidents_latlng_pair', '(latitude IS NULL) = (longitude IS NULL)'],
];

async function incidentChecks(q: QueryRunner): Promise<Set<string>> {
  return new Set((await q.query(
    "SELECT CONSTRAINT_NAME AS name FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'incidents' AND CONSTRAINT_TYPE = 'CHECK'",
  )).map((row: { name: string }) => row.name));
}

export class DriverIncidentDetails1800000007000 implements MigrationInterface {
  async up(q: QueryRunner) {
    for (const [table, column, definition] of COLUMNS) {
      if (!await q.hasColumn(table, column)) await q.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
    const existing = await incidentChecks(q);
    for (const [name, expression] of CHECKS) {
      if (!existing.has(name)) await q.query(`ALTER TABLE incidents ADD CONSTRAINT ${name} CHECK (${expression})`);
    }
  }

  async down(q: QueryRunner) {
    // CHECKs reference latitude/longitude, so they go before the columns.
    const existing = await incidentChecks(q);
    for (const [name] of [...CHECKS].reverse()) {
      if (existing.has(name)) await q.query(`ALTER TABLE incidents DROP CHECK ${name}`);
    }
    for (const [table, column] of [...COLUMNS].reverse()) {
      if (await q.hasColumn(table, column)) await q.query(`ALTER TABLE ${table} DROP COLUMN ${column}`);
    }
  }
}
