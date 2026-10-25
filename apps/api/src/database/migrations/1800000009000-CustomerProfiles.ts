import { MigrationInterface, QueryRunner } from 'typeorm';
export class CustomerProfiles1800000009000 implements MigrationInterface {
 name='CustomerProfiles1800000009000';
 async up(q:QueryRunner){
  await q.query(`CREATE TABLE IF NOT EXISTS customer_horse_profiles (
   id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, owner_id BIGINT UNSIGNED NOT NULL,
   name VARCHAR(100) NOT NULL, passport_no VARCHAR(50) NULL, payload JSON NOT NULL,
   revision INT NOT NULL DEFAULT 1, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
   UNIQUE KEY uq_customer_profile_passport(passport_no), KEY ix_customer_profiles_owner(owner_id),
   CONSTRAINT fk_customer_profile_owner FOREIGN KEY(owner_id) REFERENCES users(id)) ENGINE=InnoDB`);
  await q.query(`INSERT INTO customer_horse_profiles(owner_id,name,passport_no,payload)
   SELECT h.owner_id,h.name,h.passport_no,JSON_OBJECT('name',h.name,'passportNo',h.passport_no,'breed',COALESCE(h.breed,''),'birthDate',COALESCE(DATE_FORMAT(h.birth_date,'%Y-%m-%d'),''),'sex',COALESCE(h.sex,''),'coatColor',COALESCE(h.coat_color,''),'note',COALESCE(h.note,''))
   FROM horses h LEFT JOIN customer_horse_profiles p ON p.passport_no=h.passport_no WHERE p.id IS NULL`);
  await q.query(`CREATE TABLE IF NOT EXISTS customer_profile_files (
   id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,profile_id BIGINT UNSIGNED NOT NULL,kind ENUM('PHOTO','DOCUMENT') NOT NULL,
   slot VARCHAR(30) NOT NULL,original_name VARCHAR(255) NOT NULL,file_type VARCHAR(10) NOT NULL,size_bytes BIGINT NOT NULL,storage_path VARCHAR(255) NOT NULL,
   created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,KEY ix_customer_profile_file(profile_id,kind,slot),
   CONSTRAINT fk_customer_profile_file FOREIGN KEY(profile_id) REFERENCES customer_horse_profiles(id)) ENGINE=InnoDB`);
  if(!await q.hasColumn('orders','booking_details'))await q.query('ALTER TABLE orders ADD COLUMN booking_details JSON NULL');
  // Historical horses remain order snapshots. Identity now belongs to the unique profile registry.
  const indexes=await q.query("SHOW INDEX FROM horses WHERE Key_name='uq_horses_passport_no'");
  if(indexes.length)await q.query('ALTER TABLE horses DROP INDEX uq_horses_passport_no, ADD INDEX ix_horses_passport_no(passport_no)');
 }
 async down(){throw new Error('Customer profiles contain user data; rollback requires an explicit data-preserving migration.');}
}
