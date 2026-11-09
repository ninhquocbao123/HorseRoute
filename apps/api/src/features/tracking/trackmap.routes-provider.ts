// Hình học tuyến theo cặp địa điểm (kế hoạch Bước 4). Đọc cache `location_routes`; thiếu/hết hạn thì gọi OSRM
// (timeout 5 giây). Mọi lỗi đều rơi về STRAIGHT để bản đồ không bao giờ làm API lỗi 500.
import type { RouteMode } from '@my-project/shared';
import { greatCircle, haversineKm, lineLengthKm, simplifyLine, type LngLat } from './trackmap.geo';
import { MAP_REQUEST_HEADERS, PUBLIC_ROUTING_URL, farFromRoad, routingUrl } from '../../shared/config/map-services';
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
  /** Mặc định đọc MAP_ROUTING_URL lúc gọi; rỗng → không gọi dịch vụ tính tuyến */
  baseUrl?: () => string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  ttlDays?: number;
  /** Khoảng cách tối thiểu giữa hai lần gọi. Mặc định chỉ giãn cách với server công khai (tối đa 1 yêu cầu/giây). */
  minIntervalMs?: number;
};

/** Giãn hơn 1 giây một chút: một chuyến nhiều chặng chưa có cache sẽ gọi cùng lúc nhiều cặp điểm. */
const PUBLIC_MIN_INTERVAL_MS = 1_100;

/**
 * `overview=full` trả đúng hình học đường (bám từng khúc cua) thay cho bản `simplified` hay cắt góc.
 * Một chặng dài có thể có hàng chục nghìn điểm nên giản lược phía server, dung sai NHỎ để không đổi hình dạng tuyến:
 * - quá MAX_POINTS (2.000) điểm → Douglas–Peucker 8 m (nằm trong khoảng 5–10 m; bề rộng một làn đường ~3,5 m, vẽ trên bản đồ
 *   ở mức zoom xem cả chặng 8 m nhỏ hơn 1 pixel);
 * - nếu sau đó vẫn hơn COARSE_THRESHOLD (4.000 điểm, chỉ với chặng dài hàng nghìn km nhiều khúc cua) → thêm một lượt 25 m cho nhẹ
 *   phản hồi/DB. Đây là giảm thêm chứ không phải trần cứng: không có tuyến thật nào bị cắt cụt hay đổi hình dạng đáng kể.
 */
export const MAX_POINTS = 2_000;
export const SIMPLIFY_TOLERANCE_M = 8;
export const COARSE_THRESHOLD = 4_000;
export const COARSE_TOLERANCE_M = 25;

export function limitRoutePoints(line: LngLat[]): LngLat[] {
  if (line.length <= MAX_POINTS) return line;
  const simplified = simplifyLine(line, SIMPLIFY_TOLERANCE_M);
  return simplified.length > COARSE_THRESHOLD ? simplifyLine(simplified, COARSE_TOLERANCE_M) : simplified;
}
const logger = new Logger('TrackMap');

const straight = (from: LngLat, to: LngLat): ResolvedRoute => ({ mode: 'STRAIGHT', coordinates: [from, to], distanceKm: haversineKm(from, to) });

export class RoutesProvider {
  private readonly inFlight = new Map<string, Promise<ResolvedRoute>>();
  private readonly baseUrl: () => string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly ttlMs: number;
  private readonly minIntervalMs: number | undefined;
  private nextSlot = Promise.resolve();

  constructor(private readonly store: RouteStore, options: Options = {}) {
    this.baseUrl = options.baseUrl ?? routingUrl;
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 5_000;
    this.ttlMs = (options.ttlDays ?? 30) * 86_400_000;
    this.minIntervalMs = options.minIntervalMs;
  }

  /** Xếp hàng các lần gọi; hạn timeout chỉ tính từ lúc tới lượt. */
  private waitForTurn(baseUrl: string): Promise<void> {
    const interval = this.minIntervalMs ?? (baseUrl === PUBLIC_ROUTING_URL ? PUBLIC_MIN_INTERVAL_MS : 0);
    if (interval <= 0) return Promise.resolve();
    const turn = this.nextSlot;
    this.nextSlot = turn.then(() => new Promise(resolve => setTimeout(resolve, interval)));
    return turn;
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
        // STRAIGHT trong cache = dịch vụ tính tuyến đã trả "không có đường"; vẽ thẳng giữa tọa độ hiện tại của hai địa điểm.
        if (cached.mode === 'STRAIGHT') return straight(from, to);
        return { mode: 'ROAD', coordinates: cached.coordinates, distanceKm: cached.distanceM != null ? cached.distanceM / 1000 : lineLengthKm(cached.coordinates) };
      }
    } catch (error) {
      logger.warn('route_cache_read_failed', { message: error instanceof Error ? error.message : String(error) });
    }

    const baseUrl = this.baseUrl();
    if (!baseUrl) return straight(from, to); // Dịch vụ đang tắt: không lưu, để khi bật lại sẽ lấy đường thật.
    await this.waitForTurn(baseUrl);

    // Timer thường (có ref), không dùng AbortSignal.timeout: timer của nó là unref nên khi chỉ còn chờ dịch vụ,
    // event loop có thể rỗng và tiến trình thoát trước khi hết giờ. Hạn này bao cả thời gian đọc thân phản hồi.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DOMException('Directions request timed out', 'TimeoutError')), this.timeoutMs);
    let response: Response;
    let body: { code?: string; routes?: { geometry?: { coordinates?: LngLat[] }; distance?: number; duration?: number }[]; waypoints?: { distance?: number }[] } = {};
    try {
      const url = `${baseUrl}${from[0]},${from[1]};${to[0]},${to[1]}?geometries=geojson&overview=full`;
      response = await this.fetchImpl(url, { signal: controller.signal, headers: MAP_REQUEST_HEADERS });
      try { body = await response.json(); } catch { /* thân không phải JSON */ }
    } catch (error) {
      // Timeout / mất mạng: lỗi tạm thời, không cache để lần sau thử lại.
      logger.warn('directions_unreachable', { fromId, toId, message: error instanceof Error ? error.name : String(error) });
      return straight(from, to);
    } finally {
      clearTimeout(timer);
    }
    // Câu trả lời chắc chắn "không có đường bộ" (OSRM trả kèm HTTP 400), hoặc điểm nằm quá xa đường: nhớ lại để không gọi lại mỗi lần xem.
    if (body.code === 'NoRoute' || body.code === 'NoSegment' || (body.code === 'Ok' && farFromRoad(body.waypoints) >= 0)) {
      await this.persist(fromId, toId, { mode: 'STRAIGHT', coordinates: [from, to], distanceM: null, durationS: null });
      return straight(from, to);
    }
    const best = body.routes?.[0];
    const coordinates = best?.geometry?.coordinates;
    if (response.ok && body.code === 'Ok' && coordinates && coordinates.length >= 2) {
      const line = limitRoutePoints(coordinates);
      const distanceM = typeof best.distance === 'number' ? Math.round(best.distance) : null;
      await this.persist(fromId, toId, { mode: 'ROAD', coordinates: line, distanceM, durationS: typeof best.duration === 'number' ? Math.round(best.duration) : null });
      return { mode: 'ROAD', coordinates: line, distanceKm: distanceM != null ? distanceM / 1000 : lineLengthKm(coordinates) };
    }
    logger.warn('directions_failed', { fromId, toId, status: response.status, code: body.code ?? 'none' });
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
