import { useEffect, useState } from 'react';
import { CommentOutlined } from '@ant-design/icons';
import type { IHorseLog } from '@my-project/shared';
import { trackingApi } from '../tracking.api';

const time = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' });
const REFRESH_MS = 2 * 60_000;

/** Nhật ký mới nhất có ghi chú do HỘ TỐNG của chuyến ghi (createdByCrewRole = ESCORT). */
export function latestEscortNote(logs: IHorseLog[]) {
  return logs
    .filter(log => log.createdByCrewRole === 'ESCORT' && log.note?.trim())
    .reduce<IHorseLog | null>((latest, log) => (!latest || Date.parse(log.loggedAt) > Date.parse(latest.loggedAt) ? log : latest), null);
}

/**
 * "Ghi chú từ hộ tống" (D1b), chỉ cho tài xế. Quyết định 5.5: lọc theo vai trò crew của người ghi (createdByCrewRole = ESCORT).
 * Tải lại khi `refreshKey` đổi và mỗi 2 phút khi tab đang hiển thị. Không có ghi chú nào thì ẩn thẻ.
 */
export default function EscortNoteCard({ tripId, refreshKey }: { tripId: string; refreshKey?: unknown }) {
  const [note, setNote] = useState<IHorseLog | null>(null);
  useEffect(() => {
    let active = true;
    const load = () => {
      trackingApi.horseLogs(tripId).then(logs => active && setNote(latestEscortNote(logs))).catch(() => active && setNote(null));
    };
    load();
    // Hộ tống có thể ghi chú bất cứ lúc nào: tải lại mỗi 2 phút, chỉ khi tab đang hiển thị.
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [tripId, refreshKey]);

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
