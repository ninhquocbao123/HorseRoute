/**
 * Giữ đoạn tuyến trong nước nằm trong lãnh thổ Việt Nam. OSRM công khai chọn đường ngắn nhất nên Hà Nội → TP.HCM
 * có thể đi tắt qua Lào và Campuchia, điều xe chở ngựa không làm được khi chưa làm thủ tục xuất cảnh.
 * Biên giới phía tây được xấp xỉ thô (lệch về phía Lào/Campuchia) và chỉ coi là ra ngoài khi cách xa hơn biên độ,
 * nên đường sát biên vẫn hợp lệ còn đường đi tắt sâu vào nước bạn thì bị bắt.
 */
import type { LngLat } from './route-autoplan';

/** [vĩ độ, kinh độ] biên giới phía tây từ bắc xuống nam (Điện Biên → Hà Tiên). */
const WEST_BORDER: [number, number][] = [
  [22.5, 102.1], [21.25, 102.85], [20.9, 103.5], [20.35, 104.35], [19.4, 104.05], [18.75, 104.75], [18.38, 105.1],
  [17.68, 105.7], [16.62, 106.5], [16.2, 107.0], [15.6, 107.35], [14.7, 107.45], [13.9, 107.45], [12.8, 107.5],
  [12.25, 107.4], [11.75, 106.0], [11.0, 105.85], [10.95, 105.4], [10.6, 104.9], [10.42, 104.45],
];
const MARGIN_DEG = 0.25; // khoảng 27 km

function borderLng(lat: number): number | null {
  if (lat > WEST_BORDER[0][0] || lat < WEST_BORDER.at(-1)![0]) return null;
  for (let i = 1; i < WEST_BORDER.length; i++) {
    const [aLat, aLng] = WEST_BORDER[i - 1], [bLat, bLng] = WEST_BORDER[i];
    if (lat <= aLat && lat >= bLat) return aLng + (bLng - aLng) * (aLat - lat) / (aLat - bLat || 1);
  }
  return null;
}
/** Điểm nằm sâu ở phía Lào/Campuchia so với biên giới phía tây. */
export const westOfVietnam = ([lng, lat]: LngLat) => { const border = borderLng(lat); return border !== null && lng < border - MARGIN_DEG; };
/** Điểm đầu tiên của đoạn tuyến đi ra khỏi Việt Nam, hoặc null. */
export const firstExit = (coords: LngLat[]) => coords.find(westOfVietnam) ?? null;

/** Các điểm trên Quốc lộ 1 từ bắc vào nam, dùng làm điểm đi qua để giữ tuyến trong nước. */
const QL1_ANCHORS: LngLat[] = [
  [105.77, 19.80], [105.68, 18.68], [106.29, 18.07], [106.60, 17.47], [107.10, 16.81], [107.59, 16.46], [108.17, 16.03],
  [108.80, 15.12], [109.13, 13.83], [109.30, 13.09], [109.10, 12.26], [108.98, 11.57], [108.07, 10.98], [107.40, 10.93],
];
/** Điểm Quốc lộ 1 nằm giữa hai đầu đoạn (theo vĩ độ), xếp theo chiều đi. */
export function ql1Anchors(from: LngLat, to: LngLat): LngLat[] {
  const lo = Math.min(from[1], to[1]) + 0.25, hi = Math.max(from[1], to[1]) - 0.25;
  const inside = QL1_ANCHORS.filter(([, lat]) => lat > lo && lat < hi);
  return from[1] > to[1] ? inside : inside.reverse();
}
