import { useEffect, useState } from 'react';
import type { IDriverTripSummary, IIncident } from '@my-project/shared';
import { INCIDENT_TYPES, errorMessage, trackingApi, type TripDetail } from '../tracking.api';
import { INCIDENT_STATUS_LABEL, currentLeg, formatDateTime } from '../tracking.format';
import { useDraft } from './useDraft';
import PhotoPicker from './PhotoPicker';
import Sheet from '../Sheet';

type Draft = { incidentType: string; description: string; legId: string; horseId: string };
const EMPTY: Draft = { incidentType: '', description: '', legId: '', horseId: '' };

export default function IncidentDialog({ trip, detail, onClose, onReported }: {
  trip: IDriverTripSummary;
  detail: TripDetail | undefined;
  onClose: () => void;
  onReported: (message: string) => void;
}) {
  const [draft, setDraft, clearDraft] = useDraft<Draft>(`incident:${trip.id}`, EMPTY);
  const [photos, setPhotos] = useState<File[]>([]);
  const [reported, setReported] = useState<IIncident[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const horses = detail?.horses ?? [];
  const medical = draft.incidentType === 'HORSE_MEDICAL';
  const legId = draft.legId || currentLeg(trip.legs)?.id || '';

  // Lỗi cũ không còn đúng khi người dùng đã sửa nội dung.
  useEffect(() => setError(''), [draft]);

  useEffect(() => {
    trackingApi.incidents(trip.id).then(setReported).catch(() => undefined);
  }, [trip.id]);

  async function submit() {
    if (!draft.incidentType) return setError('Chọn loại sự cố.');
    if (draft.description.trim().length < 5) return setError('Mô tả sự cố tối thiểu 5 ký tự.');
    if (medical && !draft.horseId) return setError('Sự cố y tế: chọn con ngựa bị ảnh hưởng.');
    setBusy(true);
    setError('');
    const form = new FormData();
    form.set('incidentType', draft.incidentType);
    form.set('description', draft.description.trim());
    if (legId) form.set('legId', legId);
    if (draft.horseId) form.set('horseId', draft.horseId);
    photos.forEach(photo => form.append('photos', photo));
    try {
      const created = await trackingApi.createIncident(trip.id, form);
      clearDraft();
      onReported(created.urgency === 'HIGH' ? 'Đã báo sự cố KHẨN. Quản lý và điều phối viên đã được thông báo.' : 'Đã báo sự cố. Điều phối viên sẽ liên hệ với bạn.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title="Báo sự cố khẩn cấp" caption="CHUYẾN" onClose={() => !busy && onClose()} danger>
      <p className="trk-muted">{trip.orderCode} · Chuyến #{trip.id}</p>
      <form className="trk-form" onSubmit={event => { event.preventDefault(); void submit(); }}>
        <fieldset className="trk-choice trk-choice-3" disabled={busy}>
          <legend>Loại sự cố</legend>
          {INCIDENT_TYPES.map(item => (
            <button key={item.value} type="button" aria-pressed={draft.incidentType === item.value} onClick={() => setDraft({ ...draft, incidentType: item.value })}>
              <strong>{item.label}</strong>
            </button>
          ))}
        </fieldset>
        {medical && <p className="trk-hint">Sự cố y tế ngựa được đánh dấu KHẨN CẤP và gửi ngay cho quản lý.</p>}
        <label className="trk-field">
          Mô tả nhanh
          <textarea rows={3} maxLength={2000} value={draft.description} disabled={busy} placeholder="Chuyện gì đang xảy ra? Vị trí hiện tại?" onChange={event => setDraft({ ...draft, description: event.target.value })} />
        </label>
        <label className="trk-field">
          Con ngựa liên quan{medical ? ' (bắt buộc)' : ' (nếu có)'}
          <select value={draft.horseId} disabled={busy} onChange={event => setDraft({ ...draft, horseId: event.target.value })}>
            <option value="">— Không chọn —</option>
            {horses.map(horse => <option key={horse.id} value={horse.id}>{horse.name} ({horse.passportNo})</option>)}
          </select>
        </label>
        <PhotoPicker files={photos} onChange={setPhotos} onError={setError} disabled={busy} />
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="trk-danger trk-wide" disabled={busy}>{busy ? 'Đang gửi…' : 'GỬI BÁO SỰ CỐ'}</button>
      </form>

      {reported.length > 0 && (
        <section className="trk-reported">
          <h3>Sự cố đã báo</h3>
          <ul>
            {[...reported].reverse().slice(0, 5).map(item => (
              <li key={item.id}>
                <span className="status-chip" data-status={item.status}>{INCIDENT_STATUS_LABEL[item.status]}</span>
                <span>{item.description}</span>
                <time dateTime={item.reportedAt}>{formatDateTime(item.reportedAt)}</time>
                {item.status === 'CLOSED' && item.handlingNote && <small>Xử lý: {item.handlingNote}</small>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Sheet>
  );
}
