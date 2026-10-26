// Góc nhìn ban đầu của bản đồ lộ trình: thuần hàm, kiểm thử bằng node (test/map-view-plan.cjs).
export type LngLat = [number, number];

/** Việt Nam: góc nhìn khi chưa có điểm nào để fit (không bao giờ là cả thế giới). */
export const VN_VIEW = { longitude: 106.7, latitude: 10.8, zoom: 6 };
/** Zoom nhỏ nhất của mọi bản đồ dùng BaseMap: dưới mức này Mapbox mới vẽ cả quả địa cầu. */
export const MIN_ZOOM = 3;
/** Lề khi fit toàn tuyến: đủ chỗ cho chấm lớn và nhãn ở các cạnh. */
export const FIT_PADDING = 80;
export const POINT_ZOOM = 10;
export const MAX_FIT_ZOOM = 12;

/** Tọa độ dùng được: số hữu hạn, trong miền hợp lệ và không phải (0, 0) (dữ liệu chưa nhập thường bị lưu thành 0). */
export function usablePoints(points: LngLat[]): LngLat[] {
  return points.filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat)
    && Math.abs(lng) <= 180 && Math.abs(lat) <= 90 && !(Math.abs(lng) < 1e-6 && Math.abs(lat) < 1e-6));
}

/**
 * Lề không được lớn hơn khung: fitBounds với padding ≥ nửa chiều nhỏ nhất của khung sẽ thất bại
 * ("Map cannot fit within canvas…") và bản đồ đứng yên. Giữ lề tối đa 1/4 chiều nhỏ nhất.
 */
export function clampPadding(size: { width: number; height: number }, wanted = FIT_PADDING): number {
  return Math.max(0, Math.min(wanted, Math.floor(Math.min(size.width, size.height) / 4)));
}

export type ViewPlan =
  | { kind: 'default' }
  | { kind: 'point'; center: LngLat; zoom: number }
  | { kind: 'bounds'; bounds: [LngLat, LngLat]; padding: number; maxZoom: number };

/** 0 điểm → Việt Nam; 1 điểm (hoặc nhiều điểm trùng nhau) → bay tới điểm đó zoom ~10; còn lại → fit khung có lề. */
export function planView(points: LngLat[], size: { width: number; height: number }): ViewPlan {
  const usable = usablePoints(points);
  if (!usable.length) return { kind: 'default' };
  const lngs = usable.map(p => p[0]);
  const lats = usable.map(p => p[1]);
  const [west, east, south, north] = [Math.min(...lngs), Math.max(...lngs), Math.min(...lats), Math.max(...lats)];
  if (east - west < 1e-4 && north - south < 1e-4) return { kind: 'point', center: [(west + east) / 2, (south + north) / 2], zoom: POINT_ZOOM };
  return { kind: 'bounds', bounds: [[west, south], [east, north]], padding: clampPadding(size), maxZoom: MAX_FIT_ZOOM };
}
