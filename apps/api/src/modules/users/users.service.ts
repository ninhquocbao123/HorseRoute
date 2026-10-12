import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';
@Injectable()
export class UsersService {
 constructor(@InjectRepository(User) private readonly repo:Repository<User>){}
 async getById(id:string){const user=await this.repo.findOne({where:{id}});if(!user)throw new NotFoundException('Không tìm thấy tài khoản.');return user;}
 findByEmailWithPassword(email:string){return this.repo.createQueryBuilder('user').addSelect('user.passwordHash').where('user.email = :email',{email:email.trim().toLowerCase()}).getOne();}
 create(data:Partial<User>){return this.repo.save(this.repo.create(data));}
 async findAll({page,limit}:PaginationDto){const [items,total]=await this.repo.findAndCount({order:{createdAt:'DESC'},skip:(page-1)*limit,take:limit});return {items,total,page,limit};}
}
