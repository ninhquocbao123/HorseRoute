// Đoạn đã đi của màn tài xế = phần TUYẾN ĐƯỜNG từ điểm xuất phát tới vị trí xe chiếu lên tuyến (cùng cách API tính remainingKm
// ở trackmap.geo.ts#projectOnLine), không phải vệt GPS thô. Hàm thuần, tọa độ [lng, lat].
export type LngLat = [number, number];

/** Xe lệch tuyến quá ngưỡng này thì mới hiện thêm vệt GPS mảnh (xem DriverRouteMap). */
export const OFF_ROUTE_KM = 0.3;

const R = 6371.0088;
const rad = (deg: number) => (deg * Math.PI) / 180;

function haversineKm(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Chiếu `point` lên polyline (phép chiếu phẳng cục bộ trên từng đoạn). Trả về chỉ số đoạn, điểm chiếu và khoảng lệch (km);
 * dùng để cắt tuyến tại đúng chỗ xe đang đứng.
 */
export function projectOnRoute(line: LngLat[], point: LngLat): { index: number; projected: LngLat; offsetKm: number } {
  let best = { index: 1, projected: line[0], offsetKm: Infinity };
  for (let i = 1; i < line.length; i++) {
    const [a, b] = [line[i - 1], line[i]];
    const scale = Math.cos(rad((a[1] + b[1]) / 2));
    const [ax, ay, bx, by, px, py] = [a[0] * scale, a[1], b[0] * scale, b[1], point[0] * scale, point[1]];
    const lengthSq = (bx - ax) ** 2 + (by - ay) ** 2;
    const t = lengthSq === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / lengthSq));
    const projected: LngLat = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const offsetKm = haversineKm(projected, point);
    if (offsetKm < best.offsetKm) best = { index: i, projected, offsetKm };
  }
  return best;
}

type Leg = { id: string; status: string; mode: string; coordinates: LngLat[] | null };

/**
 * Đoạn đã đi: mọi chặng đã hoàn thành (nguyên chặng) + phần chặng hiện tại từ đầu chặng tới điểm chiếu của xe.
 * Chặng AT_STOP (đã tới điểm dừng) tính nguyên chặng. Chặng bay (AIR) và xe chưa có vị trí thì không cắt.
 * `offsetKm`: xe cách tuyến bao xa (null khi không có chặng hiện tại hoặc không có vị trí).
 */
export function travelledRoute(legs: Leg[], vehicle: LngLat | null): { lines: { coordinates: LngLat[]; mode: string }[]; offsetKm: number | null } {
  const lines: { coordinates: LngLat[]; mode: string }[] = [];
  let offsetKm: number | null = null;
  for (const leg of legs) {
    const line = leg.coordinates;
    if (!line || line.length < 2) continue;
    if (leg.status === 'COMPLETED' || leg.status === 'AT_STOP') {
      lines.push({ coordinates: line, mode: leg.mode });
    } else if (leg.status === 'MOVING' && vehicle) {
      const { index, projected, offsetKm: off } = projectOnRoute(line, vehicle);
      offsetKm = off;
      const part = [...line.slice(0, index), projected];
      if (part.length > 1) lines.push({ coordinates: part, mode: leg.mode });
    }
  }
  return { lines, offsetKm };
}
