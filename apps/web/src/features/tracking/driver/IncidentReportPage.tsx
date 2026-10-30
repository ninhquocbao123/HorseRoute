import { useEffect, useState } from 'react';
import { Alert, Button, Input, Select } from 'antd';
import { PHOTO_REQUIRED, type DamageTarget, type IDriverTripDetail, type IDriverTripSummary, type IIncident, type IncidentSeverity } from '@my-project/shared';
import { errorMessage, trackingApi } from '../tracking.api';
import { currentLeg } from '../tracking.format';
import { useDraft } from './useDraft';
import SeverityPicker from './SeverityPicker';
import DamageTargetChips from './DamageTargetChips';
import LabeledPhotoGrid from './LabeledPhotoGrid';
import { QuickContactCard, RedNotice, ReportedIncidents, WaitingChecklist } from './IncidentSidePanel';
import { INCIDENT_KIND_GROUPS, splitIncidentKind } from './driver-ui';

type Coords = { lat: number; lng: number };
type Draft = {
  severity: IncidentSeverity | '';
  /** `TYPE:SUB_TYPE` từ INCIDENT_KIND_GROUPS */
  kind: string;
  location: string;
  /** Tọa độ GPS đã điền vào ô vị trí; người dùng sửa ô đó thành chữ thì gửi locationText */
  coords: Coords | null;
  description: string;
  damageTarget: DamageTarget | '';
  horseId: string;
};
const EMPTY: Draft = { severity: '', kind: '', location: '', coords: null, description: '', damageTarget: '', horseId: '' };
const formatCoords = ({ lat, lng }: Coords) => `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

/** Màn D2 "Báo cáo sự cố" (Figma 57:5285): form bên trái, việc cần làm + liên hệ nhanh bên phải. Nháp (trừ ảnh) lưu theo chuyến. */
export default function IncidentReportPage({ trip, detail, onDone, onCancel }: {
  trip: IDriverTripSummary;
  detail: IDriverTripDetail | undefined;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  // Loại mặc định theo vai trò trong chuyến (vẫn đổi được): tài xế → Hỏng xe, hộ tống → Y tế ngựa.
  const [draft, setDraft, clearDraft] = useDraft<Draft>(`incident:${trip.id}`, { ...EMPTY, kind: trip.crewRole === 'ESCORT' ? 'HORSE_MEDICAL:OTHER' : 'VEHICLE_BREAKDOWN:OTHER' });
  const [photos, setPhotos] = useState<File[]>([]);
  const [captions, setCaptions] = useState<string[]>([]);
  const [reported, setReported] = useState<IIncident[]>([]);
  const [gps, setGps] = useState<'idle' | 'locating' | 'unavailable'>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tried, setTried] = useState(false);

  const kind = splitIncidentKind(draft.kind);
  const medical = kind?.incidentType === 'HORSE_MEDICAL';
  const showHorse = medical || draft.damageTarget === 'HORSE' || draft.damageTarget === 'BOTH';
  const horses = detail?.horses ?? [];
  const update = (patch: Partial<Draft>) => setDraft(previous => ({ ...previous, ...patch }));

  useEffect(() => {
    trackingApi.incidents(trip.id).then(setReported).catch(() => undefined);
  }, [trip.id]);

  // Lỗi cũ không còn đúng khi người dùng đã sửa nội dung.
  useEffect(() => setError(''), [draft, photos, captions]);

  // GPS tự động khi mở trang; không có quyền / không có GPS thì để trống cho nhập tay, không chặn gửi.
  useEffect(() => {
    if (draft.location) return;
    if (!('geolocation' in navigator)) return setGps('unavailable');
    let active = true;
    setGps('locating');
    navigator.geolocation.getCurrentPosition(
      position => {
        if (!active) return;
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        setDraft(previous => (previous.location ? previous : { ...previous, coords, location: formatCoords(coords) }));
        setGps('idle');
      },
      () => active && setGps('unavailable'),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
    return () => { active = false; };
    // Chỉ chạy khi mở trang của chuyến này, không chạy lại mỗi lần sửa nháp.
  }, [trip.id]);

  function problem() {
    if (!draft.severity) return 'Chọn mức độ sự cố.';
    if (!kind) return 'Chọn loại sự cố.';
    if (draft.description.trim().length < 5) return 'Mô tả chi tiết tối thiểu 5 ký tự.';
    if (!draft.damageTarget) return 'Chọn hư hại liên quan tới xe, ngựa hay cả hai.';
    if (medical && !draft.horseId) return 'Sự cố y tế: chọn con ngựa bị ảnh hưởng.';
    if (PHOTO_REQUIRED.INCIDENT && !photos.length) return 'Thêm ít nhất 1 ảnh hiện trường để điều phối viên xử lý.';
    return '';
  }

  async function submit() {
    setTried(true);
    const message = problem();
    if (message || !kind) return setError(message);
    setBusy(true);
    setError('');
    const form = new FormData();
    form.set('severity', draft.severity);
    form.set('incidentType', kind.incidentType);
    form.set('subType', kind.subType);
    form.set('damageTarget', draft.damageTarget);
    form.set('description', draft.description.trim());
    const leg = currentLeg(trip.legs);
    if (leg) form.set('legId', leg.id);
    if (showHorse && draft.horseId) form.set('horseId', draft.horseId);
    const location = draft.location.trim();
    if (draft.coords && location === formatCoords(draft.coords)) {
      form.set('latitude', String(draft.coords.lat));
      form.set('longitude', String(draft.coords.lng));
    } else if (location) {
      form.set('locationText', location);
    }
    photos.forEach((photo, index) => {
      form.append('photos', photo);
      form.append('captions', captions[index]?.trim() ?? '');
    });
    try {
      const created = await trackingApi.createIncident(trip.id, form);
      clearDraft();
      onDone(created.urgency === 'HIGH' ? 'Đã báo sự cố KHẨN. Quản lý và điều phối viên đã được thông báo.' : 'Đã báo sự cố. Điều phối viên sẽ liên hệ với bạn.');
    } catch (e) {
      // Lỗi mạng hoặc lỗi kiểm tra: giữ nguyên dữ liệu đã nhập (nháp vẫn còn, ảnh vẫn trong bộ nhớ).
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const invalid = (empty: boolean) => tried && empty;

  return (
    <div className="drv-incident-page">
      <form className="drv-card drv-incident-form" onSubmit={event => { event.preventDefault(); void submit(); }} noValidate>
        <h3 className="drv-card-title">1. Mức độ sự cố</h3>
        <SeverityPicker value={draft.severity} onChange={severity => update({ severity })} disabled={busy} invalid={invalid(!draft.severity)} />

        <h3 className="drv-card-title">2. Lý do gặp sự cố</h3>
        <div className="drv-form-grid">
          <label className="drv-input">
            <span>Loại sự cố</span>
            <Select
              aria-label="Loại sự cố" placeholder="Chọn hoặc gõ để tìm" value={draft.kind || undefined} disabled={busy} options={INCIDENT_KIND_GROUPS}
              showSearch={{ optionFilterProp: 'label' }}
              status={invalid(!kind) ? 'error' : undefined} onChange={value => update({ kind: value })}
            />
          </label>
          <label className="drv-input">
            <span>Vị trí (GPS tự động)</span>
            <Input
              aria-label="Vị trí" value={draft.location} disabled={busy} maxLength={255}
              placeholder={gps === 'locating' ? 'Đang lấy vị trí…' : 'Nhập vị trí, ví dụ Km 742 QL1A, Hà Tĩnh'}
              onChange={event => update({ location: event.target.value })}
            />
            {gps === 'unavailable' && !draft.location && <small>Không lấy được GPS. Bạn có thể nhập vị trí bằng tay.</small>}
          </label>
        </div>
        <label className="drv-input">
          <span>Mô tả chi tiết</span>
          <Input.TextArea
            aria-label="Mô tả chi tiết" rows={3} maxLength={2000} showCount value={draft.description} disabled={busy}
            placeholder="Chuyện gì đang xảy ra? Xe, ngựa đang ở trạng thái nào?" status={invalid(draft.description.trim().length < 5) ? 'error' : undefined}
            onChange={event => update({ description: event.target.value })}
          />
        </label>

        <h3 className="drv-card-title">3. Hư hại liên quan tới</h3>
        <DamageTargetChips value={draft.damageTarget} onChange={damageTarget => update({ damageTarget })} disabled={busy} invalid={invalid(!draft.damageTarget)} />
        {showHorse && (
          <label className="drv-input drv-horse-field">
            <span>Con ngựa liên quan{medical ? ' (bắt buộc)' : ' (nếu có)'}</span>
            <Select
              aria-label="Con ngựa liên quan" allowClear placeholder="Chọn ngựa" value={draft.horseId || undefined} disabled={busy}
              status={invalid(medical && !draft.horseId) ? 'error' : undefined} onChange={value => update({ horseId: value ?? '' })}
              options={horses.map(horse => ({ value: horse.id, label: `${horse.name} (${horse.passportNo})` }))}
            />
          </label>
        )}

        <h3 className="drv-card-title">4. Hình ảnh hiện trường{PHOTO_REQUIRED.INCIDENT ? ' (bắt buộc)' : ''}</h3>
        <div className={'drv-photo-required' + (invalid(PHOTO_REQUIRED.INCIDENT && !photos.length) ? ' is-invalid' : '')}>
          <LabeledPhotoGrid
            photos={photos} captions={captions} onError={setError} disabled={busy}
            onChange={(nextPhotos, nextCaptions) => { setPhotos(nextPhotos); setCaptions(nextCaptions); }}
          />
          {invalid(PHOTO_REQUIRED.INCIDENT && !photos.length) && <small className="drv-error-text" role="alert">Điều phối viên cần ảnh để xem và xử lý sự cố.</small>}
        </div>

        {error && <Alert type="error" showIcon title={error} />}
        <div className="drv-form-actions">
          <Button size="large" className="drv-btn-ghost" disabled={busy} onClick={onCancel}>Hủy</Button>
          <Button size="large" htmlType="submit" className="drv-btn-danger" loading={busy}>Gửi báo cáo cho điều phối</Button>
        </div>
      </form>

      <aside className="drv-side" aria-label="Hỗ trợ khi gặp sự cố">
        <WaitingChecklist tripId={trip.id} />
        <QuickContactCard coordinator={detail?.coordinator} hotline={detail?.emergencyHotline} />
        <RedNotice severity={draft.severity} />
        <ReportedIncidents incidents={reported} />
      </aside>
    </div>
  );
}
