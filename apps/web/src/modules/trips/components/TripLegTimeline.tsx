import { legStatusLabels } from '../constants/trip-status.constants';
import type { TripLeg } from '../types/trip.types';
import { formatTripDate } from '../utils/trip-list.utils';

/**
 * Vertical timeline showing trip legs sorted by seqNo.
 * Each leg shows: sequence → from → to, vehicle, times, and status.
 * Empty state when no legs exist yet.
 */
export default function TripLegTimeline({ legs }: { legs: TripLeg[] }) {
  if (legs.length === 0) {
    return (
      <div className="trip-legs-empty">
        <p>Chưa có chặng nào trong kế hoạch.</p>
        <p>Các chặng sẽ xuất hiện tại đây sau khi kế hoạch được lưu.</p>
      </div>
    );
  }

  const sorted = [...legs].sort((a, b) => a.seqNo - b.seqNo);

  return (
    <ol className="trip-leg-timeline" aria-label="Các chặng trong kế hoạch">
      {sorted.map((leg) => (
        <li key={leg.id} className="trip-leg-item">
          <div className="trip-leg-seq" aria-hidden="true">
            {String(leg.seqNo).padStart(2, '0')}
          </div>
          <div className="trip-leg-content">
            <div className="trip-leg-route">
              <span className="trip-leg-location">
                <span className="trip-leg-label">Điểm đi</span>
                {leg.fromLocationName}
              </span>
              <span className="trip-leg-arrow" aria-hidden="true">→</span>
              <span className="trip-leg-location">
                <span className="trip-leg-label">Điểm đến</span>
                {leg.toLocationName}
              </span>
            </div>
            <dl className="trip-leg-details">
              <div>
                <dt>Phương tiện</dt>
                <dd>
                  {leg.vehicleCode || 'Chưa chọn'}
                  {leg.vehicleStatus && leg.vehicleStatus !== 'AVAILABLE' && (
                    <span className="trip-leg-warning"> ({leg.vehicleStatus === 'RESERVED' ? 'Đang giữ chỗ' : 'Đang vận chuyển'})</span>
                  )}
                </dd>
              </div>
              <div>
                <dt>Khởi hành</dt>
                <dd>{formatTripDate(leg.plannedDepartureAt)}</dd>
              </div>
              <div>
                <dt>Đến dự kiến</dt>
                <dd>{formatTripDate(leg.plannedArrivalAt)}</dd>
              </div>
              <div>
                <dt>Trạng thái</dt>
                <dd>
                  <span className="trip-leg-status" data-leg-status={leg.status}>
                    {legStatusLabels[leg.status] || leg.status}
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </li>
      ))}
    </ol>
  );
}

