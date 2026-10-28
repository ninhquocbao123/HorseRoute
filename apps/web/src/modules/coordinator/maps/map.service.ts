import type { AddressResult, LatLng, RouteCandidate, Waypoint } from './route.types'

export function isLatLng(value: unknown): value is LatLng {
  return Array.isArray(value) && value.length === 2 && value.every(n => typeof n === 'number' && Number.isFinite(n)) && Math.abs(value[0]) <= 90 && Math.abs(value[1]) <= 180
}

export function routeInputKey(points: Waypoint[]): string {
  return JSON.stringify(points.map(p => [p.id, p.position ?? null]))
}

export function parseRoutes(data: unknown): RouteCandidate[] {
  if (!data || typeof data !== 'object' || !('code' in data) || data.code !== 'Ok' || !('routes' in data) || !Array.isArray(data.routes) || !data.routes.length) {
    throw new Error('Không tìm thấy đường đi. Hãy chọn điểm gần đường giao thông và thử lại.')
  }
  return data.routes.map((route: unknown, index) => {
    if (!route || typeof route !== 'object') throw new Error('Dữ liệu tuyến không hợp lệ.')
    const r = route as Record<string, unknown>
    const g = r.geometry as { type?: string; coordinates?: unknown } | undefined
    if (!g || g.type !== 'LineString' || !Array.isArray(g.coordinates) || g.coordinates.length < 2 || !g.coordinates.every(c => Array.isArray(c) && c.length === 2 && isLatLng([c[1], c[0]])) || typeof r.distance !== 'number' || !Number.isFinite(r.distance) || r.distance < 0 || typeof r.duration !== 'number' || !Number.isFinite(r.duration) || r.duration < 0) {
      throw new Error('Dữ liệu tuyến không hợp lệ. Vui lòng thử lại.')
    }
    return { id: `route-${index}`, geometry: { type: 'LineString', coordinates: g.coordinates }, distanceM: r.distance, durationS: r.duration }
  })
}

async function readJson(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]) })
  if (!response.ok) {
    if (response.status === 429) throw new Error('Dịch vụ đang bận. Vui lòng chờ vài giây rồi thử lại.')
    throw new Error(`Không thể kết nối dịch vụ bản đồ (HTTP ${response.status}). Hãy thử lại.`)
  }
  return response.json() as Promise<unknown>
}

export async function calculateRoutes(points: Waypoint[], signal: AbortSignal): Promise<RouteCandidate[]> {
  if (points.length < 2 || points.some(p => !isLatLng(p.position))) throw new Error('Vui lòng xác định vị trí của tất cả các điểm.')
  const coordinates = points.map(p => `${p.position![1]},${p.position![0]}`).join(';')
  const base = import.meta.env.VITE_ROUTING_URL || 'https://router.project-osrm.org'
  const params = new URLSearchParams({ overview: 'full', geometries: 'geojson', alternatives: 'true', radiuses: points.map(() => '1000').join(';') })
  return parseRoutes(await readJson(`${base}/route/v1/driving/${coordinates}?${params}`, signal))
}
