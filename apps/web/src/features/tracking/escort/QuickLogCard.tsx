import { useEffect, useState } from 'react';
import { Alert, Button, Input, Select } from 'antd';
import { isAxiosError } from 'axios';
import { CareActivityType, type ICareActivity, type ITripHorse } from '@my-project/shared';
import { errorMessage, trackingApi } from '../tracking.api';
import { toLocalInput, fromLocalInput } from '../tracking.format';
import { useDraft } from '../driver/useDraft';
import { useDriverNotice } from '../driver/DriverNotices';
import { CARE_TYPES, EMPTY_CARE_FORM, WATER_WARN_LITERS, WHOLE_HERD, careLabel, formFromActivity, isUnusualWater, toInput, validateCare, type CareForm } from './care-ui';

type Retry = { form: CareForm; remaining: string[]; total: number; at: Date; error: string };

/**
 * "Ghi nhận nhanh" (Figma E1): cho ăn / uống nước / nghỉ chân. Ô nhập đổi theo loại và khớp ràng buộc của API.
 * Ô "Ngựa" có mục "Tất cả ngựa (N con)": FEED/WATER ghi từng con (mỗi con một bản ghi, cùng nội dung và giờ; lỗi giữa chừng thì chỉ thử lại phần còn thiếu),
 * nghỉ chân ghi MỘT bản cả đoàn.
 * `editing` = đính chính một hoạt động đã ghi (khóa ngựa và loại; bản mới thay bản cũ, không có xóa).
 */
