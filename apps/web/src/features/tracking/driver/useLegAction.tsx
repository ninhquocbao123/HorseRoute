import { useEffect, useState, type ReactNode } from 'react';
import { isAxiosError } from 'axios';
import { Alert, Button } from 'antd';
import type { IDriverTripSummary, MilestoneType } from '@my-project/shared';
import { trackingApi, errorMessage, isNetworkError } from '../tracking.api';
import { MILESTONE_LABEL, currentLeg, formatDateTime, nextAction, type NextAction } from '../tracking.format';
import { pendingStore, type PendingMilestone } from './useDraft';
import CheckInDialog from './CheckInDialog';

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

  function confirm(when: Date) {
    if (!confirming || !leg) return;
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
    <CheckInDialog
      open={!!confirming} tapAt={confirming?.tapAt ?? null} busy={busy} error={error}
      kicker={leg && trip.legs.length > 1 ? `Chặng ${leg.seqNo}/${trip.legs.length}` : undefined}
      heading={confirming ? options.title?.(confirming.action) ?? labelOf(confirming.action) : ''}
      routeLabel="Lộ trình chuyến"
      route={leg ? <>{leg.fromLocationName} → {leg.toLocationName}</> : null}
      detail={confirming ? (confirming.action.kind === 'complete' ? 'Hoàn thành chặng' : MILESTONE_LABEL[confirming.action.milestone]) : undefined}
      confirmLabel={error && pending ? 'Gửi lại' : 'Xác nhận'}
      onCancel={() => setConfirming(null)} onConfirm={confirm}
    >
      {confirming && options.warning?.(confirming.action)}
    </CheckInDialog>
  );

  return { leg, action, finished, open, labelOf, notice, setNotice, pendingAlert, modal };
}
