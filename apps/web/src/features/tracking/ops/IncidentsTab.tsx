import { useState } from 'react';
import type { IIncident } from '@my-project/shared';
import { errorMessage, trackingApi } from '../tracking.api';
import { INCIDENT_STATUS_LABEL, INCIDENT_TYPE_LABEL, URGENCY_LABEL, formatDateTime } from '../tracking.format';
import Sheet from '../Sheet';
import AttachmentImage from '../AttachmentImage';

export default function IncidentsTab({ incidents, canHandle, onChanged }: {
  incidents: IIncident[];
  canHandle: boolean;
  onChanged: (message: string) => Promise<void> | void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [closing, setClosing] = useState<IIncident | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  // Chưa đóng lên trước, khẩn cấp lên đầu.
  const sorted = [...incidents].sort((a, b) =>
    Number(a.status === 'CLOSED') - Number(b.status === 'CLOSED')
    || Number(b.urgency === 'HIGH') - Number(a.urgency === 'HIGH')
    || Date.parse(b.reportedAt) - Date.parse(a.reportedAt));

  async function close() {
    if (!closing) return;
    if (!note.trim()) return setError('Cần ghi hướng xử lý khi đóng sự cố.');
    setBusyId(closing.id);
    setError('');
    try {
      await trackingApi.updateIncident(closing.id, { status: 'CLOSED', handlingNote: note.trim() });
      const id = closing.id;
      setClosing(null);
      setNote('');
      await onChanged(`Đã đóng sự cố #${id}.`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  if (!sorted.length) return <p className="trk-muted">Chuyến này chưa có sự cố nào.</p>;

  return (
    <>
      {error && !closing && <p className="error" role="alert">{error}</p>}
      <ul className="trk-log-list">
        {sorted.map(incident => (
          <li key={incident.id} className={incident.urgency === 'HIGH' && incident.status !== 'CLOSED' ? 'is-urgent' : ''}>
            <div className="trk-leg-head">
              <strong>#{incident.id} · {INCIDENT_TYPE_LABEL[incident.incidentType]}</strong>
              <span className="trk-chips">
                {incident.urgency === 'HIGH' && <span className="status-chip" data-status="URGENT">{URGENCY_LABEL.HIGH}</span>}
                <span className="status-chip" data-status={incident.status}>{INCIDENT_STATUS_LABEL[incident.status]}</span>
              </span>
            </div>
            <p>{incident.description}</p>
            <p className="trk-muted">
              {formatDateTime(incident.reportedAt)} · {incident.reportedByName}
              {incident.horseName ? ` · Ngựa: ${incident.horseName}` : ''}
            </p>
            {incident.attachments.length > 0 && (
              <div className="trk-thumbs">{incident.attachments.map(a => <AttachmentImage key={a.id} id={a.id} name={a.originalName} />)}</div>
            )}
            {incident.status === 'CLOSED' && (
              <p className="trk-handled">Đã xử lý lúc {formatDateTime(incident.closedAt)}: {incident.handlingNote}</p>
            )}
            {canHandle && incident.status !== 'CLOSED' && (
              <div className="trk-row-actions">
                <a className="trk-secondary" href={`/coordinator/incidents?incident=${incident.id}`}>Mở trang Xử lý sự cố</a>
                <button type="button" className="trk-primary" disabled={busyId === incident.id} onClick={() => { setClosing(incident); setNote(''); setError(''); }}>Đóng sự cố</button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {closing && (
        <Sheet title={`Đóng sự cố #${closing.id}`} caption="XỬ LÝ SỰ CỐ" onClose={() => busyId === null && setClosing(null)}>
          <p className="trk-muted">{INCIDENT_TYPE_LABEL[closing.incidentType]} · {closing.description}</p>
          <form className="trk-form" onSubmit={event => { event.preventDefault(); void close(); }}>
            <label className="trk-field">
              Hướng xử lý (bắt buộc)
              <textarea rows={4} maxLength={2000} value={note} placeholder="Đã làm gì để xử lý, kết quả, ảnh hưởng đến lịch trình…" onChange={event => { setNote(event.target.value); setError(''); }} />
            </label>
            <p className="trk-hint">Đóng sự cố không tự đổi lộ trình hoặc chặng; nếu cần, hãy hiệu chỉnh chặng riêng.</p>
            {error && <p className="error" role="alert">{error}</p>}
            <div className="trk-sheet-actions">
              <button type="button" className="trk-secondary" disabled={busyId !== null} onClick={() => setClosing(null)}>Hủy</button>
              <button type="submit" className="trk-primary" disabled={busyId !== null}>{busyId ? 'Đang lưu…' : 'Đóng sự cố'}</button>
            </div>
          </form>
        </Sheet>
      )}
    </>
  );
}
