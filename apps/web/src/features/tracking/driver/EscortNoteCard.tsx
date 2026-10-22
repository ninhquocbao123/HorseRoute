import { useEffect, useState } from 'react';
import { CommentOutlined } from '@ant-design/icons';
import type { IHorseLog } from '@my-project/shared';
import { trackingApi } from '../tracking.api';

const time = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' });

/** Nhật ký mới nhất có ghi chú, do người khác (không phải tài khoản đang đăng nhập) ghi. */
export function latestPartnerNote(logs: IHorseLog[], userId: string) {
  return logs
    .filter(log => log.createdBy !== userId && log.note?.trim())
    .reduce<IHorseLog | null>((latest, log) => (!latest || Date.parse(log.loggedAt) > Date.parse(latest.loggedAt) ? log : latest), null);
}

/**
 * "Ghi chú từ hộ tống" (D1b). Quyết định 5.5: chưa có vai trò crew của người ghi nên chỉ lọc được "người khác mình".
 * Không có ghi chú nào thì ẩn thẻ.
 */
export default function EscortNoteCard({ tripId, userId, refreshKey }: { tripId: string; userId: string; refreshKey?: unknown }) {
  const [note, setNote] = useState<IHorseLog | null>(null);
  useEffect(() => {
    let active = true;
    trackingApi.horseLogs(tripId).then(logs => active && setNote(latestPartnerNote(logs, userId))).catch(() => active && setNote(null));
    return () => { active = false; };
  }, [tripId, userId, refreshKey]);

  if (!note) return null;
  return (
    <section className="drv-card drv-escort-note" aria-labelledby="drv-escort-note-title">
      <h3 id="drv-escort-note-title" className="drv-card-title">Ghi chú từ hộ tống</h3>
      <p>
        <CommentOutlined aria-hidden="true" />
        <span><time dateTime={note.loggedAt}>{time.format(new Date(note.loggedAt))}</time> · {note.note}</span>
      </p>
    </section>
  );
}
