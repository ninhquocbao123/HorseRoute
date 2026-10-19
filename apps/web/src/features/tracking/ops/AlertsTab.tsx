import { useState } from 'react';
import type { IAlert, AlertType } from '@my-project/shared';
import { ALERT_TYPES, errorMessage, trackingApi } from '../tracking.api';
import { ALERT_LABEL, formatDateTime } from '../tracking.format';

export default function AlertsTab({ tripId, alerts, canSend, onSent }: {
  tripId: string;
  alerts: IAlert[];
  canSend: boolean;
  onSent: (message: string) => Promise<void> | void;
}) {
  const [type, setType] = useState<AlertType | ''>('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send() {
    if (!type) return setError('Chọn loại cảnh báo.');
    if (content.trim().length < 5) return setError('Nội dung cảnh báo tối thiểu 5 ký tự.');
    setBusy(true);
    setError('');
    try {
      await trackingApi.createAlert(tripId, { alertType: type, content: content.trim() });
      setType('');
      setContent('');
      await onSent('Đã phát cảnh báo tới tài xế, hộ tống và quản lý.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="trk-stack">
      {canSend && (
        <form className="trk-form trk-box" onSubmit={event => { event.preventDefault(); void send(); }}>
          <h3>Phát cảnh báo thủ công</h3>
          <fieldset className="trk-choice trk-choice-3" disabled={busy}>
            <legend>Loại cảnh báo</legend>
            {ALERT_TYPES.map(item => (
              <button key={item.value} type="button" aria-pressed={type === item.value} onClick={() => { setType(item.value); setError(''); }}>
                <strong>{item.label}</strong>
              </button>
            ))}
          </fieldset>
          <label className="trk-field">
            Nội dung
            <textarea rows={3} maxLength={500} value={content} disabled={busy} placeholder="Ví dụ: Mưa lớn trên QL1A, giảm tốc độ và giữ khoảng cách" onChange={event => { setContent(event.target.value); setError(''); }} />
            <small>{content.length}/500 ký tự</small>
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" className="trk-primary" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi cảnh báo'}</button>
        </form>
      )}
      {!canSend && <p className="trk-hint">Cảnh báo chỉ được phát khi đơn hàng sẵn sàng hoặc đang vận chuyển, và chỉ bởi điều phối viên phụ trách chuyến.</p>}
      {alerts.length === 0 ? (
        <p className="trk-muted">Chưa có cảnh báo nào cho chuyến này.</p>
      ) : (
        <ul className="trk-log-list">
          {[...alerts].reverse().map(alert => (
            <li key={alert.id}>
              <div className="trk-leg-head">
                <span className="status-chip" data-status="ALERT">{ALERT_LABEL[alert.alertType] ?? alert.alertType}</span>
                <time className="trk-muted" dateTime={alert.sentAt}>{formatDateTime(alert.sentAt)}</time>
              </div>
              <p>{alert.content}</p>
              <p className="trk-muted">Gửi bởi {alert.sentByName}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
