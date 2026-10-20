import type { ILegTracking } from '@my-project/shared';
import type { NextAction } from '../tracking.format';

// antd preset colors: every status and action has its own color so the driver reads state at a glance.
export const ORDER_TAG: Record<string, { label: string; color: string }> = {
  READY: { label: 'Sẵn sàng khởi hành', color: 'blue' },
  IN_TRANSIT: { label: 'Đang vận chuyển', color: 'gold' },
  DELIVERED: { label: 'Đã giao xong', color: 'green' },
};
export const LEG_TAG: Record<string, { label: string; color: string }> = {
  NOT_STARTED: { label: 'Chưa bắt đầu', color: 'default' },
  MOVING: { label: 'Đang di chuyển', color: 'gold' },
  AT_STOP: { label: 'Đã đến điểm dừng', color: 'blue' },
  COMPLETED: { label: 'Hoàn thành', color: 'green' },
};
export const CONDITION_COLOR: Record<string, string> = { STABLE: 'green', OFF_FEED: 'orange', STRESSED: 'red', CLIMATE_CHANGE: 'blue' };
export const INCIDENT_COLOR: Record<string, string> = { VEHICLE_BREAKDOWN: 'orange', LONG_TRAFFIC_JAM: 'gold', HORSE_MEDICAL: 'red' };
export const INCIDENT_STATUS_COLOR: Record<string, string> = { NEW: 'red', ACKNOWLEDGED: 'gold', CLOSED: 'green' };
export const ALERT_COLOR: Record<string, string> = { TRAFFIC: 'orange', WEATHER: 'blue', BORDER: 'gold' };
export const LOCATION_TYPE_LABEL: Record<string, string> = {
  BORDER: 'Cửa khẩu', QUARANTINE_STATION: 'Trạm kiểm dịch', AIRPORT: 'Sân bay', REST_STOP: 'Điểm dừng nghỉ', FUEL_STOP: 'Trạm nhiên liệu',
};

/** Color of the one primary action button, by what it records. */
export function actionColor(action: NextAction): 'primary' | 'blue' | 'gold' | 'purple' | 'green' {
  if (action.kind === 'complete') return 'purple';
  return ({ DEPARTED: 'primary', ARRIVED_AT_STOP: 'blue', CUSTOMS_CLEARED: 'gold', DELIVERED: 'green' } as const)[action.milestone];
}

export function routeStops(legs: ILegTracking[]) {
  return legs.length ? [legs[0].fromLocationName, ...legs.map(leg => leg.toLocationName)] : [];
}

export const tripProgress = (legs: ILegTracking[]) => {
  const done = legs.filter(leg => leg.status === 'COMPLETED').length;
  return { done, total: legs.length, percent: legs.length ? Math.round((done / legs.length) * 100) : 0 };
};
