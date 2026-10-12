import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RolesGuard } from '../../common/guards/roles.guard';
import { User } from '../users/entities/user.entity';
@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(RolesGuard)
export class NotificationsController {
  constructor(private readonly db: DataSource) {}
  @ApiOperation({summary:'100 thông báo mới nhất của tài khoản hiện tại'})
  @Get()
  list(@Req() r: {account: User}) {
    return this.db.query('SELECT id,content,event_type,is_read,created_at,related_type,related_id FROM notifications WHERE recipient_id=? ORDER BY created_at DESC,id DESC LIMIT 100',[r.account.id]);
  }
  @ApiOperation({summary:'Đánh dấu thông báo của mình đã đọc'})
  @Post(':id/read')
  async read(@Req() r: {account: User}, @Param('id') id: string) {
    if (!/^[1-9]\d{0,19}$/.test(id)) throw new NotFoundException();
    const result = await this.db.query('UPDATE notifications SET is_read=1 WHERE id=? AND recipient_id=?',[id,r.account.id]);
    if (!result.affectedRows) throw new NotFoundException('Không tìm thấy thông báo.');
    return { id, is_read: true };
  }
}

