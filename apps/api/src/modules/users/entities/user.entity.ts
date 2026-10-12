import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Role } from '@my-project/shared';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true }) id: string;
  @Column({ name: 'firebase_uid', type: 'varchar', length: 128, nullable: true, unique: true }) firebaseUid: string | null;
  @Column({ length: 100, unique: true }) email: string;
  @Column({ name: 'full_name', length: 100 }) fullName: string;
  @Column({ name: 'password_hash', length: 255, select: false }) passwordHash: string;
  @Column({ type: 'enum', enum: Role }) role: Role;
  @Column({ name: 'phone', type: 'varchar', length: 20, nullable: true }) phone: string | null;
  @Column({ name: 'address', type: 'varchar', length: 255, nullable: true }) address: string | null;
  @Column({ name: 'account_status', type: 'enum', enum: ['ACTIVE', 'LOCKED', 'PENDING'] }) accountStatus: 'ACTIVE' | 'LOCKED' | 'PENDING';
  @Column({ name: 'created_at', type: 'datetime', default: () => 'UTC_TIMESTAMP()' }) createdAt: Date;
}

