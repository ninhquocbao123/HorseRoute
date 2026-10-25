/**
 * Bản đồ chuyến + GPS (docs/thiet-ke-theo-doi-ban-do-mapbox.md, kế hoạch Bước 4 + 6).
 * Tọa độ luôn theo WGS84; mảng tọa độ tuyến theo thứ tự GeoJSON [lng, lat].
 */
import { LegStatus } from '../enums/tracking.enum';
import { OrderStatus } from '../enums/order.enum';

/** ROAD: đường thật (Mapbox Directions) · AIR: cung tròn lớn (chặng bay) · STRAIGHT: đường thẳng ước lượng */
export type RouteMode = 'ROAD' | 'AIR' | 'STRAIGHT';
/** LIVE < 2 phút · STALE 2–10 phút ("mất tín hiệu") · OLD > 10 phút (không dùng làm vị trí hiện tại) */
export type GpsFreshness = 'LIVE' | 'STALE' | 'OLD';

export interface ITripMapStop {
  locationId: string;
  name: string;
  locationType: string;
  /** null khi địa điểm chưa có tọa độ (kèm cảnh báo trong `warnings`) */
  lat: number | null;
  lng: number | null;
}

export interface ITripMapLeg {
  id: string;
  seqNo: number;
  status: LegStatus;
  fromLocationId: string;
  toLocationId: string;
  mode: RouteMode;
  /** [[lng, lat], ...]; null khi thiếu tọa độ một trong hai đầu */
  coordinates: [number, number][] | null;
  distanceKm: number | null;
  plannedDepartureAt: string;
  plannedArrivalAt: string;
  actualDepartureAt: string | null;
  actualArrivalAt: string | null;
  isOverdue: boolean;
}

/** Điểm GPS mới nhất của chuyến (thô, không suy diễn). */
export interface ITripLatestPosition {
  lat: number;
  lng: number;
  speedKmh: number | null;
  accuracyM: number | null;
  headingDeg: number | null;
  recordedAt: string;
  legId: string | null;
  freshness: GpsFreshness;
}

/** Vị trí dùng để vẽ xe: GPS khi còn tươi và không phải chặng bay, ngược lại ước tính theo mốc. */
export interface ITripMapPosition {
  source: 'GPS' | 'ESTIMATED';
  lat: number;
  lng: number;
  asOf: string;
  legId: string | null;
  /** Nhãn cho người xem; ước tính luôn ghi rõ "ước tính theo kế hoạch, không phải GPS" */
  label: string | null;
}

export interface ITripMap {
  tripId: string;
  orderCode: string;
  orderStatus: OrderStatus;
  stops: ITripMapStop[];
  legs: ITripMapLeg[];
  /** Tổng km các chặng có tuyến; null khi không chặng nào có tọa độ */
  totalKm: number | null;
  /** Km còn lại tính từ `position`; null khi không xác định được */
  remainingKm: number | null;
  position: ITripMapPosition | null;
  latestPosition: ITripLatestPosition | null;
  /** system_parameters.VMAX; null khi chưa cấu hình */
  speedLimitKmh: number | null;
  warnings: string[];
}

/** Một điểm trong lô gửi lên `POST /tracking/trips/:tripId/positions`. */
export interface ITripPositionInput {
  latitude: number;
  longitude: number;
  recordedAt: string;
  accuracyM?: number;
  speedMps?: number;
  headingDeg?: number;
}

export interface ITripPositionBatchResult {
  legId: string;
  accepted: number;
  /** Điểm đã có (cùng người gửi, cùng `recordedAt`): bỏ qua, không lỗi */
  duplicates: number;
}

/** Điểm trong vệt đường đã đi (`GET /tracking/trips/:tripId/positions`). */
export interface ITripTrackPoint {
  lat: number;
  lng: number;
  speedKmh: number | null;
  recordedAt: string;
  legId: string | null;
}
