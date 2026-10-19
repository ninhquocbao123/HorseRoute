import type { TripDetail } from '../types/trip.types';
import { formatTripDate } from '../utils/trip-list.utils';

/**
 * Sidebar summary panel shown on the trip detail page.
 * Displays IDs (plannedBy, approvedBy) as-is per doc: no name lookup when API returns only IDs.
 */
export default function TripSummary({ trip }: { trip: TripDetail }) {
  return (
    <>
    <p className="trip-timezone">Thời gian: UTC+07:00.</p>
    <dl className="trip-summary-dl">
      <div>
        <dt>ID chuyến</dt>
        <dd>#{trip.id}</dd>
      </div>
      <div>
        <dt>Mã đơn</dt>
        <dd>{trip.orderCode}</dd>
      </div>
      <div>
        <dt>Người lập kế hoạch (ID)</dt>
        <dd>{trip.plannedBy}</dd>
      </div>
      <div>
        <dt>Khởi hành dự kiến</dt>
        <dd>{formatTripDate(trip.plannedDepartureAt)}</dd>
      </div>
      <div>
        <dt>Đến dự kiến</dt>
        <dd>{formatTripDate(trip.plannedArrivalAt)}</dd>
      </div>
      {trip.approvedBy !== null && (
        <div>
          <dt>Người duyệt (ID)</dt>
          <dd>{trip.approvedBy}</dd>
        </div>
      )}
      {trip.approvedAt !== null && (
        <div>
          <dt>Thời điểm duyệt</dt>
          <dd>{formatTripDate(trip.approvedAt)}</dd>
        </div>
      )}
    </dl>
    </>
  );
}

