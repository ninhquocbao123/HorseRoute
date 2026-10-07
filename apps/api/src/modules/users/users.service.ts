import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  findByFirebaseUid(uid: string) {
    return this.repo.findOne({ where: { firebaseUid: uid } });
  }

  async getByFirebaseUid(uid: string) {
    const user = await this.findByFirebaseUid(uid);
    if (!user) throw new NotFoundException('Không tìm thấy user, hãy gọi /auth/sync trước');
    return user;
  }

  create(data: Partial<User>) {
    return this.repo.save(this.repo.create(data));
  }

  async findAll({ page, limit }: PaginationDto) {
    const [items, total] = await this.repo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }
}
