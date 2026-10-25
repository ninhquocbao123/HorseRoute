import { MigrationInterface, QueryRunner } from 'typeorm';
import { initialPricingConfig } from '../../features/pricing/pricing.seed';
export class PricingVersions1800000007000 implements MigrationInterface {
 name='PricingVersions1800000007000';
 async up(q:QueryRunner):Promise<void>{
  await q.query(`CREATE TABLE IF NOT EXISTS pricing_versions (
   id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
   title VARCHAR(120) NOT NULL, note TEXT NULL, status ENUM('DRAFT','PUBLISHED') NOT NULL DEFAULT 'DRAFT', revision INT UNSIGNED NOT NULL DEFAULT 1,
   config JSON NOT NULL, effective_from DATETIME(3) NULL, published_at DATETIME(3) NULL,
   created_by BIGINT UNSIGNED NULL, updated_by BIGINT UNSIGNED NULL, published_by BIGINT UNSIGNED NULL,
   created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)), updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
   UNIQUE KEY uq_pricing_effective (effective_from), KEY ix_pricing_current (status,effective_from,id),
   CONSTRAINT fk_pricing_creator FOREIGN KEY(created_by) REFERENCES users(id),
   CONSTRAINT fk_pricing_updater FOREIGN KEY(updated_by) REFERENCES users(id),
   CONSTRAINT fk_pricing_publisher FOREIGN KEY(published_by) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await q.query(`CREATE TABLE IF NOT EXISTS pricing_publish_lock (id TINYINT UNSIGNED NOT NULL PRIMARY KEY) ENGINE=InnoDB`);
  await q.query('INSERT IGNORE INTO pricing_publish_lock(id) VALUES (1)');
  await q.query(`INSERT INTO pricing_versions(title,note,status,config,effective_from,published_at)
    SELECT ?,?,'PUBLISHED',?,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3) WHERE NOT EXISTS(SELECT 1 FROM pricing_versions)`,
    ['Bảng giá khởi tạo từ HTML v7','Mức giá gốc từ bản HTML v7. Cước cơ bản chưa gồm nhân sự, nhiên liệu và cữ nước; dự toán sẽ cộng riêng các khoản này.',JSON.stringify(initialPricingConfig)]);
 }
 async down():Promise<void>{throw new Error('Không tự động xóa lịch sử các phiên bản bảng giá.');}
}
