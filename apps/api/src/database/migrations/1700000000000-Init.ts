import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1700000000000 implements MigrationInterface {
  name = 'Init1700000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE \`users\` (
        \`id\` varchar(36) NOT NULL,
        \`firebaseUid\` varchar(128) NOT NULL,
        \`email\` varchar(255) NOT NULL,
        \`displayName\` varchar(255) NULL,
        \`role\` enum('admin','user') NOT NULL DEFAULT 'user',
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_users_firebaseUid\` (\`firebaseUid\`),
        UNIQUE INDEX \`IDX_users_email\` (\`email\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE `users`');
  }
}
