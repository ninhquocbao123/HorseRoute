import { BadRequestException, ServiceUnavailableException } from '../../shared/core/error.response';
import { z } from 'zod';
import { MAP_REQUEST_HEADERS, farFromRoad, geocodingUrl, routingUrl } from '../../shared/config/map-services';
import { simplifyLine } from '../tracking/trackmap.geo';
import { MAX_ROUTE_COORDINATES, RouteWaypoint, issueRouteToken, routeInputKey, storedRouteSchema } from './trip-route-plan';

const coordinate = z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-90).max(90)]);
const addressPart = z.string().trim().min(1).max(2000).optional();
const searchResponse = z.object({ features: z.array(z.object({
  geometry: z.object({ type: z.literal('Point'), coordinates: coordinate }),
  properties: z.object({
    osm_type: z.string().max(10).optional(), osm_id: z.number().optional(),
    name: addressPart, housenumber: addressPart, street: addressPart, district: addressPart, city: addressPart, state: addressPart, country: addressPart,
  }).refine(p => !!(p.name || p.street)),
})).max(5) });
const routesResponse = z.object({
  code: z.literal('Ok'),
  routes: z.array(z.object({
    geometry: z.object({ type: z.literal('LineString'), coordinates: z.array(coordinate).min(2).max(100_000) }),
    distance: storedRouteSchema.shape.distanceM, duration: storedRouteSchema.shape.durationS,
    legs: z.array(z.object({ distance: z.number().finite().min(0), duration: z.number().finite().min(0) })).optional(),
  })).min(1).max(3),
  waypoints: z.array(z.object({ distance: z.number().optional() })).optional(),
});

/** `allowBadRequest`: OSRM báo "không có đường" bằng HTTP 400 kèm `code` trong thân, không phải lỗi dịch vụ. */
async function request(url: URL, timeoutMs = 10_000, fetchImpl: typeof fetch = fetch, allowBadRequest = false): Promise<unknown> {
  let response: Response;
  try { response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: MAP_REQUEST_HEADERS }); }
  catch { throw new ServiceUnavailableException('Dịch vụ bản đồ không phản hồi. Vui lòng thử lại.'); }
  if (response.status === 429) throw new ServiceUnavailableException('Dịch vụ bản đồ đang giới hạn yêu cầu. Vui lòng chờ rồi thử lại.');
  if (!response.ok && !(allowBadRequest && response.status === 400)) throw new ServiceUnavailableException(`Dịch vụ bản đồ trả lỗi HTTP ${response.status}.`);
  try {
    // Bound external responses too; keep the application JSON input limit unchanged.
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Missing body');
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > 8_000_000) throw new Error('Provider response too large');
        chunks.push(value);
      }
    } finally { await reader.cancel(); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch { throw new ServiceUnavailableException('Dịch vụ bản đồ trả dữ liệu không hợp lệ hoặc quá thời gian.'); }
}
function configuredUrl(value: string): string {
  if (!value) throw new ServiceUnavailableException('Dịch vụ tìm địa chỉ và tính tuyến đang bị tắt trong cấu hình.');
  return value;
}

export async function searchAddresses(query: string, fetchImpl: typeof fetch = fetch) {
  const url = new URL(configuredUrl(geocodingUrl()));
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '5');
  url.searchParams.set('lang', 'default'); // tên gốc trong OpenStreetMap; Photon không hỗ trợ lang=vi (trả 400)
  // Không lọc quốc gia vì có chuyến quốc tế, chỉ ưu tiên kết quả gần Việt Nam.
  url.searchParams.set('lat', '16');
  url.searchParams.set('lon', '106');
  const parsed = searchResponse.safeParse(await request(url, 10_000, fetchImpl));
  if (!parsed.success) throw new ServiceUnavailableException('Dịch vụ tìm địa chỉ trả dữ liệu không hợp lệ.');
  return parsed.data.features.map(feature => {
    const { osm_type, osm_id, name, housenumber, street, district, city, state, country } = feature.properties;
    const address = [housenumber, street].filter(Boolean).join(' ');
    const label = [...new Set([name, address, district, city, state, country].filter(Boolean))].join(', ');
    const [longitude, latitude] = feature.geometry.coordinates;
    return { id: osm_type && osm_id !== undefined ? `${osm_type}${osm_id}` : `${longitude},${latitude}`, label: label.slice(0, 255), latitude, longitude };
  });
}

