import { MigrationInterface, QueryRunner } from 'typeorm';

// Escort redesign (gap-analysis-escort.md, step 1): health-report fields on horse_logs and the new table
// horse_care_activities (feeding / watering / rest log). Every new horse_logs column is NULLABLE, except
// send_to_customer which has DEFAULT 0, so existing rows stay valid and old clients keep working.
// Both tables stay append-only: corrections point to the original row (corrects_log_id / corrects_activity_id).
// Re-runnable: columns, tables, indexes and CHECKs are created only when missing.
// down() drops the new report data and care activities; old horse_logs rows are kept.
const LOG_COLUMNS: ReadonlyArray<[column: string, definition: string]> = [
  ['body_temp_c', "DECIMAL(3,1) NULL COMMENT 'Nhiệt độ (°C)' AFTER note"],
  ['heart_rate_bpm', "SMALLINT UNSIGNED NULL COMMENT 'Nhịp tim (lần/phút)' AFTER body_temp_c"],
  ['appetite', "ENUM('NORMAL','REDUCED','REFUSED') NULL COMMENT 'Ăn uống' AFTER heart_rate_bpm"],
  ['customer_note', "VARCHAR(1000) NULL COMMENT 'Ghi chú gửi khách (tách khỏi note nội bộ)' AFTER appetite"],
  ['report_status', "ENUM('DRAFT','SENT') NULL COMMENT 'NULL = nhật ký cũ, không phải báo cáo' AFTER customer_note"],
  ['send_to_customer', "TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Gửi thông báo tới khách khi gửi báo cáo' AFTER report_status"],
  ['sent_at', "DATETIME NULL COMMENT 'Lúc gửi báo cáo (UTC)' AFTER send_to_customer"],
  ['customer_viewed_at', "DATETIME NULL COMMENT 'Lúc khách mở báo cáo lần đầu (UTC)' AFTER sent_at"],
];

const LOG_CHECKS: ReadonlyArray<[name: string, expression: string]> = [
  ['ck_horse_logs_temp', 'body_temp_c IS NULL OR body_temp_c BETWEEN 30.0 AND 45.0'],
  ['ck_horse_logs_hr', 'heart_rate_bpm IS NULL OR heart_rate_bpm BETWEEN 10 AND 200'],
  ['ck_horse_logs_sent', "report_status IS NULL OR report_status = 'DRAFT' OR sent_at IS NOT NULL"],
  ['ck_horse_logs_viewed', "customer_viewed_at IS NULL OR report_status = 'SENT'"],
];

const LOG_INDEX = 'idx_horse_logs_report';

const CARE_CHECKS: ReadonlyArray<[name: string, expression: string]> = [
  ['ck_care_horse', "activity_type = 'REST' OR horse_id IS NOT NULL"],
  ['ck_care_feed', "activity_type <> 'FEED' OR (amount_liters IS NULL AND duration_minutes IS NULL)"],
  ['ck_care_water', "activity_type <> 'WATER' OR (amount_liters IS NOT NULL AND amount_liters BETWEEN 0.1 AND 200 AND feed_description IS NULL AND duration_minutes IS NULL)"],
  ['ck_care_rest', "activity_type <> 'REST' OR (duration_minutes IS NOT NULL AND duration_minutes BETWEEN 1 AND 720 AND feed_description IS NULL AND amount_liters IS NULL)"],
];

async function checksOf(q: QueryRunner, table: string): Promise<Set<string>> {
  return new Set((await q.query(
    'SELECT CONSTRAINT_NAME AS name FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_TYPE = \'CHECK\'',
    [table],
  )).map((row: { name: string }) => row.name));
}

async function hasIndex(q: QueryRunner, table: string, index: string): Promise<boolean> {
  return (await q.query(`SHOW INDEX FROM ${table} WHERE Key_name = ?`, [index])).length > 0;
}

export class EscortHorseCare1800000013000 implements MigrationInterface {
  name = 'EscortHorseCare1800000013000';

