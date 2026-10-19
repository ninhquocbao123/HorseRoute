import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import type { IDriverTripSummary, MilestoneType } from '@my-project/shared';
import { trackingApi, errorMessage, isNetworkError } from '../tracking.api';
import {
  LEG_STATUS_LABEL,
  MILESTONE_LABEL,
  currentLeg,
  formatDateTime,
  fromLocalInput,
  nextAction,
  toLocalInput,
  type NextAction,
} from '../tracking.format';
import { pendingStore, type PendingMilestone } from './useDraft';
import Sheet from '../Sheet';

const COMPLETE = 'COMPLETE';

function describe(type: string) {
  return type === COMPLETE ? 'Hoàn thành chặng' : MILESTONE_LABEL[type] ?? type;
}

export default function MilestonePanel({ trip, onChanged }: { trip: IDriverTripSummary; onChanged: () => Promise<void> | void }) {
  const leg = currentLeg(trip.legs);
  const action = leg ? nextAction(leg, trip.legs, trip.orderStatus) : null;
  const [sheet, setSheet] = useState<{ action: NextAction; tapAt: Date } | null>(null);
  const [editTime, setEditTime] = useState(false);
  const [localTime, setLocalTime] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<PendingMilestone | null>(() => (leg ? pendingStore.get(leg.id) : null));

  useEffect(() => {
    setPending(leg ? pendingStore.get(leg.id) : null);
  }, [leg?.id]);

  function open(next: NextAction) {
    const tapAt = new Date();
    setError('');
    setNotice('');
    setEditTime(false);
    setLocalTime(toLocalInput(tapAt));
    setSheet({ action: next, tapAt });
  }

  async function send(legId: string, type: string, occurredAt: string) {
    setBusy(true);
    setError('');
    try {
      if (type === COMPLETE) await trackingApi.completeLeg(legId, occurredAt);
      else await trackingApi.recordMilestone(legId, type as MilestoneType, occurredAt);
      pendingStore.clear(legId);
      setPending(null);
      setSheet(null);
      setNotice(`Đã ghi nhận: ${describe(type)}.`);
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
        setSheet(null);
        setNotice('Trạng thái chặng đã thay đổi. Đã tải lại dữ liệu mới nhất.');
        await onChanged();
      } else {
        setError(errorMessage(e));
      }
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    if (!sheet || !leg) return;
    const when = editTime ? fromLocalInput(localTime) : sheet.tapAt;
    if (!when) return setError('Giờ không hợp lệ.');
    if (when.getTime() > Date.now() + 60_000) return setError('Giờ không được ở tương lai.');
    const type = sheet.action.kind === 'complete' ? COMPLETE : sheet.action.milestone;
    // Giữ lại giờ chốt khi bấm để nút "Gửi lại" dùng đúng giờ đó.
    void send(leg.id, type, when.toISOString());
  }

  const finished = trip.legs.length > 0 && trip.legs.every(l => l.status === 'COMPLETED');

  return (
    <div className="trk-stack">
      {notice && <p className="trk-notice" role="status">{notice}</p>}

      {pending && !sheet && leg && pending.legId === leg.id && (
        <div className="trk-banner" role="alert">
          <div>
            <strong>Có thao tác chưa gửi được</strong>
            <p>{describe(pending.type)} lúc {formatDateTime(pending.occurredAt)}</p>
            {error && <p className="trk-error-text">{error}</p>}
          </div>
          <div className="trk-banner-actions">
            <button type="button" className="trk-primary" disabled={busy} onClick={() => void send(pending.legId, pending.type, pending.occurredAt)}>
              {busy ? 'Đang gửi…' : 'Gửi lại'}
            </button>
            <button
              type="button"
              className="trk-secondary"
              disabled={busy}
              onClick={() => {
                pendingStore.clear(pending.legId);
                setPending(null);
                setError('');
              }}
            >
              Bỏ
            </button>
          </div>
        </div>
      )}

      {leg && (
        <section className="trk-current" aria-label="Chặng hiện tại">
          <span className="trk-caption">CHẶNG {leg.seqNo}/{trip.legs.length} · {LEG_STATUS_LABEL[leg.status].toUpperCase()}</span>
          <h2 className="trk-leg-title">{leg.fromLocationName} <span aria-hidden="true">→</span> {leg.toLocationName}</h2>
          <p className="trk-muted">Dự kiến {formatDateTime(leg.plannedDepartureAt)} – {formatDateTime(leg.plannedArrivalAt)}{leg.toLocationType === 'BORDER' ? ' · Cửa khẩu' : ''}</p>
          {action ? (
            <>
              <button type="button" className="trk-action" onClick={() => open(action)}>{action.label}</button>
              <p className="trk-muted">{action.hint}</p>
            </>
          ) : finished ? null : (
            <p className="trk-hint">Chưa thể cập nhật chặng này lúc này (chờ chặng trước hoàn thành hoặc đơn hàng sẵn sàng).</p>
          )}
        </section>
      )}
      {finished && <p className="trk-notice">Tất cả các chặng đã hoàn thành. Cảm ơn bạn!</p>}

      <section className="portal-panel trk-panel">
        <div className="portal-panel-heading"><h2>Các chặng của chuyến</h2></div>
        <ol className="trk-legs">
          {trip.legs.map(item => (
            <li key={item.id} className={leg?.id === item.id ? 'is-current' : ''}>
              <div className="trk-leg-head">
                <strong>Chặng {item.seqNo}: {item.fromLocationName} → {item.toLocationName}</strong>
                <span className="status-chip" data-status={item.status}>{LEG_STATUS_LABEL[item.status]}</span>
              </div>
              {item.milestones.length > 0 ? (
                <ul className="trk-milestones">
                  {item.milestones.map(m => (
                    <li key={m.id}><span>{MILESTONE_LABEL[m.milestoneType]}</span><time dateTime={m.occurredAt}>{formatDateTime(m.occurredAt)}</time></li>
                  ))}
                </ul>
              ) : (
                <p className="trk-muted">Chưa có mốc nào.</p>
              )}
            </li>
          ))}
        </ol>
      </section>

      {sheet && (
        <Sheet title={sheet.action.label} caption="XÁC NHẬN MỐC HÀNH TRÌNH" onClose={() => !busy && setSheet(null)}>
          <p>
            {sheet.action.kind === 'complete' ? 'Hoàn thành' : MILESTONE_LABEL[sheet.action.milestone]} chặng {leg?.seqNo}: {leg?.fromLocationName} → {leg?.toLocationName}.
          </p>
          <div className="trk-time">
            <span>Giờ ghi nhận</span>
            <strong>{formatDateTime((editTime ? fromLocalInput(localTime) ?? sheet.tapAt : sheet.tapAt).toISOString())}</strong>
            <button type="button" className="trk-link" onClick={() => setEditTime(!editTime)}>{editTime ? 'Dùng giờ hiện tại' : 'Nhập bù giờ đã xảy ra'}</button>
          </div>
          {editTime && (
            <label className="trk-field">
              Giờ thực tế
              <input type="datetime-local" value={localTime} max={toLocalInput(new Date())} onChange={event => setLocalTime(event.target.value)} />
              <small>Chỉ nhập bù trong thời gian cho phép; quá hạn cần Điều phối viên hiệu chỉnh.</small>
            </label>
          )}
          {error && <p className="error" role="alert">{error}</p>}
          <div className="trk-sheet-actions">
            <button type="button" className="trk-secondary" disabled={busy} onClick={() => setSheet(null)}>Hủy</button>
            <button type="button" className="trk-primary" disabled={busy} onClick={confirm}>
              {busy ? 'Đang gửi…' : error && pending ? 'Gửi lại' : 'Xác nhận'}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
