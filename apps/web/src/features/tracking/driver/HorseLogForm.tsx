import { useCallback, useEffect, useState } from 'react';
import type { IDriverTripSummary, IHorseLog } from '@my-project/shared';
import { CONDITIONS, errorMessage, trackingApi, type TripDetail } from '../tracking.api';
import { CONDITION_LABEL, LEG_STATUS_LABEL, currentLeg, formatDateTime } from '../tracking.format';
import { useDraft } from './useDraft';
import PhotoPicker from './PhotoPicker';
import AttachmentImage from '../AttachmentImage';

type Draft = { legId: string; horseId: string; condition: string; note: string; correctsLogId: string };
const EMPTY: Draft = { legId: '', horseId: '', condition: '', note: '', correctsLogId: '' };

export default function HorseLogForm({ trip, detail }: { trip: IDriverTripSummary; detail: TripDetail | undefined }) {
  const [draft, setDraft, clearDraft] = useDraft<Draft>(`horse-log:${trip.id}`, EMPTY);
  const [photos, setPhotos] = useState<File[]>([]);
  const [logs, setLogs] = useState<IHorseLog[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const horses = detail?.horses ?? [];
  const started = trip.legs.filter(leg => leg.status !== 'NOT_STARTED');
  const defaultLeg = currentLeg(started) ?? started[started.length - 1];
  const legId = draft.legId && started.some(leg => leg.id === draft.legId) ? draft.legId : defaultLeg?.id ?? '';
  const canLog = trip.orderStatus === 'IN_TRANSIT' && started.length > 0;
  const correcting = logs.find(log => log.id === draft.correctsLogId);

  const loadLogs = useCallback(async () => {
    try {
      setLogs(await trackingApi.horseLogs(trip.id));
    } catch (e) {
      setError(errorMessage(e, 'Không tải được nhật ký ngựa.'));
    }
  }, [trip.id]);

  // Lỗi cũ không còn đúng khi người dùng đã sửa nội dung.
  useEffect(() => setError(''), [draft]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  async function submit() {
    if (!legId) return setError('Chưa có chặng nào đã xuất phát để ghi nhật ký.');
    if (!draft.horseId) return setError('Chọn con ngựa.');
    if (!draft.condition) return setError('Chọn tình trạng của ngựa.');
    setBusy(true);
    setError('');
    setNotice('');
    const form = new FormData();
    form.set('horseId', draft.horseId);
    form.set('conditionStatus', draft.condition);
    form.set('note', draft.note.trim());
    form.set('loggedAt', new Date().toISOString());
    if (draft.correctsLogId) form.set('correctsLogId', draft.correctsLogId);
    photos.forEach(photo => form.append('photos', photo));
    try {
      await trackingApi.createHorseLog(legId, form);
      // Chỉ xóa bản nháp sau khi server xác nhận; lỗi mạng giữ nguyên toàn bộ nội dung.
      clearDraft();
      setPhotos([]);
      setNotice('Đã lưu nhật ký ngựa.');
      await loadLogs();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="trk-stack">
      {notice && <p className="trk-notice" role="status">{notice}</p>}
      <section className="portal-panel trk-panel">
        <div className="portal-panel-heading"><h2>Ghi nhật ký sức khỏe ngựa</h2></div>
        {!canLog ? (
          <p className="trk-hint">Chỉ ghi nhật ký khi chuyến đang vận chuyển và đã có chặng xuất phát.</p>
        ) : (
          <form className="trk-form" onSubmit={event => { event.preventDefault(); void submit(); }}>
            {correcting && (
              <p className="trk-banner trk-banner-inline">
                Đang đính chính bản ghi của <strong>{correcting.horseName}</strong> lúc {formatDateTime(correcting.loggedAt)}.
                <button type="button" className="trk-link" onClick={() => setDraft({ ...draft, correctsLogId: '' })}>Hủy đính chính</button>
              </p>
            )}
            <label className="trk-field">
              Chặng
              <select value={legId} disabled={busy} onChange={event => setDraft({ ...draft, legId: event.target.value })}>
                {started.map(leg => (
                  <option key={leg.id} value={leg.id}>Chặng {leg.seqNo}: {leg.fromLocationName} → {leg.toLocationName} ({LEG_STATUS_LABEL[leg.status]})</option>
                ))}
              </select>
            </label>
            <label className="trk-field">
              Con ngựa
              <select value={draft.horseId} disabled={busy || !!correcting} onChange={event => setDraft({ ...draft, horseId: event.target.value })}>
                <option value="">— Chọn ngựa —</option>
                {horses.map(horse => <option key={horse.id} value={horse.id}>{horse.name} ({horse.passportNo})</option>)}
              </select>
            </label>
            <fieldset className="trk-choice" disabled={busy}>
              <legend>Tình trạng</legend>
              {CONDITIONS.map(item => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={draft.condition === item.value}
                  onClick={() => setDraft({ ...draft, condition: item.value })}
                >
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </button>
              ))}
            </fieldset>
            <label className="trk-field">
              Ghi chú
              <textarea rows={3} maxLength={1000} value={draft.note} disabled={busy} placeholder="Biểu hiện, ăn uống, nhiệt độ…" onChange={event => setDraft({ ...draft, note: event.target.value })} />
            </label>
            <PhotoPicker files={photos} onChange={setPhotos} onError={setError} disabled={busy} />
            {error && <p className="error" role="alert">{error}</p>}
            <button type="submit" className="trk-primary trk-wide" disabled={busy}>{busy ? 'Đang gửi…' : 'GỬI NHẬT KÝ'}</button>
            <p className="trk-muted">Nội dung được lưu tạm trên thiết bị; nếu mất mạng bạn chỉ cần bấm gửi lại. Ảnh cần chọn lại nếu tải lại trang.</p>
          </form>
        )}
      </section>

      <section className="portal-panel trk-panel">
        <div className="portal-panel-heading">
          <h2>Nhật ký của chuyến</h2>
          <button type="button" className="trk-secondary" onClick={() => void loadLogs()}>Làm mới</button>
        </div>
        {logs.length === 0 ? (
          <p className="trk-muted">Chưa có nhật ký nào.</p>
        ) : (
          <ul className="trk-log-list">
            {[...logs].reverse().map(log => (
              <li key={log.id}>
                <div className="trk-leg-head">
                  <strong>{log.horseName}</strong>
                  <span className="status-chip" data-status={log.conditionStatus}>{CONDITION_LABEL[log.conditionStatus]}</span>
                </div>
                <p className="trk-muted">{formatDateTime(log.loggedAt)} · {log.createdByName}{log.correctsLogId ? ` · đính chính bản #${log.correctsLogId}` : ''}</p>
                {log.note && <p>{log.note}</p>}
                {log.attachments.length > 0 && (
                  <div className="trk-thumbs">{log.attachments.map(a => <AttachmentImage key={a.id} id={a.id} name={a.originalName} />)}</div>
                )}
                {canLog && (
                  <button
                    type="button"
                    className="trk-link"
                    onClick={() => {
                      setDraft({ ...draft, correctsLogId: log.id, horseId: log.horseId, legId: log.legId });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Đính chính bản ghi này
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
