import { useState } from 'react';
import type { ITripTimelineLeg, LegStatus } from '@my-project/shared';
import { errorMessage, trackingApi } from '../tracking.api';
import { LEG_STATUS_LABEL, formatDateTime, toLocalInput, fromLocalInput } from '../tracking.format';
import Sheet from '../Sheet';

const STATUSES: LegStatus[] = ['NOT_STARTED', 'MOVING', 'AT_STOP', 'COMPLETED'] as LegStatus[];

/** Hiệu chỉnh trạng thái chặng (UC-14): bắt buộc lý do, hệ thống tự đồng bộ mốc và trạng thái đơn. */
export default function CorrectLegDialog({ leg, onClose, onDone }: {
  leg: ITripTimelineLeg;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [status, setStatus] = useState<LegStatus | ''>('');
  const [reason, setReason] = useState('');
  const [time, setTime] = useState(() => toLocalInput(new Date()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!status) return setError('Chọn trạng thái đúng của chặng.');
    if (!reason.trim()) return setError('Lý do hiệu chỉnh là bắt buộc.');
    const when = fromLocalInput(time);
    if (!when || when.getTime() > Date.now() + 60_000) return setError('Giờ áp dụng không hợp lệ hoặc ở tương lai.');
    setBusy(true);
    setError('');
    try {
      const result = await trackingApi.correctLeg(leg.id, { status, reason: reason.trim(), occurredAt: when.toISOString() });
      onDone(`Đã hiệu chỉnh chặng ${leg.seqNo}: ${LEG_STATUS_LABEL[leg.status]} → ${LEG_STATUS_LABEL[status]}. Đơn hàng: ${result.orderStatus}.`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Sheet title={`Hiệu chỉnh chặng ${leg.seqNo}`} caption="HIỆU CHỈNH MỐC" onClose={() => !busy && onClose()}>
      <p className="trk-muted">{leg.fromLocationName} → {leg.toLocationName} · hiện tại: <strong>{LEG_STATUS_LABEL[leg.status]}</strong></p>
      <form className="trk-form" onSubmit={event => { event.preventDefault(); void submit(); }}>
        <fieldset className="trk-choice" disabled={busy}>
          <legend>Trạng thái đúng</legend>
          {STATUSES.filter(item => item !== leg.status).map(item => (
            <button key={item} type="button" aria-pressed={status === item} onClick={() => { setStatus(item); setError(''); }}>
              <strong>{LEG_STATUS_LABEL[item]}</strong>
            </button>
          ))}
        </fieldset>
        <label className="trk-field">
          Lý do hiệu chỉnh (bắt buộc)
          <textarea rows={3} maxLength={255} value={reason} disabled={busy} placeholder="Ví dụ: tài xế quên báo mốc đến trạm lúc 14:20" onChange={event => { setReason(event.target.value); setError(''); }} />
          <small>{reason.length}/255 ký tự</small>
        </label>
        <label className="trk-field">
          Giờ thực tế áp dụng cho mốc còn thiếu
          <input type="datetime-local" value={time} max={toLocalInput(new Date())} disabled={busy} onChange={event => setTime(event.target.value)} />
          <small>Chỉ dùng khi trạng thái mới cần thêm mốc chưa được ghi (hiện: xuất phát {formatDateTime(leg.actualDepartureAt)}, đến {formatDateTime(leg.actualArrivalAt)}).</small>
        </label>
        <p className="trk-hint">
          Hệ thống tự thêm hoặc xoá các mốc cho khớp trạng thái mới, đồng bộ trạng thái đơn hàng và gửi thông báo cho các bên liên quan. Mọi thay đổi được ghi nhật ký kiểm toán kèm lý do.
        </p>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="trk-sheet-actions">
          <button type="button" className="trk-secondary" disabled={busy} onClick={onClose}>Hủy</button>
          <button type="submit" className="trk-primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu hiệu chỉnh'}</button>
        </div>
      </form>
    </Sheet>
  );
}
