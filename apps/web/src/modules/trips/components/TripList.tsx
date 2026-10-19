import type { TripSummary } from "../types/trip.types";
import { formatTripDate } from "../utils/trip-list.utils";
import TripStatusBadge from "./TripStatusBadge";

type Props = { items: TripSummary[]; onOpenTrip: (id: string) => void };

export default function TripList({ items, onOpenTrip }: Props) {
  return (
    <div className="trip-list">
      <table className="trip-list-table">
        <caption className="trip-sr-only">
          Danh sách chuyến vận chuyển, thời gian theo UTC+07:00
        </caption>
        <thead>
          <tr>
            {[
              "ID chuyến",
              "Mã đơn",
              "Kế hoạch",
              "Khởi hành dự kiến",
              "Đến dự kiến",
              "Thao tác",
            ].map((label) => (
              <th key={label} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((trip) => (
            <tr key={trip.id}>
              <th scope="row">#{trip.id}</th>
              <td>{trip.orderCode}</td>
              <td>
                <TripStatusBadge status={trip.planStatus} />
              </td>
              <td>{formatTripDate(trip.plannedDepartureAt)}</td>
              <td>{formatTripDate(trip.plannedArrivalAt)}</td>
              <td>
                <button
                  type="button"
                  aria-label={`Xem chi tiết chuyến ${trip.id}`}
                  onClick={() => onOpenTrip(trip.id)}
                >
                  Xem chi tiết
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="trip-list-cards" aria-label="Danh sách chuyến vận chuyển">
        {items.map((trip) => (
          <li key={trip.id} className="trip-list-card">
            <div className="trip-card-heading">
              <h3>Chuyến #{trip.id}</h3>
              <TripStatusBadge status={trip.planStatus} />
            </div>
            <dl>
              <div>
                <dt>Mã đơn</dt>
                <dd>{trip.orderCode}</dd>
              </div>
              <div>
                <dt>Khởi hành dự kiến</dt>
                <dd>{formatTripDate(trip.plannedDepartureAt)}</dd>
              </div>
              <div>
                <dt>Đến dự kiến</dt>
                <dd>{formatTripDate(trip.plannedArrivalAt)}</dd>
              </div>
            </dl>
            <button
              type="button"
              aria-label={`Xem chi tiết chuyến ${trip.id}`}
              onClick={() => onOpenTrip(trip.id)}
            >
              Xem chi tiết →
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
