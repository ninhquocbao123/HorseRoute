// Dịch vụ bản đồ phía server. Không cần token; đặt URL riêng khi tự host.
// Server OSRM công khai chỉ cho dùng phi thương mại, tối đa 1 yêu cầu/giây: production nên đặt MAP_ROUTING_URL về bản tự host.
export const PUBLIC_ROUTING_URL = 'https://router.project-osrm.org/route/v1/driving/';
const PUBLIC_GEOCODING_URL = 'https://photon.komoot.io/api/';

/** Các dịch vụ công khai yêu cầu định danh ứng dụng thật. */
export const MAP_REQUEST_HEADERS = { 'User-Agent': 'HorseRoute/1.0' };

/** Biến đặt rỗng = tắt dịch vụ (test không được gọi mạng thật); chưa đặt = dùng server công khai. */
const configured = (value: string | undefined, fallback: string) => (value === undefined ? fallback : value.trim());

export function routingUrl(): string {
  const url = configured(process.env.MAP_ROUTING_URL, PUBLIC_ROUTING_URL);
  return url && !url.endsWith('/') ? `${url}/` : url;
}
export const geocodingUrl = () => configured(process.env.MAP_GEOCODING_URL, PUBLIC_GEOCODING_URL);

/** OSRM luôn bám vào con đường gần nhất dù cách hàng trăm km (điểm giữa biển vẫn trả "Ok"): quá mức này coi như không có đường. */
export const MAX_ROAD_SNAP_M = 5_000;
type SnappedWaypoint = { distance?: number };
/** Chỉ số điểm đầu tiên nằm quá xa đường bộ, -1 nếu không có. */
export const farFromRoad = (waypoints: SnappedWaypoint[] | undefined) =>
  (waypoints ?? []).findIndex(point => typeof point.distance === 'number' && point.distance > MAX_ROAD_SNAP_M);
