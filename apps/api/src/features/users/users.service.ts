import { NotFoundException } from '../../shared/core/error.response';
import { UsersRepository } from './users.repository';
import { User } from './users.model';
import { PaginationDto } from '../../shared/utils/pagination.util';
export class UsersService {
  constructor(private readonly repo: UsersRepository) {}
  async getById(id: string) { const user = await this.repo.findById(id); if (!user) throw new NotFoundException('Không tìm thấy tài khoản.'); return user; }
  findByEmailWithPassword(email: string) { return this.repo.findByEmailWithPassword(email); }
  create(data: Partial<User>) { return this.repo.create(data); }
  async findAll(p: PaginationDto) { const [items, total] = await this.repo.findAll(p); return { items, total, ...p }; }
}

