import { orderStatusLabels, tripPlanStatusLabels } from "../constants/trip-status.constants";
import type { TripPlanStatus } from "../types/trip.types";

interface PlanBadgeProps {
  status: TripPlanStatus;
  /** When DRAFT has a return reason, badge shows "Bản nháp · Cần chỉnh sửa" */
  hasReturnReason?: boolean;
}

export default function TripStatusBadge({ status, hasReturnReason }: PlanBadgeProps) {
  const label = tripPlanStatusLabels[status] || status;
  const suffix = status === 'DRAFT' && hasReturnReason ? ' · Cần chỉnh sửa' : '';
  return (
    <span
      className="trip-status"
      data-status={status}
      data-returned={status === 'DRAFT' && hasReturnReason ? '' : undefined}
    >
      {label}{suffix}
    </span>
  );
}

export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <span className="trip-status" data-order-status={status}>
      {orderStatusLabels[status] || status}
    </span>
  );
}
