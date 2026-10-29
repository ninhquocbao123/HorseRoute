import { MigrationInterface, QueryRunner } from 'typeorm';
export class AccountAvatars1800000090000 implements MigrationInterface {
 async up(q: QueryRunner): Promise<void> { await q.query('CREATE TABLE IF NOT EXISTS account_avatars (user_id BIGINT UNSIGNED PRIMARY KEY, image MEDIUMTEXT NOT NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, CONSTRAINT fk_avatar_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)'); }
 async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE account_avatars'); }
}
