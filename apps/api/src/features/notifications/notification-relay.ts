import type { DataSource } from 'typeorm';
import { Logger } from '../../shared/utils/logger.util';

const logger = new Logger('NotificationRelay');

/** Một thông báo vừa tạo, gửi qua socket `notification:new` (cùng trường với GET /notifications để client mở đúng màn). */
export type NewNotice = {
  id: string; content: string; createdAt: string; eventType: string | null; relatedType: string | null; relatedId: string | null;
  orderId: string | null; documentId: string | null; horseId: string | null;
};
type Emitter = { emitToUsers(userIds: string[], event: string, payload: unknown): void };
type Query = Pick<DataSource, 'query'>;

/**
 * Đẩy MỌI thông báo IN_APP mới qua socket `notification:new` tới phòng `user:{recipient}`.
 * Thông báo được ghi ở hơn 20 chỗ trong API (đơn, giấy tờ, thanh toán, chuyến, sự cố); thay vì sửa từng chỗ, relay đọc bảng
 * `notifications` theo id tăng dần mỗi `intervalMs`. Chỉ phát thông báo tạo SAU khi API khởi động (không phát lại thông báo cũ).
 * Một số sự kiện chuyến đã tự phát `notification:new` ngay khi tạo; client bỏ trùng theo `id`.
 */
export class NotificationRelay {
  private lastId: bigint | null = null;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly db: Query, private readonly emitter: Emitter, private readonly intervalMs = 2000) {}

  async start() {
    const [row] = await this.db.query('SELECT COALESCE(MAX(id),0) maxId FROM notifications');
    this.lastId = BigInt(row?.maxId ?? 0);
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Đọc thông báo mới và phát; lỗi chỉ ghi log, lần sau đọc lại từ id cũ. */
  async tick() {
    if (this.running || this.lastId === null) return;
    this.running = true;
    try {
      const rows: Record<string, unknown>[] = await this.db.query(`SELECT CAST(n.id AS CHAR) id,CAST(n.recipient_id AS CHAR) recipientId,n.content,n.event_type eventType,
        n.created_at createdAt,n.related_type relatedType,CAST(n.related_id AS CHAR) relatedId,
        CAST(CASE WHEN n.related_type='ORDER' THEN n.related_id ELSE h.order_id END AS CHAR) orderId,CAST(d.id AS CHAR) documentId,CAST(h.id AS CHAR) horseId
        FROM notifications n LEFT JOIN documents d ON n.related_type='DOCUMENT' AND d.id=n.related_id LEFT JOIN horses h ON h.id=d.horse_id
        WHERE n.id>? AND n.channel='IN_APP' ORDER BY n.id LIMIT 200`, [this.lastId.toString()]);
      for (const row of rows) {
        const notice: NewNotice = {
          id: String(row.id), content: String(row.content ?? ''),
          createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date(String(row.createdAt)).toISOString(),
          eventType: (row.eventType as string) ?? null, relatedType: (row.relatedType as string) ?? null, relatedId: (row.relatedId as string) ?? null,
          orderId: (row.orderId as string) ?? null, documentId: (row.documentId as string) ?? null, horseId: (row.horseId as string) ?? null,
        };
        this.emitter.emitToUsers([String(row.recipientId)], 'notification:new', notice);
        this.lastId = BigInt(notice.id);
      }
    } catch (error) {
      logger.warn('relay_failed', { error: (error as Error).message });
    } finally {
      this.running = false;
    }
  }
}
