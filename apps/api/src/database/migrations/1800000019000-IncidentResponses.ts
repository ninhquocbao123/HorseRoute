import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lịch sử xử lý sự cố của điều phối viên: mỗi lần "Gửi hướng xử lý" (RESPONSE, kèm thời gian chờ dự kiến) hoặc
 * "Đã xử lý xong" (RESOLVED) là một dòng; tổ lái nhận realtime. incidents.handling_note vẫn giữ ghi chú lần cuối.
 * Chỉ thêm bảng mới (re-runnable); down() xóa lịch sử phản hồi.
 */
export class IncidentResponses1800000019000 implements MigrationInterface {
  name = 'IncidentResponses1800000019000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS incident_responses (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      incident_id BIGINT UNSIGNED NOT NULL COMMENT 'FK -> incidents.id',
      kind ENUM('RESPONSE','RESOLVED') NOT NULL,
      note TEXT NOT NULL,
      wait_minutes SMALLINT UNSIGNED NULL COMMENT 'Thời gian chờ dự kiến (phút), 1-1440',
      sent_by BIGINT UNSIGNED NOT NULL COMMENT 'FK -> users.id',
      sent_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
      PRIMARY KEY (id),
      KEY idx_incident_responses_incident (incident_id, sent_at),
      KEY fk_incident_responses_sent_by (sent_by),
      CONSTRAINT fk_incident_responses_incident FOREIGN KEY (incident_id) REFERENCES incidents (id),
      CONSTRAINT fk_incident_responses_sent_by FOREIGN KEY (sent_by) REFERENCES users (id),
      CONSTRAINT ck_incident_responses_wait CHECK (wait_minutes IS NULL OR wait_minutes BETWEEN 1 AND 1440)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Phản hồi xử lý sự cố của điều phối viên'`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE IF EXISTS incident_responses');
  }
}
