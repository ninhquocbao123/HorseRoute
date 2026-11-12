/**
 * Dịch vụ tra địa chỉ dự phòng (Nominatim của OpenStreetMap) khi Photon công khai lỗi hoặc quá chậm.
 * Ngày 12/11/2026 Photon mất ~30 giây mỗi lần tra (quá thời gian chờ 10 giây) trong khi Nominatim ~1 giây.
 * Chính sách dùng Nominatim công khai: tối đa 1 yêu cầu/giây, có User-Agent riêng, ghi nguồn OpenStreetMap,
 * nên mọi yêu cầu đi qua một hàng đợi cách nhau 1,1 giây. Đặt MAP_FALLBACK_GEOCODING_URL rỗng để tắt.
 */
import { MAP_REQUEST_HEADERS } from './map-services';

const PUBLIC_NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
export const fallbackGeocodingUrl = () => {
  const value = process.env.MAP_FALLBACK_GEOCODING_URL;
  return value === undefined ? PUBLIC_NOMINATIM_URL : value.trim();
};

/**
 * Cầu dao dùng chung: Photon lỗi mạng hoặc quá thời gian một lần thì 5 phút tới mọi lần tra đi thẳng sang Nominatim,
 * không chờ quá thời gian từng lần (tự lập một tuyến tra 4–14 lần).
 */
export const photonHealth = {
  downUntil: 0,
  isDown() { return Date.now() < this.downUntil; },
  markDown() { this.downUntil = Date.now() + 5 * 60_000; },
};

let queue: Promise<unknown> = Promise.resolve();
let last = 0;
async function get(path: string, params: Record<string, string>): Promise<unknown> {
  const base = fallbackGeocodingUrl();
  if (!base) return null;
  const work = queue.then(async () => {
    await new Promise(resolve => setTimeout(resolve, Math.max(0, 1_100 - (Date.now() - last))));
    last = Date.now();
    const url = new URL(path, base.endsWith('/') ? base : base + '/');
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000), headers: { ...MAP_REQUEST_HEADERS, 'Accept-Language': 'vi,en' } });
    return response.ok ? response.json() : null;
  });
  queue = work.catch(() => undefined);
  try { return await work; } catch { return null; }
}

/** Kết quả đầu tiên thuộc đúng nước (mã ISO 2 chữ), dạng [kinh độ, vĩ độ]; null khi không có hoặc dịch vụ lỗi. */
export async function nominatimSearch(query: string, country: string): Promise<[number, number] | null> {
  const data = await get('search', { q: query.slice(0, 200), format: 'jsonv2', limit: '3', countrycodes: country.toLowerCase(), addressdetails: '0' });
  if (!Array.isArray(data)) return null;
  for (const item of data as { lat?: string; lon?: string }[]) {
    const lat = Number(item.lat), lng = Number(item.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return [lng, lat];
  }
  return null;
}

/** Tên huyện/thành phố và tỉnh ở một tọa độ (ưu tiên tiếng Việt, rồi tiếng Anh); null khi không có. */
export async function nominatimPlace(latitude: number, longitude: number): Promise<string | null> {
  const data = await get('reverse', { lat: String(latitude), lon: String(longitude), format: 'jsonv2', zoom: '10' }) as { address?: Record<string, string> } | null;
  const a = data?.address;
  if (!a) return null;
  const place = [a.city || a.town || a.county || a.city_district || a.village || a.municipality, a.state || a.province].filter(Boolean);
  return place.length ? [...new Set(place)].join(', ').slice(0, 200) : null;
}
