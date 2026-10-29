import { useEffect, useState, type ReactNode } from 'react';
import { isAxiosError } from 'axios';
import { Alert, Button, DatePicker, Modal, Switch } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import type { IDriverTripSummary, MilestoneType } from '@my-project/shared';
import { trackingApi, errorMessage, isNetworkError } from '../tracking.api';
import { MILESTONE_LABEL, currentLeg, formatDateTime, nextAction, type NextAction } from '../tracking.format';
import { pendingStore, type PendingMilestone } from './useDraft';
import { actionColor } from './driver-ui';

const COMPLETE = 'COMPLETE';

export function describeAction(type: string) {
  return type === COMPLETE ? 'Hoàn thành chặng' : MILESTONE_LABEL[type] ?? type;
}

/** Nút "Bắt đầu chuyến đi" chính là mốc xuất phát của chặng đầu khi đơn còn READY. */
export function isTripStart(action: NextAction | null, seqNo: number | undefined) {
  return action?.kind === 'milestone' && action.milestone === 'DEPARTED' && seqNo === 1;
}

type Options = {
  /** Tên hiển thị của nút/hộp thoại; mặc định là nhãn của hành động. */
  label?: (action: NextAction) => string;
  /** Tiêu đề hộp thoại khi khác tên nút (ví dụ nút chung "Check-in chặng", hộp thoại ghi rõ hành động); mặc định = label. */
  title?: (action: NextAction) => string;
  /** Nội dung thêm trong hộp thoại xác nhận (ví dụ cảnh báo checklist). */
  warning?: (action: NextAction) => ReactNode;
};

/**
 * Ghi mốc cho chặng hiện tại: xác nhận giờ, nhập bù, giữ thao tác chưa gửi khi mất mạng (pendingStore) và tải lại khi 409.
 * Trả về trạng thái để trang tự đặt nút, cùng hộp thoại xác nhận (`modal`) cần render một lần.
 */