  async up(q: QueryRunner) {
    for (const [column, definition] of LOG_COLUMNS) {
      if (!await q.hasColumn('horse_logs', column)) await q.query(`ALTER TABLE horse_logs ADD COLUMN ${column} ${definition}`);
    }
    const logChecks = await checksOf(q, 'horse_logs');
    for (const [name, expression] of LOG_CHECKS) {
      if (!logChecks.has(name)) await q.query(`ALTER TABLE horse_logs ADD CONSTRAINT ${name} CHECK (${expression})`);
    }
    if (!await hasIndex(q, 'horse_logs', LOG_INDEX)) {
      await q.query(`ALTER TABLE horse_logs ADD INDEX ${LOG_INDEX} (horse_id, report_status, logged_at)`);
    }

    await q.query(`CREATE TABLE IF NOT EXISTS horse_care_activities (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      trip_id BIGINT UNSIGNED NOT NULL COMMENT 'FK -> trips.id',
      leg_id BIGINT UNSIGNED NULL COMMENT 'FK -> legs.id (chặng lúc ghi)',
      horse_id BIGINT UNSIGNED NULL COMMENT 'FK -> horses.id; NULL = cả đoàn (chỉ REST)',
      activity_type ENUM('FEED','WATER','REST') NOT NULL,
      feed_description VARCHAR(200) NULL COMMENT 'Khẩu phần (FEED)',
      amount_liters DECIMAL(5,1) NULL COMMENT 'Lượng nước (WATER)',
      duration_minutes SMALLINT UNSIGNED NULL COMMENT 'Thời gian nghỉ (REST)',
      note VARCHAR(255) NULL,
      performed_at DATETIME NOT NULL COMMENT 'Giờ thực hiện (UTC)',
      created_by BIGINT UNSIGNED NOT NULL COMMENT 'FK -> users.id',
      created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
      corrects_activity_id BIGINT UNSIGNED NULL COMMENT 'Bản ghi được đính chính',
      KEY idx_care_trip_time (trip_id, performed_at),
      KEY idx_care_horse_time (horse_id, performed_at),
      KEY fk_care_leg_id (leg_id),
      KEY fk_care_created_by (created_by),
      KEY fk_care_corrects (corrects_activity_id),
      CONSTRAINT fk_care_trip FOREIGN KEY (trip_id) REFERENCES trips (id),
      CONSTRAINT fk_care_leg FOREIGN KEY (leg_id) REFERENCES legs (id),
      CONSTRAINT fk_care_horse FOREIGN KEY (horse_id) REFERENCES horses (id),
      CONSTRAINT fk_care_created_by FOREIGN KEY (created_by) REFERENCES users (id),
      CONSTRAINT fk_care_corrects FOREIGN KEY (corrects_activity_id) REFERENCES horse_care_activities (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Nhật ký hoạt động chăm sóc ngựa (chỉ thêm mới)'`);

    const careChecks = await checksOf(q, 'horse_care_activities');
    for (const [name, expression] of CARE_CHECKS) {
      if (!careChecks.has(name)) await q.query(`ALTER TABLE horse_care_activities ADD CONSTRAINT ${name} CHECK (${expression})`);
    }
  }

  async down(q: QueryRunner) {
    await q.query('DROP TABLE IF EXISTS horse_care_activities');
    // CHECKs and the index reference the new columns, so they go before the columns.
    const logChecks = await checksOf(q, 'horse_logs');
    for (const [name] of [...LOG_CHECKS].reverse()) {
      if (logChecks.has(name)) await q.query(`ALTER TABLE horse_logs DROP CHECK ${name}`);
    }
    if (await hasIndex(q, 'horse_logs', LOG_INDEX)) await q.query(`ALTER TABLE horse_logs DROP INDEX ${LOG_INDEX}`);
    for (const [column] of [...LOG_COLUMNS].reverse()) {
      if (await q.hasColumn('horse_logs', column)) await q.query(`ALTER TABLE horse_logs DROP COLUMN ${column}`);
    }
  }
}
