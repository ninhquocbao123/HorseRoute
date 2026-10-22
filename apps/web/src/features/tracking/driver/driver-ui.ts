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

export type TripStop = { key: string; name: string; note: string; plannedAt: string; dayOffset: number; reached: boolean };

const STOP_NOTE: Record<string, string> = {
  REST_STOP: 'Dừng nghỉ', FUEL_STOP: 'Tiếp nhiên liệu', BORDER: 'Thông quan cửa khẩu', QUARANTINE_STATION: 'Kiểm dịch', AIRPORT: 'Sân bay',
};

const localDay = (iso: string) => {
  const date = new Date(iso);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
};

/**
 * Các chặng thành danh sách điểm dừng: điểm 1 = legs[0].from (giờ xuất phát dự kiến), điểm i = legs[i].to (giờ đến dự kiến).
 * `dayOffset` là số ngày sau ngày khởi hành (hiển thị "+1", "+2"). Ghi chú suy theo mục 2.1: không có dữ liệu "nghỉ đêm".
 */
export function tripStops(legs: ILegTracking[], horseCount: number): TripStop[] {
  if (!legs.length) return [];
  const first = legs[0];
  const startDay = localDay(first.plannedDepartureAt);
  const start: TripStop = {
    key: 'start', name: first.fromLocationName, note: `Nhận ${horseCount} ngựa`,
    plannedAt: first.plannedDepartureAt, dayOffset: 0, reached: first.status !== 'NOT_STARTED',
  };
  return [start, ...legs.map((leg, index) => ({
    key: leg.id,
    name: leg.toLocationName,
    note: index === legs.length - 1 ? 'Bàn giao' : STOP_NOTE[leg.toLocationType] ?? 'Điểm dừng',
    plannedAt: leg.plannedArrivalAt,
    dayOffset: localDay(leg.plannedArrivalAt) - startDay,
    reached: leg.status === 'AT_STOP' || leg.status === 'COMPLETED',
  }))];
}

/** 5 mục kiểm tra trước khi chạy (Figma D1); tick lưu ở client theo chuyến (quyết định 5.3). */
export const PRE_DEPARTURE_CHECKS = [
  { id: 'vehicle', label: 'Lốp, phanh, đèn đã kiểm tra' },
  { id: 'stall', label: 'Khoang ngựa vệ sinh, có lót sàn' },
  { id: 'supplies', label: 'Nước 120 L, thức ăn đủ 3 ngày' },
  { id: 'papers', label: 'Giấy kiểm dịch mang theo' },
  { id: 'loaded', label: 'Ngựa đã lên xe và cố định' },
];
