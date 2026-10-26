import { Alert, Button, Tag, Timeline } from 'antd';
import type { IDriverTripSummary } from '@my-project/shared';
import { MILESTONE_LABEL, formatDateTime } from '../tracking.format';
import { LEG_TAG, actionColor } from './driver-ui';
import { useLegAction } from './useLegAction';

const TIMELINE_COLOR: Record<string, string> = { COMPLETED: 'green', MOVING: 'gold', AT_STOP: 'blue', NOT_STARTED: 'gray' };

/** Chặng hiện tại với một nút hành động, cùng lịch sử mốc của mọi chặng. Logic ghi mốc nằm trong useLegAction. */
export default function MilestonePanel({ trip, onChanged }: { trip: IDriverTripSummary; onChanged: () => Promise<void> | void }) {
  const { leg, action, finished, open, notice, pendingAlert, modal } = useLegAction(trip, onChanged);

  return (
    <div className="drv-milestones">
      <div className="drv-milestones-main">
        {notice && <Alert type="success" showIcon message={notice} role="status" />}

        {pendingAlert}

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
              <Alert type="info" showIcon message="Chưa thể cập nhật chặng này lúc này" description="Chờ chặng trước hoàn thành hoặc đơn hàng chuyển sang sẵn sàng." />
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
                  <Tag bordered={false} className="drv-status-tag">{LEG_TAG[item.status]?.label}</Tag>
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

      {modal}
    </div>
  );
}
