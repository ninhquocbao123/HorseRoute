import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Empty, Input, Select, Tag } from 'antd';
import { EditOutlined, ReloadOutlined, SendOutlined } from '@ant-design/icons';
import type { IDriverTripSummary, IHorseLog } from '@my-project/shared';
import { CONDITIONS, errorMessage, trackingApi, type TripDetail } from '../tracking.api';
import { CONDITION_LABEL, LEG_STATUS_LABEL, currentLeg, formatDateTime } from '../tracking.format';
import { useDraft } from './useDraft';
import PhotoPicker from './PhotoPicker';
import AttachmentImage from '../AttachmentImage';
import { CONDITION_COLOR } from './driver-ui';

type Draft = { legId: string; horseId: string; condition: string; note: string; correctsLogId: string };
const EMPTY: Draft = { legId: '', horseId: '', condition: '', note: '', correctsLogId: '' };

/** Tab "Nhật ký ngựa": form ghi tình trạng (trái) và nhật ký của chuyến (phải). */
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
    <div className="drv-logs">
      <section className="drv-block">
        <h3>Ghi nhật ký sức khỏe ngựa</h3>
        {notice && <Alert type="success" showIcon message={notice} role="status" />}
        {!canLog ? (
          <Alert type="info" showIcon message="Chưa thể ghi nhật ký" description="Chỉ ghi nhật ký khi chuyến đang vận chuyển và đã có chặng xuất phát." />
        ) : (
          <form className="drv-form" onSubmit={event => { event.preventDefault(); void submit(); }}>
            {correcting && (
              <Alert
                type="info" showIcon
                message={<>Đang đính chính bản ghi của <strong>{correcting.horseName}</strong> lúc {formatDateTime(correcting.loggedAt)}.</>}
                action={<Button size="small" onClick={() => setDraft({ ...draft, correctsLogId: '' })}>Hủy đính chính</Button>}
              />
            )}
            <div className="drv-form-row">
              <label className="drv-field">
                <span>Chặng</span>
                <Select aria-label="Chặng" value={legId || undefined} disabled={busy} onChange={value => setDraft({ ...draft, legId: value })}
                  options={started.map(leg => ({ value: leg.id, label: `Chặng ${leg.seqNo}: ${leg.fromLocationName} → ${leg.toLocationName} (${LEG_STATUS_LABEL[leg.status]})` }))} />
              </label>
              <label className="drv-field">
                <span>Con ngựa</span>
                <Select aria-label="Con ngựa" placeholder="Chọn ngựa" value={draft.horseId || undefined} disabled={busy || !!correcting}
                  onChange={value => setDraft({ ...draft, horseId: value })}
                  options={horses.map(horse => ({ value: horse.id, label: `${horse.name} (${horse.passportNo})` }))} />
              </label>
            </div>
            <fieldset className="drv-choice" disabled={busy}>
              <legend>Tình trạng</legend>
              {CONDITIONS.map(item => {
                const active = draft.condition === item.value;
                return (
                  <Button key={item.value} aria-pressed={active} color={CONDITION_COLOR[item.value] as 'green'} variant={active ? 'solid' : 'outlined'}
                    onClick={() => setDraft({ ...draft, condition: item.value })}>
                    <strong>{item.label}</strong>
                    <small>{item.hint}</small>
                  </Button>
                );
              })}
            </fieldset>
            <label className="drv-field">
              <span>Ghi chú</span>
              <Input.TextArea rows={3} maxLength={1000} showCount value={draft.note} disabled={busy} placeholder="Biểu hiện, ăn uống, nhiệt độ…"
                onChange={event => setDraft({ ...draft, note: event.target.value })} />
            </label>
            <div className="drv-field">
              <span>Ảnh minh chứng</span>
              <PhotoPicker files={photos} onChange={setPhotos} onError={setError} disabled={busy} />
            </div>
            {error && <Alert type="error" showIcon message={error} />}
            <div className="drv-form-actions">
              <span className="drv-muted">Nội dung được lưu tạm trên trình duyệt; nếu mất mạng chỉ cần bấm gửi lại. Ảnh cần chọn lại nếu tải lại trang.</span>
              <Button type="primary" htmlType="submit" size="large" icon={<SendOutlined />} loading={busy}>Gửi nhật ký</Button>
            </div>
          </form>
        )}
      </section>

      <section className="drv-block">
        <div className="drv-block-head">
          <h3>Nhật ký của chuyến</h3>
          <Button icon={<ReloadOutlined />} onClick={() => void loadLogs()}>Làm mới</Button>
        </div>
        {logs.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có nhật ký nào." /> : (
          <ul className="drv-log-list">
            {[...logs].reverse().map(log => (
              <li key={log.id}>
                <div className="drv-log-head">
                  <strong>{log.horseName}</strong>
                  <Tag color={CONDITION_COLOR[log.conditionStatus]}>{CONDITION_LABEL[log.conditionStatus]}</Tag>
                </div>
                <span className="drv-muted">{formatDateTime(log.loggedAt)} · {log.createdByName}{log.correctsLogId ? ` · đính chính bản #${log.correctsLogId}` : ''}</span>
                {log.note && <p>{log.note}</p>}
                {log.attachments.length > 0 && (
                  <div className="trk-thumbs">{log.attachments.map(a => <AttachmentImage key={a.id} id={a.id} name={a.originalName} />)}</div>
                )}
                {canLog && (
                  <Button type="link" size="small" icon={<EditOutlined />} className="drv-log-fix"
                    onClick={() => setDraft({ ...draft, correctsLogId: log.id, horseId: log.horseId, legId: log.legId })}>
                    Đính chính bản ghi này
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
