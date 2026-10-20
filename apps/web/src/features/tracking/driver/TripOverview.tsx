import { Button, Steps, Table, Tag } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import type { IDriverTripSummary } from '@my-project/shared';
import type { TripDetail, TripHorse } from '../tracking.api';
import { currentLeg, formatDateTime, nextAction } from '../tracking.format';
import { LEG_TAG, LOCATION_TYPE_LABEL, actionColor } from './driver-ui';

const HORSE_STATUS: Record<string, { label: string; color: string }> = {
  NORMAL: { label: 'Vận chuyển', color: 'green' }, FLAGGED: { label: 'Cần xử lý', color: 'red' },
};

/** Tab "Tổng quan chuyến": lộ trình từng chặng, việc cần làm tiếp theo, danh sách ngựa. */
export default function TripOverview({ trip, detail, onOpen }: { trip: IDriverTripSummary; detail: TripDetail | undefined; onOpen: (view: string) => void }) {
  const leg = currentLeg(trip.legs);
  const action = leg ? nextAction(leg, trip.legs, trip.orderStatus) : null;
  const finished = trip.legs.length > 0 && trip.legs.every(l => l.status === 'COMPLETED');
  const currentIndex = leg ? trip.legs.findIndex(l => l.id === leg.id) : trip.legs.length;

  return (
    <div className="drv-overview">
      <section className="drv-block">
        <h3>Lộ trình các chặng</h3>
        {trip.legs.length === 0 ? <p className="drv-muted">Kế hoạch chưa có chặng.</p> : (
          <Steps
            direction="vertical" size="small" current={currentIndex}
            status={finished ? 'finish' : 'process'}
            items={trip.legs.map(item => ({
              title: <span className="drv-step-title">Chặng {item.seqNo}: {item.fromLocationName} → {item.toLocationName}</span>,
              description: (
                <div className="drv-step-body">
                  <span className="drv-tags">
                    <Tag color={LEG_TAG[item.status]?.color}>{LEG_TAG[item.status]?.label}</Tag>
                    {item.toLocationType === 'BORDER' && <Tag color="gold">Cửa khẩu · cần thông quan</Tag>}
                    {item.toLocationType !== 'BORDER' && LOCATION_TYPE_LABEL[item.toLocationType] && <Tag>{LOCATION_TYPE_LABEL[item.toLocationType]}</Tag>}
                    {item.vehicleCode && <Tag color="geekblue">Xe {item.vehicleCode}</Tag>}
                  </span>
                  <span>Dự kiến: {formatDateTime(item.plannedDepartureAt)} → {formatDateTime(item.plannedArrivalAt)}</span>
                  {(item.actualDepartureAt || item.actualArrivalAt) && (
                    <span>Thực tế: {formatDateTime(item.actualDepartureAt)} → {formatDateTime(item.actualArrivalAt)}</span>
                  )}
                </div>
              ),
            }))}
          />
        )}
      </section>

      <div className="drv-overview-side">
        <section className={'drv-block drv-next' + (action ? ' is-' + actionColor(action) : '')}>
          <h3>Việc cần làm tiếp theo</h3>
          {action && leg ? (
            <>
              <p><strong>{action.label.charAt(0) + action.label.slice(1).toLowerCase()}</strong> · Chặng {leg.seqNo}: {leg.fromLocationName} → {leg.toLocationName}</p>
              <p className="drv-muted">{action.hint}</p>
              <Button type="primary" color={actionColor(action)} variant="solid" icon={<ArrowRightOutlined />} onClick={() => onOpen('milestones')}>
                Mở mốc hành trình
              </Button>
            </>
          ) : finished ? (
            <p>Tất cả các chặng đã hoàn thành. Cảm ơn bạn!</p>
          ) : (
            <p className="drv-muted">Chưa có thao tác nào lúc này: chờ chặng trước hoàn thành hoặc đơn hàng sẵn sàng.</p>
          )}
        </section>

        <section className="drv-block">
          <h3>Ngựa trên chuyến</h3>
          <Table<TripHorse>
            rowKey="id" size="small" pagination={false} loading={!detail}
            dataSource={detail?.horses ?? []}
            locale={{ emptyText: 'Chưa có ngựa.' }}
            columns={[
              { title: 'Tên ngựa', dataIndex: 'name', render: (name: string) => <strong>{name}</strong> },
              { title: 'Số hộ chiếu', dataIndex: 'passportNo' },
              { title: 'Trạng thái', dataIndex: 'orderStatus', render: (status: string) => <Tag color={HORSE_STATUS[status]?.color}>{HORSE_STATUS[status]?.label ?? status}</Tag> },
            ]}
          />
        </section>
      </div>
    </div>
  );
}
