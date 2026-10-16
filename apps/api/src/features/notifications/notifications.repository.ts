import { DataSource } from 'typeorm';
export class NotificationsRepository {
  constructor(private readonly db: DataSource) {}
  list(recipient: string) { return this.db.query('SELECT id,content,event_type,is_read,created_at,related_type,related_id FROM notifications WHERE recipient_id=? ORDER BY created_at DESC,id DESC LIMIT 100', [recipient]); }
  read(id: string, recipient: string) { return this.db.query('UPDATE notifications SET is_read=1 WHERE id=? AND recipient_id=?', [id, recipient]); }
}

