import { DataSource } from 'typeorm';
export class NotificationsRepository {
  constructor(private readonly db: DataSource) {}
  list(recipient: string) { return this.db.query(`SELECT n.id,n.content,n.event_type,n.is_read,n.created_at,n.related_type,n.related_id,
    CASE WHEN n.related_type='ORDER' THEN n.related_id ELSE h.order_id END order_id,
    d.id document_id,h.id horse_id
    FROM notifications n LEFT JOIN documents d ON n.related_type='DOCUMENT' AND d.id=n.related_id
    LEFT JOIN horses h ON h.id=d.horse_id
    WHERE n.recipient_id=? ORDER BY n.created_at DESC,n.id DESC LIMIT 100`, [recipient]); }
  read(id: string, recipient: string) { return this.db.query('UPDATE notifications SET is_read=1 WHERE id=? AND recipient_id=?', [id, recipient]); }
}

