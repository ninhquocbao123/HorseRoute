import { INCIDENT_SUB_TYPES, type DamageTarget, type ILegTracking, type IncidentSeverity, type IncidentType } from '@my-project/shared';
import type { NextAction } from '../tracking.format';

// antd preset colors: every status and action has its own color so the driver reads state at a glance.
export const ORDER_TAG: Record<string, { label: string; color: string }> = {
  READY: { label: 'Sẵn sàng khởi hành', color: 'blue' },
  IN_TRANSIT: { label: 'Đang di chuyển', color: 'gold' },
  DELIVERED: { label: 'Đã giao xong', color: 'green' },
  CANCELLED: { label: 'Đã hủy', color: 'default' },
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

/** `current`: điểm đến của chặng đang chạy khi chuyến IN_TRANSIT (D1b: "đang tới"). */
export type TripStop = { key: string; name: string; note: string; plannedAt: string; dayOffset: number; reached: boolean; current: boolean };

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
export function tripStops(legs: ILegTracking[], horseCount: number, currentLegId: string | null = null): TripStop[] {
  if (!legs.length) return [];
  const first = legs[0];
  const startDay = localDay(first.plannedDepartureAt);
  const start: TripStop = {
    key: 'start', name: first.fromLocationName, note: `Nhận ${horseCount} ngựa`,
    plannedAt: first.plannedDepartureAt, dayOffset: 0, reached: first.status !== 'NOT_STARTED', current: false,
  };
  return [start, ...legs.map((leg, index) => ({
    key: leg.id,
    name: leg.toLocationName,
    note: index === legs.length - 1 ? 'Bàn giao' : STOP_NOTE[leg.toLocationType] ?? 'Điểm dừng',
    plannedAt: leg.plannedArrivalAt,
    dayOffset: localDay(leg.plannedArrivalAt) - startDay,
    reached: leg.status === 'AT_STOP' || leg.status === 'COMPLETED',
    current: leg.id === currentLegId && leg.status !== 'AT_STOP' && leg.status !== 'COMPLETED',
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

/** Mức độ sự cố (Figma D2). RED → urgency HIGH ở backend (quyết định 5.1). */
export const SEVERITIES: { value: IncidentSeverity; label: string; hint: string }[] = [
  { value: 'RED' as IncidentSeverity, label: 'Đỏ · Nghiêm trọng', hint: 'Tai nạn, ngựa bị thương, xe không thể chạy tiếp' },
  { value: 'ORANGE' as IncidentSeverity, label: 'Cam · Trung bình', hint: 'Hỏng hóc nhỏ, ngựa có dấu hiệu bất thường' },
  { value: 'YELLOW' as IncidentSeverity, label: 'Vàng · Nhẹ', hint: 'Kẹt xe, chậm lịch trình, thời tiết xấu' },
];
export const SEVERITY_SHORT: Record<string, string> = { RED: 'Đỏ', ORANGE: 'Cam', YELLOW: 'Vàng' };

export const DAMAGE_TARGETS: { value: DamageTarget; label: string }[] = [
  { value: 'VEHICLE' as DamageTarget, label: 'Xe' },
  { value: 'HORSE' as DamageTarget, label: 'Ngựa' },
  { value: 'BOTH' as DamageTarget, label: 'Cả hai' },
];

const TYPE_LABEL: Record<IncidentType, string> = { VEHICLE_BREAKDOWN: 'Hỏng xe', LONG_TRAFFIC_JAM: 'Tắc đường', HORSE_MEDICAL: 'Y tế ngựa' } as Record<IncidentType, string>;

/** Dropdown "Loại sự cố" gộp loại + loại con, giá trị dạng `TYPE:SUB_TYPE`. */
export const INCIDENT_KIND_GROUPS = (Object.keys(INCIDENT_SUB_TYPES) as IncidentType[]).map(type => ({
  label: TYPE_LABEL[type],
  options: INCIDENT_SUB_TYPES[type].map(sub => ({ value: `${type}:${sub.code}`, label: `${TYPE_LABEL[type]} · ${sub.label}` })),
}));

export function splitIncidentKind(kind: string): { incidentType: IncidentType; subType: string } | null {
  const [incidentType, subType] = kind.split(':');
  return incidentType && subType ? { incidentType: incidentType as IncidentType, subType } : null;
}

export function incidentKindLabel(type: string, subType: string | null) {
  const sub = subType ? INCIDENT_SUB_TYPES[type as IncidentType]?.find(item => item.code === subType)?.label : null;
  return [TYPE_LABEL[type as IncidentType] ?? type, sub].filter(Boolean).join(' · ');
}

/** 3 việc an toàn trong lúc chờ (Figma D2, nội dung tĩnh). */
export const WAITING_STEPS = [
  { id: 'hazard', label: 'Bật đèn khẩn cấp, đặt biển cảnh báo' },
  { id: 'horses', label: 'Kiểm tra ngựa cùng hộ tống' },
  { id: 'stall', label: 'Không mở khoang trên đường cao tốc' },
];

export const CAPTION_SUGGESTIONS = ['Lốp sau', 'Toàn xe', 'Khoang ngựa'];

/** Thời lượng dạng "6 giờ 40" / "40 phút". */
export function formatDuration(ms: number) {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} phút`;
  return rest ? `${hours} giờ ${String(rest).padStart(2, '0')}` : `${hours} giờ`;
}

/** Tiêu đề hộp thoại "Check-in chặng": ghi rõ hành động cụ thể vì nút chỉ ghi chung. */
export function checkInTitle(action: NextAction, leg: ILegTracking) {
  if (action.kind === 'complete') return `Hoàn thành chặng tới ${leg.toLocationName}`;
  switch (action.milestone) {
    case 'DEPARTED': return `Xác nhận: Xuất phát từ ${leg.fromLocationName}`;
    case 'ARRIVED_AT_STOP': return `Xác nhận: Đã đến ${leg.toLocationName}`;
    case 'CUSTOMS_CLEARED': return `Thông quan xong tại ${leg.toLocationName}`;
    default: return `Xác nhận: Đã giao ngựa tại ${leg.toLocationName}`;
  }
}

/** "17/11 10:00" (giờ địa phương), dùng cho ETA và giờ đến khác ngày. */
export function formatDayTime(value: string | Date) {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Mọi số km của màn tài xế dùng hàm này: "1.116" (dấu chấm nghìn, làm tròn); dưới 10 km giữ 1 chữ số lẻ ("0,8").
 * Tự ghép chuỗi thay vì Intl để không phụ thuộc dữ liệu locale của trình duyệt (có máy trả "1,116").
 */
export function formatKm(km: number) {
  if (km < 10) return (Math.round(km * 10) / 10).toString().replace('.', ',');
  return Math.round(km).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

type VehicleLike = { id: string; code: string; capacityStalls: number };

/** "51C-482.19 · 4 chuồng" cho xe của một chặng; thiếu chi tiết xe thì chỉ biển số. */
export function vehicleLabel(leg: ILegTracking | undefined, vehicles: VehicleLike[] | undefined) {
  if (!leg?.vehicleCode) return null;
  const found = vehicles?.find(v => v.id === leg.vehicleId);
  return found ? `${found.code} · ${found.capacityStalls} chuồng` : leg.vehicleCode;
}

/** Xe hiện thị ở ô "Xe": chặng đang chạy (IN_TRANSIT), chặng đầu (READY), chặng cuối (đã giao). */
export function headlineLeg(legs: ILegTracking[], orderStatus: string) {
  if (orderStatus === 'IN_TRANSIT') return legs.find(l => l.status === 'MOVING' || l.status === 'AT_STOP') ?? legs.find(l => l.status !== 'COMPLETED') ?? legs[0];
  if (orderStatus === 'DELIVERED') return legs[legs.length - 1];
  return legs[0];
}
