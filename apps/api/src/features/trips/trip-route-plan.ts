import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { BadRequestException, ServiceUnavailableException } from '../../shared/core/error.response';

export const MAX_ROUTE_WAYPOINTS = 12;
export const MAX_ROUTE_COORDINATES = 5_000;
// Stable through MySQL JSON's numeric round-trip; ~1 cm coordinate resolution.
const stableCoordinate = (value: number) => Number(value.toFixed(7));

const coordinate = z.tuple([
  z.number().finite().min(-180).max(180).transform(stableCoordinate),
  z.number().finite().min(-90).max(90).transform(stableCoordinate),
]);
export const routeWaypointSchema = z.object({
  id: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/),
  kind: z.enum(['ORIGIN', 'REST_STOP', 'DESTINATION']),
  label: z.string().trim().min(1).max(255),
  latitude: z.number().finite().min(-90).max(90).transform(stableCoordinate),
  longitude: z.number().finite().min(-180).max(180).transform(stableCoordinate),
  note: z.string().trim().max(500).default(''),
}).strict();

export const routeWaypointsSchema = z.array(routeWaypointSchema).min(2).max(MAX_ROUTE_WAYPOINTS).superRefine((points, context) => {
  const ids = new Set<string>();
  points.forEach((point, index) => {
    if (ids.has(point.id)) context.addIssue({ code: z.ZodIssueCode.custom, path: [index, 'id'], message: 'ID điểm hành trình bị trùng.' });
    ids.add(point.id);
    const wanted = index === 0 ? 'ORIGIN' : index === points.length - 1 ? 'DESTINATION' : 'REST_STOP';
    if (point.kind !== wanted) context.addIssue({ code: z.ZodIssueCode.custom, path: [index, 'kind'], message: `Điểm thứ ${index + 1} phải là ${wanted}.` });
  });
});

export const storedRouteSchema = z.object({
  geometry: z.object({ type: z.literal('LineString'), coordinates: z.array(coordinate).min(2).max(MAX_ROUTE_COORDINATES) }).strict(),
  distanceM: z.number().finite().positive().max(100_000_000),
  durationS: z.number().finite().positive().max(10_000_000),
  provider: z.literal('mapbox'),
  calculatedAt: z.string().datetime(),
  inputKey: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

export const routePlanSchema = z.object({
  version: z.literal(1),
  waypoints: routeWaypointsSchema,
  selectedRoute: storedRouteSchema.nullable(),
}).strict();
export type RoutePlan = z.infer<typeof routePlanSchema>;
export type RouteWaypoint = z.infer<typeof routeWaypointSchema>;
export type StoredRoute = z.infer<typeof storedRouteSchema>;

export const routePlanWriteSchema = z.object({
  revision: z.number().int().min(0).max(2_147_483_647),
  routePlan: routePlanSchema,
  verificationToken: z.string().max(400).nullable(),
}).strict();
export type RoutePlanWrite = z.infer<typeof routePlanWriteSchema>;

export const routePreviewSchema = z.object({ waypoints: routeWaypointsSchema }).strict();

export function routeInputKey(waypoints: RouteWaypoint[]): string {
  return createHash('sha256').update(JSON.stringify(waypoints.map(p => [p.id, stableCoordinate(p.latitude), stableCoordinate(p.longitude)]))).digest('hex');
}
function routeDigest(route: StoredRoute): string {
  return createHash('sha256').update(JSON.stringify(route)).digest('hex');
}
function secret(): string {
  const value = process.env.ROUTE_PREVIEW_SECRET?.trim() || process.env.JWT_SECRET?.trim();
  if (!value || value.length < 32) throw new ServiceUnavailableException('Chưa cấu hình khóa xác thực kết quả tuyến.');
  return value;
}
export function issueRouteToken(tripId: string, route: StoredRoute): string {
  const body = Buffer.from(JSON.stringify({ tripId, inputKey: route.inputKey, digest: routeDigest(route), exp: Date.now() + 15 * 60_000 })).toString('base64url');
  const signature = createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${signature}`;
}
export function verifyRouteToken(token: string, tripId: string, route: StoredRoute): void {
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra) throw new BadRequestException('Mã xác thực tuyến không hợp lệ. Hãy tính lại tuyến.');
  const expected = createHmac('sha256', secret()).update(body).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, 'base64url'); } catch { throw new BadRequestException('Mã xác thực tuyến không hợp lệ.'); }
  if (actual.toString('base64url') !== signature || actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new BadRequestException('Mã xác thực tuyến đã bị thay đổi. Hãy tính lại tuyến.');
  let payload: { tripId?: string; inputKey?: string; digest?: string; exp?: number };
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { throw new BadRequestException('Mã xác thực tuyến không hợp lệ.'); }
  if (payload.exp == null || payload.exp < Date.now()) throw new BadRequestException('Kết quả tuyến đã hết hạn. Hãy tính lại tuyến.');
  if (payload.tripId !== tripId || payload.inputKey !== route.inputKey || payload.digest !== routeDigest(route)) {
    throw new BadRequestException('Tuyến không khớp chuyến hoặc các điểm hiện tại. Hãy tính lại tuyến.');
  }
}

