import { Repository } from 'typeorm';
import { User } from './users.model';
import { PaginationDto } from '../../shared/utils/pagination.util';
export class UsersRepository {
  constructor(private readonly repo: Repository<User>) {}
  async avatar(id:string) { const rows=await this.repo.query('SELECT image FROM account_avatars WHERE user_id=?',[id]); return rows[0]?.image || null; }
  async saveAvatar(id:string,image:string) { await this.repo.query('INSERT INTO account_avatars(user_id,image) VALUES (?,?) ON DUPLICATE KEY UPDATE image=VALUES(image)',[id,image]); }
  findById(id: string) { return this.repo.createQueryBuilder('user').addSelect('user.tokenVersion').where('user.id = :id', { id }).getOne(); }
  findByEmailWithPassword(email: string) {
    return this.repo.createQueryBuilder('user').addSelect('user.passwordHash').addSelect('user.tokenVersion').where('user.email = :email', { email: email.trim().toLowerCase() }).getOne();
  }
  updateProfile(id: string, data: Pick<User, 'fullName' | 'phone' | 'address'>) { return this.repo.update(id, data); }
  // Đổi mật khẩu thì mọi phiên cũ hết hiệu lực.
  changePassword(id: string, previous: string, next: string) { return this.repo.createQueryBuilder().update().set({ passwordHash: next, tokenVersion: () => 'token_version + 1' }).where('id = :id AND password_hash = :previous', { id, previous }).execute(); }
  create(data: Partial<User>) { return this.repo.save(this.repo.create(data)); }
  findAll({ page, limit }: PaginationDto) {
    return this.repo.findAndCount({ order: { createdAt: 'DESC' }, skip: (page - 1) * limit, take: limit });
  }
}

