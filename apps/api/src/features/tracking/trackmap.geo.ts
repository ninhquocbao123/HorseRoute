// Hình học cho bản đồ chuyến (kế hoạch Bước 4): hàm thuần, không thêm thư viện. Tọa độ dạng GeoJSON [lng, lat].
import type { RouteMode } from '@my-project/shared';

export type LngLat = [number, number];

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Khoảng cách đường tròn lớn (km) giữa hai điểm. */
export function haversineKm([lng1, lat1]: LngLat, [lng2, lat2]: LngLat): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Chiều dài polyline (km). */
export function lineLengthKm(line: LngLat[]): number {
  let total = 0;
  for (let i = 1; i < line.length; i++) total += haversineKm(line[i - 1], line[i]);
  return total;
}

/** Điểm nằm ở tỉ lệ `fraction` (kẹp [0, 1]) theo chiều dài polyline. */
export function pointAlong(line: LngLat[], fraction: number): LngLat {
  if (line.length === 0) throw new Error('Empty line');
  if (line.length === 1) return line[0];
  if (fraction >= 1) return line[line.length - 1];
  if (fraction <= 0) return line[0];
  const target = fraction * lineLengthKm(line);
  let walked = 0;
  for (let i = 1; i < line.length; i++) {
    const segment = haversineKm(line[i - 1], line[i]);
    if (walked + segment >= target) {
      const t = segment === 0 ? 0 : (target - walked) / segment;
      const [a, b] = [line[i - 1], line[i]];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    walked += segment;
  }
  return line[line.length - 1];
}

/**
 * Chiếu một điểm (vd. GPS) lên polyline: trả về tỉ lệ quãng đường đã đi [0, 1] và khoảng cách lệch tuyến (km).
 * Dùng phép chiếu phẳng cục bộ trên từng đoạn: đủ chính xác cho đoạn ngắn của tuyến đường bộ.
 */
export function projectOnLine(line: LngLat[], point: LngLat): { fraction: number; offsetKm: number } {
  const total = lineLengthKm(line);
  if (line.length < 2 || total === 0) return { fraction: 0, offsetKm: line.length ? haversineKm(line[0], point) : 0 };
  let best = { along: 0, offsetKm: Infinity };
  let walked = 0;
  for (let i = 1; i < line.length; i++) {
    const [a, b] = [line[i - 1], line[i]];
    const scale = Math.cos(toRad((a[1] + b[1]) / 2));
    const [ax, ay, bx, by, px, py] = [a[0] * scale, a[1], b[0] * scale, b[1], point[0] * scale, point[1]];
    const lengthSq = (bx - ax) ** 2 + (by - ay) ** 2;
    const t = lengthSq === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / lengthSq));
    const projected: LngLat = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const offsetKm = haversineKm(projected, point);
    const segment = haversineKm(a, b);
    if (offsetKm < best.offsetKm) best = { along: walked + segment * t, offsetKm };
    walked += segment;
  }
  return { fraction: best.along / total, offsetKm: best.offsetKm };
}

/** Cung tròn lớn giữa hai điểm (chặng bay), `segments` đoạn. Không gọi API ngoài. */
export function greatCircle(from: LngLat, to: LngLat, segments = 64): LngLat[] {
  const [lng1, lat1, lng2, lat2] = [toRad(from[0]), toRad(from[1]), toRad(to[0]), toRad(to[1])];
  const d = 2 * Math.asin(Math.sqrt(Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2));
  if (d === 0) return [from, to];
  const points: LngLat[] = [];
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
    const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    points.push([toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))]);
  }
  // Giữ kinh độ liên tục khi cắt kinh tuyến 180 để vẽ không bị gãy ngang bản đồ.
  for (let i = 1; i < points.length; i++) {
    while (points[i][0] - points[i - 1][0] > 180) points[i][0] -= 360;
    while (points[i][0] - points[i - 1][0] < -180) points[i][0] += 360;
  }
  return points;
}

/** Mọi loại xe LIGHT/MEDIUM/HEAVY đều di chuyển theo đường bộ. */
export function modeForVehicle(_vehicleType: string | null | undefined): Exclude<RouteMode, 'STRAIGHT'> {
  return 'ROAD';
}

export const roundKm = (km: number) => Math.round(km * 10) / 10;

/** Khoảng cách (mét) từ điểm `p` tới đoạn a–b, tính trên mặt phẳng cục bộ (đủ chính xác cho đoạn ngắn của tuyến đường). */
function distanceToSegmentM(p: LngLat, a: LngLat, b: LngLat): number {
  const metersPerDegLat = (Math.PI / 180) * EARTH_RADIUS_KM * 1000;
  const metersPerDegLng = metersPerDegLat * Math.cos(toRad((a[1] + b[1]) / 2));
  const [ax, ay] = [0, 0];
  const [bx, by] = [(b[0] - a[0]) * metersPerDegLng, (b[1] - a[1]) * metersPerDegLat];
  const [px, py] = [(p[0] - a[0]) * metersPerDegLng, (p[1] - a[1]) * metersPerDegLat];
  const lengthSq = (bx - ax) ** 2 + (by - ay) ** 2;
  const t = lengthSq === 0 ? 0 : Math.min(1, Math.max(0, (px * bx + py * by) / lengthSq));
  return Math.hypot(px - t * bx, py - t * by);
}

/**
 * Douglas–Peucker: bỏ các điểm lệch khỏi đường nối hai điểm giữ lại không quá `toleranceM` mét. Luôn giữ điểm đầu và cuối.
 * Dùng stack thay đệ quy vì một chặng dài có thể có hàng chục nghìn điểm. Với dung sai vài mét, hình dạng tuyến
 * (khúc cua, ngã rẽ) không đổi nên vẫn bám đường; chỉ giảm số điểm.
 */
export function simplifyLine(line: LngLat[], toleranceM: number): LngLat[] {
  if (line.length <= 2 || toleranceM <= 0) return line;
  const keep = new Uint8Array(line.length);
  keep[0] = 1;
  keep[line.length - 1] = 1;
  const stack: [number, number][] = [[0, line.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    let worst = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const distance = distanceToSegmentM(line[i], line[start], line[end]);
      if (distance > worst) { worst = distance; index = i; }
    }
    if (index !== -1 && worst > toleranceM) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
  return line.filter((_, i) => keep[i] === 1);
}
