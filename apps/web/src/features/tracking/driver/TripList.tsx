import type { IDriverTripSummary } from '@my-project/shared';
import type { TripDetail } from '../tracking.api';
import { LEG_STATUS_LABEL, ORDER_STATUS_LABEL, formatDateTime } from '../tracking.format';

function routeSummary(trip: IDriverTripSummary) {
  if (!trip.legs.length) return 'Chưa có chặng';
  const stops = [trip.legs[0].fromLocationName, ...trip.legs.map(leg => leg.toLocationName)];
  return stops.join(' → ');
}

export default function TripList({ trips, details, selectedId, onSelect, onOpen }: {
  trips: IDriverTripSummary[];
  details: Record<string, TripDetail>;
  selectedId: string | null;
  onSelect: (tripId: string) => void;
  onOpen: (view: string) => void;
}) {
  if (!trips.length) {
    return (
      <div className="portal-empty">
        <span aria-hidden="true">◇</span>
        <h3>Chưa có chuyến nào được giao</h3>
        <p>Chuyến sẽ xuất hiện ở đây khi điều phối viên phân công bạn và đơn hàng đã sẵn sàng.</p>
      </div>
    );
  }

  return (
    <ul className="trk-cards">
      {trips.map(trip => {
        const done = trip.legs.filter(leg => leg.status === 'COMPLETED').length;
        const current = trip.legs.find(leg => leg.status === 'MOVING' || leg.status === 'AT_STOP');
        const vehicles = [...new Set(trip.legs.map(leg => leg.vehicleCode).filter(Boolean))].join(', ');
        const horses = details[trip.id]?.horses.length;
        const selected = trip.id === selectedId;
        return (
          <li key={trip.id} className={'trk-card' + (selected ? ' is-selected' : '')}>
            <div className="trk-card-head">
              <div>
                <strong className="trk-card-title">{trip.orderCode}</strong>
                <span className="trk-muted">Chuyến #{trip.id} · {trip.crewRole === 'DRIVER' ? 'Tài xế' : 'Hộ tống'}</span>
              </div>
              <span className="status-chip" data-status={trip.orderStatus}>{ORDER_STATUS_LABEL[trip.orderStatus] ?? trip.orderStatus}</span>
            </div>
            <p className="trk-route">{routeSummary(trip)}</p>
            <dl className="trk-facts">
              <div><dt>Xe</dt><dd>{vehicles || '—'}</dd></div>
              <div><dt>Ngựa</dt><dd>{horses ?? '…'}</dd></div>
              <div><dt>Khởi hành</dt><dd>{formatDateTime(trip.plannedDepartureAt)}</dd></div>
              <div><dt>Dự kiến đến</dt><dd>{formatDateTime(trip.plannedArrivalAt)}</dd></div>
            </dl>
            <div className="trk-progress" role="img" aria-label={`Đã hoàn thành ${done} trên ${trip.legs.length} chặng`}>
              {trip.legs.map(leg => <span key={leg.id} data-status={leg.status} title={LEG_STATUS_LABEL[leg.status]} />)}
            </div>
            <p className="trk-muted">
              {current ? `Chặng ${current.seqNo}: ${LEG_STATUS_LABEL[current.status]}` : `${done}/${trip.legs.length} chặng hoàn thành`}
            </p>
            <div className="trk-card-actions">
              <button
                type="button"
                className="trk-primary"
                onClick={() => {
                  onSelect(trip.id);
                  onOpen('milestones');
                }}
              >
                Cập nhật mốc
              </button>
              <button
                type="button"
                className="trk-secondary"
                onClick={() => {
                  onSelect(trip.id);
                  onOpen('horse-logs');
                }}
              >
                Nhật ký ngựa
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
