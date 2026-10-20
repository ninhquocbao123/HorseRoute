import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { Alert, Button, DatePicker, Modal, Switch, Tag, Timeline } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import type { IDriverTripSummary, MilestoneType } from '@my-project/shared';
import { trackingApi, errorMessage, isNetworkError } from '../tracking.api';
import { MILESTONE_LABEL, currentLeg, formatDateTime, nextAction, type NextAction } from '../tracking.format';
import { pendingStore, type PendingMilestone } from './useDraft';
import { LEG_TAG, actionColor } from './driver-ui';

const COMPLETE = 'COMPLETE';
const TIMELINE_COLOR: Record<string, string> = { COMPLETED: 'green', MOVING: 'gold', AT_STOP: 'blue', NOT_STARTED: 'gray' };

function describe(type: string) {
  return type === COMPLETE ? 'Hoàn thành chặng' : MILESTONE_LABEL[type] ?? type;
}

/** Tab "Mốc hành trình": một nút hành động cho chặng hiện tại, xác nhận giờ, và lịch sử mốc của mọi chặng. */
export default function MilestonePanel({ trip, onChanged }: { trip: IDriverTripSummary; onChanged: () => Promise<void> | void }) {
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
        setConfirming(null);
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
    if (!confirming || !leg) return;
    const when = backfill ? customTime?.toDate() ?? null : confirming.tapAt;
    if (!when) return setError('Chọn giờ thực tế.');
    if (when.getTime() > Date.now() + 60_000) return setError('Giờ không được ở tương lai.');
    const type = confirming.action.kind === 'complete' ? COMPLETE : confirming.action.milestone;
    // Giữ lại giờ chốt khi bấm để nút "Gửi lại" dùng đúng giờ đó.
    void send(leg.id, type, when.toISOString());
  }

  const finished = trip.legs.length > 0 && trip.legs.every(l => l.status === 'COMPLETED');
  const shownTime = backfill ? customTime : confirming ? dayjs(confirming.tapAt) : null;

  return (
    <div className="drv-milestones">
      <div className="drv-milestones-main">
        {notice && <Alert type="success" showIcon message={notice} role="status" />}

        {pending && !confirming && leg && pending.legId === leg.id && (
          <Alert
            type="warning" showIcon
            message="Có thao tác chưa gửi được"
            description={<>{describe(pending.type)} lúc {formatDateTime(pending.occurredAt)}.{error && <><br /><span className="drv-error-text">{error}</span></>}</>}
            action={(
              <span className="drv-alert-actions">
                <Button type="primary" loading={busy} onClick={() => void send(pending.legId, pending.type, pending.occurredAt)}>Gửi lại</Button>
                <Button disabled={busy} onClick={() => { pendingStore.clear(pending.legId); setPending(null); setError(''); }}>Bỏ</Button>
              </span>
            )}
          />
        )}

        {leg && (
          <section className="drv-current" aria-label="Chặng hiện tại">
            <span className="drv-overline">Chặng {leg.seqNo}/{trip.legs.length} · {LEG_TAG[leg.status]?.label}</span>
            <h3 className="drv-current-title">{leg.fromLocationName} <span aria-hidden="true">→</span> {leg.toLocationName}</h3>
            <dl className="drv-current-facts">
              <div><dt>Khởi hành dự kiến</dt><dd>{formatDateTime(leg.plannedDepartureAt)}</dd></div>
              <div><dt>Đến dự kiến</dt><dd>{formatDateTime(leg.plannedArrivalAt)}</dd></div>
              <div><dt>Phương tiện</dt><dd>{leg.vehicleCode ?? '—'}</dd></div>
              <div><dt>Điểm đến</dt><dd>{leg.toLocationType === 'BORDER' ? <Tag color="gold">Cửa khẩu · cần thông quan</Tag> : 'Điểm dừng'}</dd></div>
            </dl>
            {action ? (
              <div className="drv-current-action">
                <Button type="primary" size="large" color={actionColor(action)} variant="solid" className="drv-action" onClick={() => open(action)}>
                  {action.label}
                </Button>
                <span className="drv-muted">{action.hint}</span>
              </div>
            ) : !finished && (
              <Alert type="info" showIcon message="Chưa thể cập nhật chặng này lúc này" description="Chờ chặng trước hoàn thành hoặc đơn hàng được đánh dấu sẵn sàng." />
            )}
          </section>
        )}
        {finished && <Alert type="success" showIcon message="Tất cả các chặng đã hoàn thành. Cảm ơn bạn!" />}
        {!leg && !finished && <Alert type="info" showIcon message="Kế hoạch chuyến chưa có chặng." />}
      </div>

      <section className="drv-block drv-history">
        <h3>Lịch sử mốc theo chặng</h3>
        <Timeline
          items={trip.legs.map(item => ({
            color: TIMELINE_COLOR[item.status],
            children: (
              <div className={'drv-history-leg' + (leg?.id === item.id ? ' is-current' : '')}>
                <div className="drv-history-head">
                  <strong>Chặng {item.seqNo}: {item.fromLocationName} → {item.toLocationName}</strong>
                  <Tag color={LEG_TAG[item.status]?.color}>{LEG_TAG[item.status]?.label}</Tag>
                </div>
                {item.milestones.length > 0 ? (
                  <ul>
                    {item.milestones.map(m => (
                      <li key={m.id}>
                        <span>{MILESTONE_LABEL[m.milestoneType]}</span>
                        <time dateTime={m.occurredAt}>{formatDateTime(m.occurredAt)}</time>
                        <span className="drv-muted">{m.recordedByName}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="drv-muted">Chưa có mốc nào.</p>}
              </div>
            ),
          }))}
        />
      </section>

      <Modal
        open={!!confirming} centered width={520} title={confirming?.action.label} destroyOnHidden
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
            {error && <Alert type="error" showIcon message={error} />}
          </div>
        )}
      </Modal>
    </div>
  );
}
