import { randomUUID } from 'crypto';
import { z } from 'zod';
import { BadRequestException, ServiceUnavailableException } from '../../shared/core/error.response';
import { MAP_REQUEST_HEADERS, geocodingUrl } from '../../shared/config/map-services';
import { RouteDistanceService, nativeName } from '../customer/route-distance';
import { nominatimPlace, nominatimSearch, photonHealth } from '../../shared/config/nominatim';
import { BORDER_CORRIDORS, BorderCorridor, corridorsTo, findCorridor } from './border-gates';
import { rawRoute, routeWithLegs, searchAddresses } from './trip-map-provider';
import { MAX_ROUTE_WAYPOINTS, RouteWaypoint, routeWaypointsSchema } from './trip-route-plan';
import {
  AutoplanParams, CatalogStop, LngLat, Schedule, computeSchedule, customerDeparture, distanceM, placeRestStops, routeTimeline,
} from './route-autoplan';
import { isSameVietnamCalendarDate } from './trips.validation';
import { firstExit, ql1Anchors, westOfVietnam } from './vn-territory';

const position = z.object({ latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180) }).strict();
export const autoRoutePlanSchema = z.object({
  /** Giờ xuất phát điều phối viên nhập hoặc sửa; bỏ trống thì lấy theo ngày và khung giờ khách chọn. */
  plannedDepartureAt: z.string().datetime({ offset: true }).optional(),
  /** Vị trí điều phối viên đã kéo ghim lại; bỏ trống thì hệ thống tự tra từ địa chỉ trong đơn. */
  origin: position.optional(),
  destination: position.optional(),
  /** Đổi hành lang cửa khẩu (đơn quốc tế). */
  corridorCode: z.string().trim().max(40).optional(),
  /** Điều phối viên đã sửa tay các điểm: chỉ tính lại tuyến và lịch, không đặt lại điểm nghỉ. */
  waypoints: routeWaypointsSchema.optional(),
}).strict();
export type AutoRoutePlanInput = z.infer<typeof autoRoutePlanSchema>;

type Contact = { address?: string; city?: string; ward?: string; country?: string };
export type AutoplanSource = {
  originAddress: string | null; destinationAddress: string | null; originCountry: string | null; destinationCountry: string | null;
  desiredDepartureDate: string | null; bookingDetails: unknown;
};
export type Precision = 'MANUAL' | 'ADDRESS' | 'WARD' | 'CITY' | 'SEARCH';

const COUNTRY: Record<string, 'VN' | 'CN' | 'TH'> = { vn: 'VN', 'viet nam': 'VN', vietnam: 'VN', cn: 'CN', 'trung quoc': 'CN', china: 'CN', th: 'TH', 'thai lan': 'TH', thailand: 'TH' };
const plain = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
export const countryCode = (...values: (string | null | undefined)[]) => {
  for (const value of values) { const code = value ? COUNTRY[plain(value)] : undefined; if (code) return code; }
  return null;
};
const parseBooking = (value: unknown): { sender?: Contact; recipient?: Contact; pickupTime?: string; border?: string } => {
  if (!value) return {};
  try { return (typeof value === 'string' ? JSON.parse(value) : value) as never; } catch { return {}; }
};

