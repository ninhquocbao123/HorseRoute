import * as bcrypt from 'bcrypt';
import { z } from 'zod';
import { parse } from '../../shared/utils/validation.util';
import { BadRequestException } from '../../shared/core/error.response';
import { NotFoundException } from '../../shared/core/error.response';
import { UsersRepository } from './users.repository';
import { User } from './users.model';
import { PaginationDto } from '../../shared/utils/pagination.util';
export class UsersService {
  constructor(private readonly repo: UsersRepository) {}
  async avatar(id:string) { return {image:await this.repo.avatar(id)}; }
  async saveAvatar(id:string,file?:Express.Multer.File) {
    if(!file || file.size>5*1024*1024 || file.mimetype!=='image/jpeg' || file.buffer[0]!==255 || file.buffer[1]!==216 || file.buffer[file.buffer.length-2]!==255 || file.buffer[file.buffer.length-1]!==217) throw new BadRequestException('Ảnh không hợp lệ. Vui lòng chọn lại ảnh.');
    const image='data:image/jpeg;base64,'+file.buffer.toString('base64');
    await this.repo.saveAvatar(id,image);return {image};
  }
  async updateProfile(id: string, body: unknown) {
    const dto = parse(z.object({fullName:z.string().trim().min(1).max(100),phone:z.string().trim().max(20).regex(/^[+0-9 ()-]*$/),address:z.string().trim().max(255)}).strict(), body);
    await this.repo.updateProfile(id, dto);
    return this.getById(id);
  }
  async changePassword(id: string, body: unknown) {
    const dto = parse(z.object({currentPassword:z.string().min(1).max(72),newPassword:z.string().min(8).max(72)}).strict(), body);
    if(Buffer.byteLength(dto.newPassword,'utf8')>72) throw new BadRequestException('Mật khẩu tối đa 72 byte UTF-8.');
    const account = await this.getById(id);
    const user = await this.repo.findByEmailWithPassword(account.email);
    if(!user?.passwordHash || !await bcrypt.compare(dto.currentPassword,user.passwordHash)) throw new BadRequestException('Mật khẩu hiện tại không đúng.');
    if(await bcrypt.compare(dto.newPassword,user.passwordHash)) throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại.');
    const result = await this.repo.changePassword(id,user.passwordHash,await bcrypt.hash(dto.newPassword,12));
    if(!result.affected) throw new BadRequestException('Mật khẩu đã thay đổi. Vui lòng thử lại.');
    return {message:'Đã đổi mật khẩu thành công.'};
  }
  async getById(id: string) { const user = await this.repo.findById(id); if (!user) throw new NotFoundException('Không tìm thấy tài khoản.'); return user; }
  findByEmailWithPassword(email: string) { return this.repo.findByEmailWithPassword(email); }
  create(data: Partial<User>) { return this.repo.create(data); }
  async findAll(p: PaginationDto) { const [items, total] = await this.repo.findAll(p); return { items, total, ...p }; }
}

