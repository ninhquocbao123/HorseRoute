import { Tag } from 'antd';
import type { IDriverTripDetail, IDriverTripSummary } from '@my-project/shared';
import { formatDateTime } from '../tracking.format';
import { ORDER_TAG, routeStops, tripProgress } from './driver-ui';

/** Cột trái: mọi chuyến được giao, chuyến đang chạy lên đầu. */
export default function TripList({ trips, details, selectedId, onSelect }: {
  trips: IDriverTripSummary[];
  details: Record<string, IDriverTripDetail>;
  selectedId: string;
  onSelect: (tripId: string) => void;
}) {
  const rank: Record<string, number> = { IN_TRANSIT: 0, READY: 1, DELIVERED: 2 };
  const ordered = [...trips].sort((a, b) => (rank[a.orderStatus] ?? 3) - (rank[b.orderStatus] ?? 3));

  return (
    <aside className="drv-card drv-list" aria-label="Chuyến được giao">
      <div className="drv-list-head">
        <h2>Chuyến được giao</h2>
        <span>{trips.length} chuyến</span>
      </div>
      <ul>
        {ordered.map(trip => {
          const progress = tripProgress(trip.legs);
          const stops = routeStops(trip.legs);
          const tag = ORDER_TAG[trip.orderStatus];
          const horses = details[trip.id]?.horses.length;
          return (
            <li key={trip.id}>
              <button
                type="button"
                className={'drv-trip' + (trip.id === selectedId ? ' is-selected' : '') + ' is-' + trip.orderStatus.toLowerCase()}
                aria-pressed={trip.id === selectedId}
                onClick={() => onSelect(trip.id)}
              >
                <span className="drv-trip-top">
                  <strong>{trip.orderCode}</strong>
                  <Tag color={tag?.color}>{tag?.label ?? trip.orderStatus}</Tag>
                </span>
                <span className="drv-trip-meta">Chuyến #{trip.id} · {trip.crewRole === 'DRIVER' ? 'Tài xế' : 'Hộ tống'}{horses !== undefined ? ` · ${horses} ngựa` : ''}</span>
                <span className="drv-trip-route">{stops.length ? `${stops[0]} → ${stops[stops.length - 1]}` : 'Chưa có chặng'}</span>
                <span className="drv-trip-meta">Khởi hành {formatDateTime(trip.plannedDepartureAt)}</span>
                <span className="drv-bar" aria-hidden="true"><span style={{ width: progress.percent + '%' }} /></span>
                <span className="drv-trip-meta">{progress.done}/{progress.total} chặng hoàn thành</span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
