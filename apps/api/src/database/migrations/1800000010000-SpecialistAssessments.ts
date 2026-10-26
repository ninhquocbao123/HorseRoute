import { MigrationInterface, QueryRunner } from 'typeorm';
export class SpecialistAssessments1800000010000 implements MigrationInterface {
  name='SpecialistAssessments1800000010000';
  async up(q:QueryRunner){await q.query(`CREATE TABLE IF NOT EXISTS specialist_assessments (
    order_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    specialist_id BIGINT UNSIGNED NOT NULL,
    status ENUM('IN_REVIEW','NEED_INFO','APPROVED','REJECTED') NOT NULL DEFAULT 'IN_REVIEW',
    note VARCHAR(2000) NULL, accepted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    concluded_at DATETIME NULL, revision INT NOT NULL DEFAULT 1,
    KEY ix_assessment_specialist(specialist_id,status),
    CONSTRAINT fk_assessment_order FOREIGN KEY(order_id) REFERENCES orders(id),
    CONSTRAINT fk_assessment_specialist FOREIGN KEY(specialist_id) REFERENCES users(id)
  ) ENGINE=InnoDB`);}
  async down(){throw new Error('Assessment history requires a data-preserving migration.');}
}
