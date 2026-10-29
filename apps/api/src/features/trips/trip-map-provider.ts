import { BadRequestException, ServiceUnavailableException } from '../../shared/core/error.response';
import { z } from 'zod';
import { simplifyLine } from '../tracking/trackmap.geo';
import { MAX_ROUTE_COORDINATES, RouteWaypoint, issueRouteToken, routeInputKey, storedRouteSchema } from './trip-route-plan';

const MAPBOX_GEOCODE = 'https://api.mapbox.com/search/geocode/v6/forward';
const MAPBOX_DIRECTIONS = 'https://api.mapbox.com/directions/v5/mapbox/driving/';

const coordinate = z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-90).max(90)]);
const searchResponse = z.object({ features: z.array(z.object({
  id: z.string().max(200).optional(),
  geometry: z.object({ type: z.literal('Point'), coordinates: coordinate }),
  properties: z.object({ full_address: z.string().trim().min(1).max(2000).optional(), name: z.string().trim().min(1).max(2000).optional() })
    .refine(p => !!(p.full_address || p.name)),
})).max(5) });
const directionsResponse = z.object({ code: z.literal('Ok'), routes: z.array(z.object({
  geometry: z.object({ type: z.literal('LineString'), coordinates: z.array(coordinate).min(2).max(100_000) }),
  distance: storedRouteSchema.shape.distanceM, duration: storedRouteSchema.shape.durationS,
})).min(1).max(3) });

async function request(url: URL, timeoutMs = 10_000, fetchImpl: typeof fetch = fetch): Promise<unknown> {
  let response: Response;
  try { response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) }); }
  catch { throw new ServiceUnavailableException('Dịch vụ bản đồ không phản hồi. Vui lòng thử lại.'); }
  if (response.status === 429) throw new ServiceUnavailableException('Dịch vụ bản đồ đang giới hạn yêu cầu. Vui lòng chờ rồi thử lại.');
  if (!response.ok) throw new ServiceUnavailableException(`Dịch vụ bản đồ trả lỗi HTTP ${response.status}.`);
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
function token(): string {
  const value = process.env.MAPBOX_ACCESS_TOKEN?.trim();
  if (!value) throw new ServiceUnavailableException('Chưa cấu hình MAPBOX_ACCESS_TOKEN cho tìm địa chỉ và tính tuyến.');
  return value;
}

export async function searchAddresses(query: string, fetchImpl: typeof fetch = fetch) {
  const url = new URL(process.env.MAPBOX_GEOCODING_URL?.trim() || MAPBOX_GEOCODE);
  url.searchParams.set('q', query);
  url.searchParams.set('access_token', token());
  url.searchParams.set('autocomplete', 'false');
  url.searchParams.set('permanent', 'true');
  url.searchParams.set('language', 'vi');
  url.searchParams.set('limit', '5');
  const parsed = searchResponse.safeParse(await request(url, 10_000, fetchImpl));
  if (!parsed.success) throw new ServiceUnavailableException('Dịch vụ tìm địa chỉ trả dữ liệu không hợp lệ.');
  return parsed.data.features.map(feature => {
    const coordinates = feature.geometry.coordinates;
    const label = (feature.properties.full_address || feature.properties.name)!;
    const [longitude, latitude] = coordinates;
    return { id: feature.id || `${longitude},${latitude}`, label: label.slice(0, 255), latitude, longitude };
  });
}

export async function previewRoutes(tripId: string, waypoints: RouteWaypoint[], fetchImpl: typeof fetch = fetch) {
  const coordinates = waypoints.map(point => `${point.longitude},${point.latitude}`).join(';');
  const base = process.env.MAPBOX_DIRECTIONS_URL?.trim() || MAPBOX_DIRECTIONS;
  const url = new URL(`${base}${coordinates}`);
  url.searchParams.set('access_token', token());
  url.searchParams.set('alternatives', 'true');
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('overview', 'full');
  const data = await request(url, 15_000, fetchImpl);
  const noRoute = z.object({ code: z.enum(['NoRoute', 'NoSegment']) }).safeParse(data);
  if (noRoute.success) throw new BadRequestException('Không tìm thấy đường bộ qua các điểm đã chọn.');
  const parsed = directionsResponse.safeParse(data);
  if (!parsed.success) throw new ServiceUnavailableException('Dịch vụ bản đồ trả phương án tuyến không hợp lệ.');
  const inputKey = routeInputKey(waypoints);
  return parsed.data.routes.map(candidate => {
    const raw = candidate.geometry.coordinates;
    // Douglas–Peucker, maximum 8 m in the existing local metric. Never truncate.
    const coordinates = raw.length > MAX_ROUTE_COORDINATES ? simplifyLine(raw, 8) : raw;
    const checked = storedRouteSchema.safeParse({
      geometry: { type: 'LineString', coordinates }, distanceM: candidate.distance, durationS: candidate.duration,
      provider: 'mapbox', calculatedAt: new Date().toISOString(), inputKey,
    });
    if (!checked.success) {
      throw new ServiceUnavailableException('Tuyến vẫn vượt giới hạn 5.000 tọa độ sau giản lược 8 m. Hãy thử phương án khác.');
    }
    const route = checked.data;
    return { ...route, verificationToken: issueRouteToken(tripId, route) };
  });
}
