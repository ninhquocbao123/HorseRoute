import type { RoutePlan } from '../../coordinator/maps/TripRoutePlanner';

const waypointLabels = {
  ORIGIN: 'Điểm gửi',
  REST_STOP: 'Điểm nghỉ',
  DESTINATION: 'Điểm nhận',
} as const;

function formatDuration(seconds: number) {
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} giờ ${minutes} phút` : `${minutes} phút`;
}

export default function TripRoutePlanSummary({ routePlan }: { routePlan: RoutePlan }) {
  const route = routePlan.selectedRoute;

  return (
    <section className="trip-route-plan" aria-labelledby="trip-route-plan-title">
      <div className="trip-route-plan-heading">
        <h3 id="trip-route-plan-title">Các điểm trên lộ trình</h3>
        {route && (
          <span>
            {(route.distanceM / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km
            {' · '}{formatDuration(route.durationS)}
          </span>
        )}
      </div>
      <ol className="trip-route-waypoints">
        {routePlan.waypoints.map((waypoint, index) => (
          <li key={waypoint.id} data-kind={waypoint.kind}>
            <span className="trip-route-waypoint-index" aria-hidden="true">{index + 1}</span>
            <div>
              <span className="trip-route-waypoint-kind">{waypointLabels[waypoint.kind]}</span>
              <strong>{waypoint.label}</strong>
              {waypoint.note && <small>Ghi chú: {waypoint.note}</small>}
            </div>
          </li>
        ))}
      </ol>
      {!route && <p className="trip-route-plan-warning">Lộ trình chưa có tuyến được chọn.</p>}
    </section>
  );
}
