import { MigrationInterface, QueryRunner } from 'typeorm';
export class SystemAudit1800000002000 implements MigrationInterface {
 name='SystemAudit1800000002000';
 async up(q:QueryRunner):Promise<void>{await q.query('ALTER TABLE audit_logs MODIFY actor_id BIGINT UNSIGNED NULL');}
 async down():Promise<void>{throw new Error('Không xóa nhật ký tự động của hệ thống.');}
}
