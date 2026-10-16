import { Repository } from 'typeorm';
import { User } from './users.model';
import { PaginationDto } from '../../shared/utils/pagination.util';
export class UsersRepository {
  constructor(private readonly repo: Repository<User>) {}
  findById(id: string) { return this.repo.findOne({ where: { id } }); }
  findByEmailWithPassword(email: string) {
    return this.repo.createQueryBuilder('user').addSelect('user.passwordHash').where('user.email = :email', { email: email.trim().toLowerCase() }).getOne();
  }
  create(data: Partial<User>) { return this.repo.save(this.repo.create(data)); }
  findAll({ page, limit }: PaginationDto) {
    return this.repo.findAndCount({ order: { createdAt: 'DESC' }, skip: (page - 1) * limit, take: limit });
  }
}

