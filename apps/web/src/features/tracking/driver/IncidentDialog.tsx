import { useEffect, useState } from 'react';
import { Alert, Button, Input, Modal, Select, Tag } from 'antd';
import { AlertOutlined } from '@ant-design/icons';
import type { IDriverTripSummary, IIncident } from '@my-project/shared';
import { INCIDENT_TYPES, errorMessage, trackingApi, type TripDetail } from '../tracking.api';
import { INCIDENT_STATUS_LABEL, INCIDENT_TYPE_LABEL, currentLeg, formatDateTime } from '../tracking.format';
import { useDraft } from './useDraft';
import PhotoPicker from './PhotoPicker';
import { INCIDENT_COLOR, INCIDENT_STATUS_COLOR } from './driver-ui';

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
  const leg = draft.legId ? trip.legs.find(l => l.id === draft.legId) : currentLeg(trip.legs);

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
    if (leg) form.set('legId', leg.id);
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
    <Modal
      open centered width={680} className="drv-incident" mask={{ closable: !busy }} keyboard={!busy} onCancel={() => !busy && onClose()}
      title={<span className="drv-incident-title"><AlertOutlined /> Báo sự cố khẩn cấp</span>}
      footer={[
        <Button key="cancel" disabled={busy} onClick={onClose}>Hủy</Button>,
        <Button key="send" type="primary" danger icon={<AlertOutlined />} loading={busy} onClick={() => void submit()}>Gửi báo sự cố</Button>,
      ]}
    >
      <div className="drv-form">
        <p className="drv-muted">{trip.orderCode} · Chuyến #{trip.id}{leg ? ` · Chặng ${leg.seqNo}: ${leg.fromLocationName} → ${leg.toLocationName}` : ''}</p>
        <fieldset className="drv-choice drv-choice-3" disabled={busy}>
          <legend>Loại sự cố</legend>
          {INCIDENT_TYPES.map(item => {
            const active = draft.incidentType === item.value;
            return (
              <Button key={item.value} aria-pressed={active} color={INCIDENT_COLOR[item.value] as 'red'} variant={active ? 'solid' : 'outlined'}
                onClick={() => setDraft({ ...draft, incidentType: item.value })}>
                <strong>{item.label}</strong>
              </Button>
            );
          })}
        </fieldset>
        {medical && <Alert type="error" showIcon message="Sự cố y tế ngựa được đánh dấu KHẨN CẤP và gửi ngay cho quản lý." />}
        <label className="drv-field">
          <span>Mô tả nhanh</span>
          <Input.TextArea rows={3} maxLength={2000} showCount value={draft.description} disabled={busy} placeholder="Chuyện gì đang xảy ra? Vị trí hiện tại?"
            onChange={event => setDraft({ ...draft, description: event.target.value })} />
        </label>
        <label className="drv-field">
          <span>Con ngựa liên quan{medical ? ' (bắt buộc)' : ' (nếu có)'}</span>
          <Select aria-label="Con ngựa liên quan" allowClear placeholder="Không chọn" value={draft.horseId || undefined} disabled={busy}
            status={medical && !draft.horseId && error ? 'error' : undefined}
            onChange={value => setDraft({ ...draft, horseId: value ?? '' })}
            options={horses.map(horse => ({ value: horse.id, label: `${horse.name} (${horse.passportNo})` }))} />
        </label>
        <div className="drv-field">
          <span>Ảnh hiện trường</span>
          <PhotoPicker files={photos} onChange={setPhotos} onError={setError} disabled={busy} />
        </div>
        {error && <Alert type="error" showIcon message={error} />}
      </div>

      {reported.length > 0 && (
        <section className="drv-reported">
          <h4>Sự cố đã báo của chuyến</h4>
          <ul>
            {[...reported].reverse().slice(0, 5).map(item => (
              <li key={item.id}>
                <span className="drv-tags">
                  <Tag color={INCIDENT_STATUS_COLOR[item.status]}>{INCIDENT_STATUS_LABEL[item.status]}</Tag>
                  <Tag color={INCIDENT_COLOR[item.incidentType]}>{INCIDENT_TYPE_LABEL[item.incidentType] ?? item.incidentType}</Tag>
                </span>
                <span>{item.description}</span>
                <time dateTime={item.reportedAt}>{formatDateTime(item.reportedAt)}</time>
                {item.status === 'CLOSED' && item.handlingNote && <small>Xử lý: {item.handlingNote}</small>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Modal>
  );
}