const distance = new RouteDistanceService();
/** Tọa độ một đầu tuyến: ưu tiên địa chỉ đầy đủ nếu nằm gần phường/tỉnh trong đơn; không thì lấy tâm phường hoặc tỉnh. */
async function locateContact(contact: Contact | undefined, fallbackText: string | null, country: 'VN' | 'CN' | 'TH' | null, side: string) {
  let area: { point: LngLat; precision: Precision } | null = null;
  // Phân biệt "không tìm thấy" với "dịch vụ bản đồ không phản hồi" để báo đúng nguyên nhân cho điều phối viên.
  let serviceDown = false;
  if (contact?.city && country) {
    try { const found = await distance.locate({ country, city: contact.city, ward: contact.ward ?? '' }); area = { point: found.coordinates, precision: found.precision === 'ward' ? 'WARD' : 'CITY' }; }
    catch (error) { if (!(error instanceof BadRequestException)) serviceDown = true; /* thử tìm theo địa chỉ bên dưới */ }
  }
  const text = [contact?.address, contact?.ward, contact?.city].filter(Boolean).join(', ') || fallbackText?.trim() || '';
  if (text.length >= 3) {
    const accept = (point: LngLat | null) => point && (!area || distanceM(point, area.point) <= 25_000)
      ? { latitude: point[1], longitude: point[0], precision: (area ? 'ADDRESS' : 'SEARCH') as Precision } : null;
    if (!photonHealth.isDown()) {
      try {
        const results = await searchAddresses(text.slice(0, 200), fetch, country ?? undefined);
        const near = results.map(result => accept([result.longitude, result.latitude])).find(Boolean);
        if (near) return near;
      } catch (error) { if (!(error instanceof BadRequestException)) { serviceDown = true; photonHealth.markDown(); } }
    }
    // Photon không phản hồi: tra địa chỉ đầy đủ bằng Nominatim; không có thì dùng tâm khu vực nếu có.
    if (photonHealth.isDown() && country) {
      serviceDown = true;
      const near = accept(await nominatimSearch(text, country));
      if (near) return near;
    }
  }
  if (area) return { latitude: area.point[1], longitude: area.point[0], precision: area.precision };
  // Photon không phản hồi: thử Nominatim (phường + tỉnh, rồi chỉ tỉnh) trước khi báo lỗi.
  if (serviceDown && country) {
    const ward = contact?.ward ? nativeName(contact.ward) : '', city = contact?.city ? nativeName(contact.city) : '';
    const byWard = ward && city ? await nominatimSearch(`${ward}, ${city}`, country) : null;
    const point = byWard ?? (city ? await nominatimSearch(city, country) : null) ?? (fallbackText ? await nominatimSearch(fallbackText, country) : null);
    if (point) return { latitude: point[1], longitude: point[0], precision: (byWard ? 'WARD' : 'CITY') as Precision };
  }
  if (serviceDown) throw new ServiceUnavailableException(`Dịch vụ bản đồ công khai đang chậm hoặc không phản hồi nên chưa tra được ${side}. Thử lại sau ít phút, hoặc tìm, chọn vị trí trên bản đồ.`);
  throw new BadRequestException(`Chưa xác định được ${side} trên bản đồ từ địa chỉ trong đơn. Hãy tìm hoặc chọn vị trí trên bản đồ.`);
}

/** Nhãn địa danh cho điểm nghỉ tự sinh (Photon reverse); lỗi thì giữ nhãn có sẵn. */
async function placeName(latitude: number, longitude: number): Promise<string | null> {
  const base = geocodingUrl();
  if (!base) return null;
  if (photonHealth.isDown()) return latinPlace(await nominatimPlace(latitude, longitude));

  const lookup = async (lang: string) => {
    const url = new URL(base.replace(/\/api\/?$/, '/reverse'));
    url.searchParams.set('lat', String(latitude)); url.searchParams.set('lon', String(longitude)); url.searchParams.set('lang', lang);
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000), headers: MAP_REQUEST_HEADERS });
    if (!response.ok) return null;
    const props = ((await response.json()) as { features?: { properties?: Record<string, string> }[] }).features?.[0]?.properties;
    const place = [props?.district || props?.city || props?.county || props?.name, props?.state].filter(Boolean);
    return place.length ? place.join(', ').slice(0, 200) : null;
  };
  try {
    // Tên gốc giữ dấu tiếng Việt; ở Lào, Thái Lan, Trung Quốc tên gốc là chữ bản địa nên lấy tên tiếng Anh.
    const local = await lookup('default');
    if (!local || LATIN.test(local)) return local;
    // Bản tiếng Anh vẫn có thể còn tên bản địa (làng nhỏ): chỉ giữ phần đọc được, không có thì bỏ tên.
    return latinPlace((await lookup('en')) ?? local);
  } catch {
    photonHealth.markDown();
    return latinPlace(await nominatimPlace(latitude, longitude));
  }
}
/** Chỉ giữ phần tên đọc được bằng chữ Latin (tên làng nhỏ ở Lào, Thái Lan có thể chỉ có chữ bản địa). */
function latinPlace(place: string | null) {
  if (!place) return null;
  const latin = place.split(', ').filter(part => LATIN.test(part));
  return latin.length ? latin.join(', ') : null;
}
const LATIN = /^[\p{Script=Latin}\p{N}\p{P}\p{Zs}\p{M}]*$/u;