type PointLike = Pick<RouteWaypoint, 'latitude' | 'longitude' | 'label'>;
export async function previewRoutes(tripId: string, waypoints: RouteWaypoint[], fetchImpl: typeof fetch = fetch) {
  return (await routeCandidates(tripId, waypoints, true, fetchImpl)).map(({ legs: _legs, ...route }) => route);
}
/** Một tuyến duy nhất kèm thời gian từng chặng giữa các điểm (dùng cho tự lập lộ trình). */
export async function routeWithLegs(tripId: string, waypoints: RouteWaypoint[], fetchImpl: typeof fetch = fetch) {
  return (await routeCandidates(tripId, waypoints, false, fetchImpl))[0];
}
/** Tuyến thô qua các điểm (chưa có id), chỉ để đo thời gian khi đặt điểm nghỉ; không cấp mã xác thực. */
export async function rawRoute(points: PointLike[], fetchImpl: typeof fetch = fetch) {
  const parsed = await osrm(points, false, fetchImpl);
  const best = parsed.routes[0];
  return { coordinates: best.geometry.coordinates as [number, number][], legs: (best.legs ?? [{ distance: best.distance, duration: best.duration }]).map(leg => ({ distanceM: leg.distance, durationS: leg.duration })) };
}
async function osrm(waypoints: PointLike[], alternatives: boolean, fetchImpl: typeof fetch) {
  const coordinates = waypoints.map(point => `${point.longitude},${point.latitude}`).join(';');
  const url = new URL(`${configuredUrl(routingUrl())}${coordinates}`);
  url.searchParams.set('alternatives', alternatives ? '2' : 'false'); // tối đa 3 phương án; OSRM chỉ tìm phương án khác khi tuyến có đúng 2 điểm
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('overview', 'full');
  const data = await request(url, 15_000, fetchImpl, true);
  const noRoute = z.object({ code: z.enum(['NoRoute', 'NoSegment']) }).safeParse(data);
  if (noRoute.success) throw new BadRequestException('Không tìm thấy đường bộ qua các điểm đã chọn.');
  const parsed = routesResponse.safeParse(data);
  if (!parsed.success) throw new ServiceUnavailableException('Dịch vụ bản đồ trả phương án tuyến không hợp lệ.');
  const offRoad = farFromRoad(parsed.data.waypoints);
  if (offRoad >= 0) throw new BadRequestException(`Điểm "${waypoints[offRoad]?.label ?? offRoad + 1}" nằm quá xa đường bộ. Hãy kiểm tra lại vị trí.`);
  return parsed.data;
}
async function routeCandidates(tripId: string, waypoints: RouteWaypoint[], alternatives: boolean, fetchImpl: typeof fetch) {
  const data = await osrm(waypoints, alternatives, fetchImpl);
  const inputKey = routeInputKey(waypoints);
  return data.routes.map(candidate => {
    const raw = candidate.geometry.coordinates;
    // Douglas–Peucker, maximum 8 m in the existing local metric. Never truncate.
    const coordinates = raw.length > MAX_ROUTE_COORDINATES ? simplifyLine(raw, 8) : raw;
    const checked = storedRouteSchema.safeParse({
      geometry: { type: 'LineString', coordinates }, distanceM: candidate.distance, durationS: candidate.duration,
      provider: 'osrm', calculatedAt: new Date().toISOString(), inputKey,
    });
    if (!checked.success) {
      throw new ServiceUnavailableException('Tuyến vẫn vượt giới hạn 5.000 tọa độ sau giản lược 8 m. Hãy thử phương án khác.');
    }
    const route = checked.data;
    const legs = (candidate.legs ?? [{ distance: candidate.distance, duration: candidate.duration }]).map(leg => ({ distanceM: leg.distance, durationS: leg.duration }));
    return { ...route, verificationToken: issueRouteToken(tripId, route), legs };
  });
}