export function useLegAction(trip: IDriverTripSummary, onChanged: () => Promise<void> | void, options: Options = {}) {
  const leg = currentLeg(trip.legs);
  const action = leg ? nextAction(leg, trip.legs, trip.orderStatus) : null;
  const [confirming, setConfirming] = useState<{ action: NextAction; tapAt: Date } | null>(null);
  const [customTime, setCustomTime] = useState<Dayjs | null>(null);
  const [backfill, setBackfill] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<PendingMilestone | null>(() => (leg ? pendingStore.get(leg.id) : null));

  useEffect(() => {
    setPending(leg ? pendingStore.get(leg.id) : null);
  }, [leg?.id]);

  const labelOf = (next: NextAction) => options.label?.(next) ?? next.label;

  function open(next: NextAction) {
    const tapAt = new Date();
    setError('');
    setNotice('');
    setBackfill(false);
    setCustomTime(dayjs(tapAt));
    setConfirming({ action: next, tapAt });
  }

  async function send(legId: string, type: string, occurredAt: string) {
    setBusy(true);
    setError('');
    try {
      if (type === COMPLETE) await trackingApi.completeLeg(legId, occurredAt);
      else await trackingApi.recordMilestone(legId, type as MilestoneType, occurredAt);
      pendingStore.clear(legId);
      setPending(null);
      setConfirming(null);
      setNotice(`Đã ghi nhận: ${describeAction(type)}.`);
      await onChanged();
    } catch (e) {
      if (isNetworkError(e)) {
        // Mất mạng: giữ nguyên giờ thực tế đã chốt để gửi lại đúng thời điểm.
        const keep = { legId, type, occurredAt };
        pendingStore.set(keep);
        setPending(keep);
        setError(errorMessage(e));
      } else if (isAxiosError(e) && e.response?.status === 409) {
        pendingStore.clear(legId);
        setPending(null);
        setConfirming(null);
        setNotice('Trạng thái chặng đã thay đổi, đã tải lại.');
        await onChanged();
      } else {
        setError(errorMessage(e));
      }
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    if (!confirming || !leg) return;
    const when = backfill ? customTime?.toDate() ?? null : confirming.tapAt;
    if (!when) return setError('Chọn giờ thực tế.');
    if (when.getTime() > Date.now() + 60_000) return setError('Giờ không được ở tương lai.');
    const type = confirming.action.kind === 'complete' ? COMPLETE : confirming.action.milestone;
    // Giữ lại giờ chốt khi bấm để nút "Gửi lại" dùng đúng giờ đó.
    void send(leg.id, type, when.toISOString());
  }

  function resend() {
    if (pending) void send(pending.legId, pending.type, pending.occurredAt);
  }

  function discard() {
    if (!pending) return;
    pendingStore.clear(pending.legId);
    setPending(null);
    setError('');
  }

  const finished = trip.legs.length > 0 && trip.legs.every(l => l.status === 'COMPLETED');
  const shownTime = backfill ? customTime : confirming ? dayjs(confirming.tapAt) : null;
  const pendingHere = pending && !confirming && leg && pending.legId === leg.id ? pending : null;

  const pendingAlert = pendingHere && (
    <Alert
      type="warning" showIcon
      title="Có thao tác chưa gửi được"
      description={<>{describeAction(pendingHere.type)} lúc {formatDateTime(pendingHere.occurredAt)}.{error && <><br /><span className="drv-error-text">{error}</span></>}</>}
      action={(
        <span className="drv-alert-actions">
          <Button type="primary" loading={busy} onClick={resend}>Gửi lại</Button>
          <Button disabled={busy} onClick={discard}>Bỏ</Button>
        </span>
      )}
    />
  );

  const modal = (
    <Modal
      open={!!confirming} centered width={520} title={confirming ? options.title?.(confirming.action) ?? labelOf(confirming.action) : undefined} destroyOnHidden
      mask={{ closable: !busy }} keyboard={!busy} onCancel={() => !busy && setConfirming(null)}
      footer={[
        <Button key="cancel" disabled={busy} onClick={() => setConfirming(null)}>Hủy</Button>,
        <Button key="ok" type="primary" color={confirming ? actionColor(confirming.action) : 'primary'} variant="solid" loading={busy} onClick={confirm}>
          {error && pending ? 'Gửi lại' : 'Xác nhận'}
        </Button>,
      ]}
    >
      {confirming && leg && (
        <div className="drv-confirm">
          <p>{confirming.action.kind === 'complete' ? 'Hoàn thành' : MILESTONE_LABEL[confirming.action.milestone]} chặng {leg.seqNo}: <strong>{leg.fromLocationName} → {leg.toLocationName}</strong>.</p>
          {options.warning?.(confirming.action)}
          <div className="drv-confirm-time">
            <span>Giờ ghi nhận</span>
            <strong>{shownTime ? formatDateTime(shownTime.toISOString()) : '—'}</strong>
          </div>
          <label className="drv-switch">
            <Switch checked={backfill} onChange={setBackfill} disabled={busy} />
            <span>Nhập bù giờ đã xảy ra</span>
          </label>
          {backfill && (
            <div className="drv-backfill">
              <DatePicker
                showTime={{ format: 'HH:mm' }} format="HH:mm DD/MM/YYYY" value={customTime} onChange={setCustomTime} allowClear={false}
                disabledDate={date => date.isAfter(dayjs(), 'minute')} aria-label="Giờ thực tế" style={{ width: '100%' }}
              />
              <span className="drv-muted">Chỉ nhập bù trong thời gian cho phép; quá hạn cần Điều phối viên hiệu chỉnh.</span>
            </div>
          )}
          {error && <Alert type="error" showIcon title={error} />}
        </div>
      )}
    </Modal>
  );

  return { leg, action, finished, open, labelOf, notice, setNotice, pendingAlert, modal };
}
