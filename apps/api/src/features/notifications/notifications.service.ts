import { NotFoundException } from '../../shared/core/error.response';
import { NotificationsRepository } from './notifications.repository';
export class NotificationsService {
  constructor(private readonly repo: NotificationsRepository) {}
  list(recipient: string) { return this.repo.list(recipient); }
  async read(recipient: string, id: string) {
    if (!/^[1-9]\d{0,19}$/.test(id)) throw new NotFoundException();
    const result = await this.repo.read(id, recipient);
    if (!result.affectedRows) throw new NotFoundException('Không tìm thấy thông báo.');
    return { id, is_read: true };
  }
}

