// Hình học tuyến theo cặp địa điểm (kế hoạch Bước 4). Đọc cache `location_routes`; thiếu/hết hạn thì gọi Mapbox
// Directions (timeout 5 giây). Mọi lỗi đều rơi về STRAIGHT để bản đồ không bao giờ làm API lỗi 500.
// Chỉ lưu hình học tuyến có hạn dùng (fetched_at); KHÔNG gọi geocoding và KHÔNG lưu địa chỉ từ Mapbox.
import type { RouteMode } from '@my-project/shared';
import { greatCircle, haversineKm, lineLengthKm, type LngLat } from './trackmap.geo';
import { Logger } from '../../shared/utils/logger.util';

export type CachedRoute = { mode: RouteMode; coordinates: LngLat[]; distanceM: number | null; fetchedAt: Date };
export type ResolvedRoute = { mode: RouteMode; coordinates: LngLat[]; distanceKm: number };

/** Phần repository mà provider cần (dễ thay bằng bản giả khi test). */
export interface RouteStore {
  findRoutes(fromId: string, toId: string): Promise<CachedRoute[]>;
  saveRoute(fromId: string, toId: string, route: { mode: RouteMode; coordinates: LngLat[]; distanceM: number | null; durationS: number | null }): Promise<void>;
  deleteRoute(fromId: string, toId: string, mode: RouteMode): Promise<void>;
}

type Options = {
  /** Mặc định đọc MAPBOX_ACCESS_TOKEN lúc gọi; rỗng → không gọi Mapbox */
  token?: () => string | undefined;
  fetch?: typeof fetch;
  timeoutMs?: number;
  ttlDays?: number;
};

const DIRECTIONS_URL = 'https://api.mapbox.com/directions/v5/mapbox/driving/';
const logger = new Logger('TrackMap');

const straight = (from: LngLat, to: LngLat): ResolvedRoute => ({ mode: 'STRAIGHT', coordinates: [from, to], distanceKm: haversineKm(from, to) });

export class RoutesProvider {
  private readonly inFlight = new Map<string, Promise<ResolvedRoute>>();
  private readonly token: () => string | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly ttlMs: number;

  constructor(private readonly store: RouteStore, options: Options = {}) {
    this.token = options.token ?? (() => process.env.MAPBOX_ACCESS_TOKEN?.trim());
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 5_000;
    this.ttlMs = (options.ttlDays ?? 30) * 86_400_000;
  }

  /** Tuyến cho một chặng. `mode` lấy theo loại xe: AIR vẽ cung tròn lớn (không gọi API, không cache). */
  async route(fromId: string, toId: string, from: LngLat, to: LngLat, mode: 'ROAD' | 'AIR'): Promise<ResolvedRoute> {
    if (mode === 'AIR') {
      const coordinates = greatCircle(from, to);
      return { mode: 'AIR', coordinates, distanceKm: haversineKm(from, to) };
    }
    const key = `${fromId}:${toId}`;
    const running = this.inFlight.get(key);
    if (running) return running;
    // Khóa chống gọi trùng khi nhiều người mở cùng một bản đồ cùng lúc.
    const work = this.roadRoute(fromId, toId, from, to).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, work);
    return work;
  }

  private async roadRoute(fromId: string, toId: string, from: LngLat, to: LngLat): Promise<ResolvedRoute> {
    try {
      const fresh = (await this.store.findRoutes(fromId, toId))
        .filter(row => row.mode !== 'AIR' && Date.now() - row.fetchedAt.getTime() < this.ttlMs);
      const cached = fresh.find(row => row.mode === 'ROAD') ?? fresh.find(row => row.mode === 'STRAIGHT');
      if (cached) {
        // STRAIGHT trong cache = Mapbox đã trả "không có đường"; vẽ thẳng giữa tọa độ hiện tại của hai địa điểm.
        if (cached.mode === 'STRAIGHT') return straight(from, to);
        return { mode: 'ROAD', coordinates: cached.coordinates, distanceKm: cached.distanceM != null ? cached.distanceM / 1000 : lineLengthKm(cached.coordinates) };
      }
    } catch (error) {
      logger.warn('route_cache_read_failed', { message: error instanceof Error ? error.message : String(error) });
    }

    const token = this.token();
    if (!token) return straight(from, to); // Chưa cấu hình token: không lưu, để khi có token sẽ lấy đường thật.

    // Timer thường (có ref), không dùng AbortSignal.timeout: timer của nó là unref nên khi chỉ còn chờ Mapbox,
    // event loop có thể rỗng và tiến trình thoát trước khi hết giờ. Hạn này bao cả thời gian đọc thân phản hồi.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DOMException('Directions request timed out', 'TimeoutError')), this.timeoutMs);
    let response: Response;
    let body: { code?: string; routes?: { geometry?: { coordinates?: LngLat[] }; distance?: number; duration?: number }[] } = {};
    try {
      const url = `${DIRECTIONS_URL}${from[0]},${from[1]};${to[0]},${to[1]}?geometries=geojson&overview=simplified&access_token=${encodeURIComponent(token)}`;
      response = await this.fetchImpl(url, { signal: controller.signal });
      try { body = await response.json(); } catch { /* thân không phải JSON */ }
    } catch (error) {
      // Timeout / mất mạng: lỗi tạm thời, không cache để lần sau thử lại.
      logger.warn('directions_unreachable', { fromId, toId, message: error instanceof Error ? error.name : String(error) });
      return straight(from, to);
    } finally {
      clearTimeout(timer);
    }
    const best = body.routes?.[0];
    const coordinates = best?.geometry?.coordinates;
    if (response.ok && body.code === 'Ok' && coordinates && coordinates.length >= 2) {
      const distanceM = typeof best.distance === 'number' ? Math.round(best.distance) : null;
      await this.persist(fromId, toId, { mode: 'ROAD', coordinates, distanceM, durationS: typeof best.duration === 'number' ? Math.round(best.duration) : null });
      return { mode: 'ROAD', coordinates, distanceKm: distanceM != null ? distanceM / 1000 : lineLengthKm(coordinates) };
    }
    if (response.ok && (body.code === 'NoRoute' || body.code === 'NoSegment')) {
      // Câu trả lời chắc chắn "không có đường bộ" (qua biển, quá xa): nhớ lại để không gọi lại mỗi lần xem.
      await this.persist(fromId, toId, { mode: 'STRAIGHT', coordinates: [from, to], distanceM: null, durationS: null });
    } else {
      logger.warn('directions_failed', { fromId, toId, status: response.status, code: body.code ?? 'none' });
    }
    return straight(from, to);
  }

  private async persist(fromId: string, toId: string, route: { mode: RouteMode; coordinates: LngLat[]; distanceM: number | null; durationS: number | null }) {
    try {
      await this.store.saveRoute(fromId, toId, route);
      if (route.mode === 'ROAD') await this.store.deleteRoute(fromId, toId, 'STRAIGHT');
    } catch (error) {
      logger.warn('route_cache_write_failed', { message: error instanceof Error ? error.message : String(error) });
    }
  }
}
