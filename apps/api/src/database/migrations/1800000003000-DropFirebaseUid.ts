import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropFirebaseUid1800000003000 implements MigrationInterface {
  name = 'DropFirebaseUid1800000003000';

  public async up(q: QueryRunner): Promise<void> {
    const hasColumn = await q.hasColumn('users', 'firebase_uid');
    if (!hasColumn) return; // Đã xóa trước đó, bỏ qua

    // Xóa unique index trước, sau đó mới xóa cột
    const table = await q.getTable('users');
    const uqIndex = table?.indices.find(
      (i) => i.isUnique && i.columnNames.length === 1 && i.columnNames[0] === 'firebase_uid',
    );
    if (uqIndex?.name) {
      await q.dropIndex('users', uqIndex.name);
    }

    await q.dropColumn('users', 'firebase_uid');
  }

  public async down(q: QueryRunner): Promise<void> {
    // Khôi phục cột (dữ liệu cũ sẽ là NULL toàn bộ)
    const hasColumn = await q.hasColumn('users', 'firebase_uid');
    if (hasColumn) return;

    await q.query(
      `ALTER TABLE \`users\` ADD \`firebase_uid\` varchar(128) NULL, ADD UNIQUE INDEX \`uq_users_firebase_uid\` (\`firebase_uid\`)`,
    );
  }
}