export default function QuickLogCard({ tripId, writable, horses, editing, onCancelEdit, onSaved, onTripChanged }: {
  tripId: string;
  /** Đơn còn READY / IN_TRANSIT */
  writable: boolean;
  horses: ITripHorse[];
  editing: ICareActivity | null;
  onCancelEdit: () => void;
  /** Tải lại dữ liệu E1 sau khi ghi / khi bản ghi đã đổi ở nơi khác */
  onSaved: () => Promise<void>;
  /** Tải lại chuyến (khi API cho biết đơn không còn nhận nhật ký) */
  onTripChanged: () => Promise<void>;
}) {
  const notice = useDriverNotice();
  const [draft, setDraft] = useDraft<CareForm>(`care:${tripId}`, EMPTY_CARE_FORM);
  const [editForm, setEditForm] = useState<CareForm>(EMPTY_CARE_FORM);
  // null = chưa chỉnh giờ: dùng giờ hiện tại lúc gửi (trang mở lâu vẫn ghi đúng giờ thật)
  const [editedAt, setEditedAt] = useState<string | null>(null);
  const performedAt = editedAt ?? toLocalInput(new Date());
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const [retry, setRetry] = useState<Retry | null>(null);

  useEffect(() => {
    if (!editing) return;
    setEditForm(formFromActivity(editing));
    setEditedAt(toLocalInput(new Date(editing.performedAt)));
    setTried(false);
    setError('');
    setRetry(null);
  }, [editing]);

  const form = editing ? editForm : draft;
  const update = (patch: Partial<CareForm>) => (editing ? setEditForm(previous => ({ ...previous, ...patch })) : setDraft(previous => ({ ...previous, ...patch })));
  const errors = validateCare(form, performedAt);
  const canWrite = writable && !locked;
  const type = form.activityType;
  const horseName = (id: string) => (id === WHOLE_HERD ? 'Tất cả ngựa' : horses.find(horse => horse.id === id)?.name ?? id);

  const finish = async (message: string) => {
    notice.success(message);
    if (editing) onCancelEdit();
    // Giữ loại và ngựa vừa chọn để ghi liên tiếp nhanh; xóa phần nội dung đã lưu.
    else setDraft(previous => ({ ...EMPTY_CARE_FORM, activityType: previous.activityType, horseId: previous.horseId }));
    setEditedAt(null);
    setTried(false);
    setRetry(null);
    await onSaved();
  };

  /** Ghi lần lượt; trả true khi xong hết. Lỗi giữa chừng: giữ phần còn lại để thử lại, không ghi trùng ngựa đã xong. */
  const writeAll = async (snapshot: CareForm, targets: string[], at: Date, total: number) => {
    setBusy(true);
    setError('');
    for (const [index, id] of targets.entries()) {
      try {
        await trackingApi.createCareActivity(tripId, toInput(snapshot, id === WHOLE_HERD ? null : id, at, editing?.id));
      } catch (e) {
        const message = errorMessage(e);
        setBusy(false);
        if (isAxiosError(e) && e.response?.status === 409) {
          if (editing || /đính chính/i.test(message)) {
            // Bản ghi đã được đính chính ở nơi khác: bỏ chế độ sửa và tải lại để sửa đúng bản mới nhất.
            notice.info('Hoạt động này đã được đính chính ở nơi khác', 'Danh sách đã được tải lại, hãy chọn lại bản mới nhất để sửa.');
            if (editing) onCancelEdit();
            await onSaved();
            return;
          }
          setLocked(true);
        }
        if (targets.length > 1 && index > 0) setRetry({ form: snapshot, remaining: targets.slice(index), total, at, error: message });
        else setError(message);
        if (index > 0) await onSaved();
        return;
      }
    }
    setBusy(false);
    await finish(editing ? 'Đã ghi bản đính chính.' : targets.length > 1 ? `Đã ghi cho ${total} ngựa.` : 'Đã ghi nhận hoạt động.');
  };

  const submit = async () => {
    setTried(true);
    if (!canWrite || busy || Object.keys(errors).length) return;
    const at = fromLocalInput(performedAt)!;
    // Tất cả ngựa: nghỉ chân = một bản ghi cả đoàn; cho ăn / uống nước = từng con.
    const targets = editing || form.horseId !== WHOLE_HERD || type === CareActivityType.REST ? [form.horseId] : horses.map(horse => horse.id);
    await writeAll(form, targets, at, targets.length);
  };

  const retryRest = async () => {
    if (!retry || busy) return;
    const { form: snapshot, remaining, total, at } = retry;
    setRetry(null);
    await writeAll(snapshot, remaining, at, total);
  };

  const horseOptions = [{ value: WHOLE_HERD, label: `Tất cả ngựa (${horses.length} con)` }, ...horses.map(horse => ({ value: horse.id, label: horse.name }))];
  const showError = (key: keyof typeof errors) => tried && errors[key];

  return (
    <section className="drv-card esc-quick" aria-labelledby="esc-quick-title">
      <h3 id="esc-quick-title" className="drv-card-title">{editing ? 'Đính chính hoạt động' : 'Ghi nhận nhanh'}</h3>
      {!writable && <Alert type="info" showIcon message="Chuyến không còn nhận nhật ký (đã giao hoặc đã đổi trạng thái)." />}
      <form className="esc-form" noValidate onSubmit={event => { event.preventDefault(); void submit(); }}>
        <label className="drv-input">
          <span>Hoạt động</span>
          <Select
            aria-label="Hoạt động" value={type} disabled={!canWrite || busy || !!editing}
            options={CARE_TYPES.map(value => ({ value, label: careLabel(value) }))}
            onChange={value => update({ activityType: value })}
          />
        </label>
        <label className="drv-input">
          <span>Ngựa</span>
          <Select
            aria-label="Ngựa" placeholder="Chọn ngựa" value={form.horseId || undefined} disabled={!canWrite || busy || !!editing}
            options={horseOptions} status={showError('horseId') ? 'error' : undefined} onChange={value => update({ horseId: value })}
          />
          {showError('horseId') && <small className="esc-error" role="alert">{errors.horseId}</small>}
        </label>
        {type === CareActivityType.FEED && (
          <label className="drv-input">
            <span>Khẩu phần</span>
            <Input aria-label="Khẩu phần" maxLength={200} placeholder="Ví dụ: Cỏ khô 3 kg + cà rốt" value={form.feedDescription} disabled={!canWrite || busy}
              status={showError('feedDescription') ? 'error' : undefined} onChange={event => update({ feedDescription: event.target.value })} />
            {showError('feedDescription') && <small className="esc-error" role="alert">{errors.feedDescription}</small>}
          </label>
        )}
        {type === CareActivityType.WATER && (
          <label className="drv-input">
            <span>Lượng nước (lít)</span>
            <Input aria-label="Lượng nước (lít)" inputMode="decimal" placeholder="Ví dụ: 10 hoặc 7,5" value={form.amountLiters} disabled={!canWrite || busy}
              status={showError('amountLiters') ? 'error' : undefined} onChange={event => update({ amountLiters: event.target.value })} />
            {showError('amountLiters') && <small className="esc-error" role="alert">{errors.amountLiters}</small>}
          </label>
        )}
        {isUnusualWater(form) && (
          <Alert type="warning" showIcon message="Lượng nước bất thường, kiểm tra lại." description={`Trên ${WATER_WARN_LITERS} lít cho mỗi con. Bạn vẫn lưu được nếu số liệu đúng.`} />
        )}
        {type === CareActivityType.REST && (
          <label className="drv-input">
            <span>Thời gian nghỉ (phút)</span>
            <Input aria-label="Thời gian nghỉ (phút)" inputMode="numeric" placeholder="Ví dụ: 20" value={form.durationMinutes} disabled={!canWrite || busy}
              status={showError('durationMinutes') ? 'error' : undefined} onChange={event => update({ durationMinutes: event.target.value })} />
            {showError('durationMinutes') && <small className="esc-error" role="alert">{errors.durationMinutes}</small>}
          </label>
        )}
        <label className="drv-input">
          <span>Ghi chú (không bắt buộc)</span>
          <Input aria-label="Ghi chú" maxLength={255} value={form.note} disabled={!canWrite || busy} onChange={event => update({ note: event.target.value })} />
        </label>
        <label className="drv-input">
          <span>Giờ thực hiện</span>
          <Input aria-label="Giờ thực hiện" type="datetime-local" value={performedAt} disabled={!canWrite || busy}
            status={showError('performedAt') ? 'error' : undefined} onChange={event => setEditedAt(event.target.value)} />
          {showError('performedAt') && <small className="esc-error" role="alert">{errors.performedAt}</small>}
        </label>
        {error && (
          <Alert
            type="error" showIcon message={error}
            action={locked ? <Button size="small" onClick={() => void onTripChanged()}>Tải lại chuyến</Button> : undefined}
          />
        )}
        {retry && (
          <Alert
            type="warning" showIcon message={`Đã ghi ${retry.total - retry.remaining.length}/${retry.total} ngựa. ${retry.error}`}
            description={`Chưa ghi: ${retry.remaining.map(horseName).join(', ')}.`}
            action={<Button size="small" onClick={() => void retryRest()} loading={busy}>Thử lại ngựa còn lại</Button>}
          />
        )}
        <div className="esc-form-actions">
          {editing && <Button size="large" className="drv-btn-ghost" disabled={busy} onClick={onCancelEdit}>Hủy sửa</Button>}
          <Button size="large" htmlType="submit" className="esc-save" loading={busy} disabled={!canWrite}>
            {editing ? 'Lưu bản đính chính' : 'Lưu nhật ký'}
          </Button>
        </div>
      </form>
    </section>
  );
}