/** Xếp hành lang theo đường chim bay qua các cửa khẩu (rẻ, không gọi bản đồ); khách đã ghi cửa khẩu dự kiến thì ưu tiên. */
function rankCorridors(corridors: BorderCorridor[], origin: LngLat, destination: LngLat, preferred: string | undefined) {
  const wish = preferred ? plain(preferred) : '';
  return corridors.map(corridor => {
    const points: LngLat[] = [origin, ...corridor.gates.flatMap(g => [[g.exit.longitude, g.exit.latitude], [g.entry.longitude, g.entry.latitude]] as LngLat[]), destination];
    let km = 0; for (let i = 1; i < points.length; i++) km += distanceM(points[i - 1], points[i]) / 1000;
    const named = !!wish && corridor.gates.some(g => wish.includes(plain(g.exit.name.replace(/^Cửa khẩu\s+/i, '').replace(/\s*\(.*$/, ''))));
    return { corridor, km: Math.round(km), named };
  }).sort((a, b) => Number(b.named) - Number(a.named) || a.km - b.km);
}

/** Tuyến thô qua các điểm, kèm phút lái xe tải ở từng tọa độ và ở từng điểm cố định (`fixedIdx` là vị trí của chúng trong `points`). */
async function timedRoute(points: Parameters<typeof rawRoute>[0], fixedIdx: number[], truckFactor: number) {
  const raw = await rawRoute(points);
  const times = routeTimeline(raw.coordinates, raw.legs, truckFactor);
  const cumulative = [0];
  for (const leg of raw.legs) cumulative.push(cumulative.at(-1)! + leg.durationS * truckFactor / 60);
  return { raw, times, fixedAt: fixedIdx.map(i => cumulative[i] ?? cumulative.at(-1)!) };
}

/** Đoạn tuyến trước cửa khẩu đầu tiên (cả tuyến nếu đi trong nước) có đi sâu sang Lào/Campuchia không. Chỉ xét tuyến đi từ Việt Nam. */
function outsideVietnam(waypoints: RouteWaypoint[], coords: LngLat[]) {
  const origin = waypoints[0];
  if (!origin || westOfVietnam([origin.longitude, origin.latitude])) return false;
  const gate = waypoints.find(w => w.kind === 'BORDER');
  let end = coords.length;
  if (gate) {
    let best = Infinity;
    coords.forEach((c, i) => { const d = distanceM(c, [gate.longitude, gate.latitude]); if (d < best) { best = d; end = i + 1; } });
  }
  return !!firstExit(coords.slice(0, end));
}

export type AutoplanDeps ={ source: AutoplanSource; params: AutoplanParams; catalog: CatalogStop[] };
export type AutoplanResult = {
  waypoints: RouteWaypoint[];
  route: Awaited<ReturnType<typeof routeWithLegs>>;
  schedule: Schedule | null;
  departure: { at: string | null; source: 'INPUT' | 'CUSTOMER' | 'MISSING'; customerDate: string | null; pickupTime: string | null };
  locate: { origin: Precision; destination: Precision } | null;
  corridor: { chosen: string | null; options: { code: string; name: string; km: number }[] };
  warnings: string[];
};

export async function buildAutoRoutePlan(tripId: string, input: AutoRoutePlanInput, deps: AutoplanDeps): Promise<AutoplanResult> {
  const { source, params } = deps;
  const booking = parseBooking(source.bookingDetails);
  const warnings: string[] = [];
  const customer = customerDeparture(source.desiredDepartureDate, booking.pickupTime);
  const departureAt = input.plannedDepartureAt ? new Date(input.plannedDepartureAt) : customer;
  const departure = { at: departureAt?.toISOString() ?? null, source: (input.plannedDepartureAt ? 'INPUT' : customer ? 'CUSTOMER' : 'MISSING') as AutoplanResult['departure']['source'], customerDate: source.desiredDepartureDate, pickupTime: booking.pickupTime?.trim() || null };
  if (!departureAt) warnings.push('Đơn chưa có ngày khởi hành mong muốn. Hãy nhập giờ xuất phát để hệ thống tính giờ đến.');
  else if (departure.source === 'CUSTOMER' && departureAt.getTime() < Date.now()) warnings.push('Ngày khởi hành khách chọn đã qua. Hãy nhập giờ xuất phát mới.');

  let waypoints: RouteWaypoint[];
  let locate: AutoplanResult['locate'] = null;
  let corridor: AutoplanResult['corridor'] = { chosen: null, options: [] };
  if (input.waypoints) {
    waypoints = input.waypoints;
  } else {
    const fromCountry = countryCode(booking.sender?.country, source.originCountry) ?? 'VN';
    const toCountry = countryCode(booking.recipient?.country, source.destinationCountry) ?? fromCountry;
    const origin = input.origin ? { ...input.origin, precision: 'MANUAL' as Precision } : await locateContact(booking.sender, source.originAddress, fromCountry, 'điểm gửi');
    const destination = input.destination ? { ...input.destination, precision: 'MANUAL' as Precision } : await locateContact(booking.recipient, source.destinationAddress, toCountry, 'điểm nhận');
    locate = { origin: origin.precision, destination: destination.precision };
    const start: RouteWaypoint = { id: `wp-${randomUUID()}`, kind: 'ORIGIN', label: (source.originAddress || 'Điểm gửi').slice(0, 255), latitude: origin.latitude, longitude: origin.longitude, note: '' };
    const end: RouteWaypoint = { id: `wp-${randomUUID()}`, kind: 'DESTINATION', label: (source.destinationAddress || 'Điểm nhận').slice(0, 255), latitude: destination.latitude, longitude: destination.longitude, note: '' };
    const gates: RouteWaypoint[] = [];
    if (fromCountry !== toCountry) {
      const ranked = rankCorridors(fromCountry === 'VN' ? corridorsTo(toCountry) : [], [origin.longitude, origin.latitude], [destination.longitude, destination.latitude], booking.border);
      if (!ranked.length) throw new BadRequestException(`Chưa có hành lang cửa khẩu cho tuyến ${fromCountry} → ${toCountry}.`);
      const picked = input.corridorCode ? ranked.find(r => r.corridor.code === input.corridorCode) : ranked[0];
      if (!picked) throw new BadRequestException(findCorridor(input.corridorCode!) ? 'Hành lang cửa khẩu không đi tới nước nhận của đơn.' : 'Không có hành lang cửa khẩu này.');
      corridor = { chosen: picked.corridor.code, options: ranked.map(r => ({ code: r.corridor.code, name: r.corridor.name, km: r.km })) };
      for (const gate of picked.corridor.gates) {
        gates.push({ id: `wp-${randomUUID()}`, kind: 'BORDER', borderStage: 'ARRIVED', gateCode: gate.code, label: gate.exit.name, latitude: gate.exit.latitude, longitude: gate.exit.longitude, note: `Dừng kiểm tra giấy tờ (khoảng ${params.borderDwellMin} phút)` });
        gates.push({ id: `wp-${randomUUID()}`, kind: 'BORDER', borderStage: 'CLEARED', gateCode: gate.code, label: `${gate.entry.name} – đã qua cửa khẩu`, latitude: gate.entry.latitude, longitude: gate.entry.longitude, note: `Đã thông quan, vào ${gate.entry.country}` });
      }
    }
    const fixed = [start, ...gates, end];
    let { raw, times, fixedAt } = await timedRoute(fixed, fixed.map((_, i) => i), params.truckFactor);
    // Đoạn đầu (từ điểm gửi tới cửa khẩu phía Việt Nam, hoặc cả tuyến trong nước) phải nằm trong lãnh thổ Việt Nam.
    if (fromCountry === 'VN' && firstExit(raw.coordinates.filter((_, i) => times[i] <= fixedAt[1] + 1e-6))) {
      const anchors = ql1Anchors([start.longitude, start.latitude], [fixed[1].longitude, fixed[1].latitude]);
      if (anchors.length) {
        const via = anchors.map(([longitude, latitude]) => ({ latitude, longitude, label: 'Quốc lộ 1' }));
        ({ raw, times, fixedAt } = await timedRoute([start, ...via, ...fixed.slice(1)], fixed.map((_, i) => i ? i + via.length : 0), params.truckFactor));
      }
    }
    const rests = placeRestStops(raw.coordinates, times, fixed.flatMap((p, i) => p.borderStage === 'ARRIVED' ? [fixedAt[i]] : []), deps.catalog, params);
    const unnamed = rests.filter(rest => !rest.catalogId).slice(0, 12);
    // Hai yêu cầu cùng lúc: nhanh hơn tra lần lượt mà không bị Photon công khai từ chối vì gọi dồn.
    let next = 0;
    const worker = async () => {
      while (next < unnamed.length) {
        const rest = unnamed[next++];
        const place = await placeName(rest.latitude, rest.longitude);
        if (place) rest.label = `${rest.label} gần ${place}`.slice(0, 255);
      }
    };
    await Promise.all([worker(), worker()]);
    waypoints = [start];
    for (let i = 1; i < fixed.length; i++) {
      // Hai điểm của một cửa khẩu phải liền nhau: điểm nghỉ rơi giữa "đến" và "qua" cửa khẩu được xếp sau điểm "qua".
      const after = fixed[i - 1].borderStage === 'CLEARED' ? fixedAt[i - 2] : fixedAt[i - 1];
      if (fixed[i].borderStage !== 'CLEARED') for (const rest of rests) if (rest.atMin > after && rest.atMin <= fixedAt[i]) {
        waypoints.push({ id: `wp-${randomUUID()}`, kind: 'REST_STOP', label: rest.label.slice(0, 255), latitude: Number(rest.latitude.toFixed(7)), longitude: Number(rest.longitude.toFixed(7)),
          note: rest.catalogId ? 'Trạm trong danh mục' : 'Điểm tự sinh, chưa xác minh' });
      }
      waypoints.push(fixed[i]);
    }
    if (waypoints.length > MAX_ROUTE_WAYPOINTS) throw new BadRequestException(`Tuyến cần ${waypoints.length} điểm, quá giới hạn ${MAX_ROUTE_WAYPOINTS}. Hãy chia chuyến hoặc lập tay.`);
  }
  const route = await routeWithLegs(tripId, waypoints);
  if (outsideVietnam(waypoints, route.geometry.coordinates as LngLat[])) warnings.push('Tuyến tìm được có đoạn trong nước đi qua lãnh thổ Lào hoặc Campuchia. Hãy thêm hoặc kéo điểm nghỉ dọc Quốc lộ 1 để tuyến đi trong nước.');
  const schedule = departureAt ? computeSchedule(waypoints, route.legs.map(leg => leg.durationS * params.truckFactor / 60), departureAt, params) : null;
  if (schedule) {
    warnings.push(...schedule.warnings);
    if (isSameVietnamCalendarDate(schedule.departureAt, schedule.arrivalAt)) warnings.push('Giờ đến dự kiến cùng ngày với giờ xuất phát, nhưng quy định hiện tại yêu cầu ngày giao khác ngày đi. Hãy chỉnh giờ đến trước khi lưu kế hoạch.');
  }
  return { waypoints, route, schedule, departure, locate, corridor, warnings };
}

export const ALL_CORRIDORS = BORDER_CORRIDORS.map(c => ({ code: c.code, name: c.name, destinationCountry: c.destinationCountry }));
