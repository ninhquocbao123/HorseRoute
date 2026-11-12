/**
 * Thuật toán tự lập lộ trình (kế hoạch điều phối tự động 12/11/2026, mục 3 và 4). Toàn hàm thuần để test không cần mạng.
 * Đơn vị thời gian là phút lái xe tải (đã nhân hệ số xe tải so với thời gian OSRM tính cho xe con).
 */
export type AutoplanParams = {
  restTargetMin: number; restEarliestMin: number; restLatestMin: number; restDwellMin: number;
  dailyDriveMaxMin: number; overnightMin: number; truckFactor: number; etaBufferMin: number;
  loadingMin: number; borderDwellMin: number; restWarnMin: number; restBlockMin: number;
  /** Nghỉ qua đêm kết thúc không sớm hơn giờ này sáng hôm sau (phút trong ngày, giờ Việt Nam). */
  dayStartMin: number;
};
/** Đã chốt H1, H3, H6: nghỉ sau 3h30 (trễ nhất 4h theo Điều 64 Luật TTATGTĐB 2024), cảnh báo 4h, chặn 6h. */
export const DEFAULT_AUTOPLAN_PARAMS: AutoplanParams = {
  restTargetMin: 210, restEarliestMin: 150, restLatestMin: 240, restDwellMin: 30,
  dailyDriveMaxMin: 600, overnightMin: 480, truckFactor: 1.25, etaBufferMin: 60,
  loadingMin: 30, borderDwellMin: 30, restWarnMin: 240, restBlockMin: 360, dayStartMin: 300,
};
/** Mã tham số trong bảng system_parameters (param_code tối đa 10 ký tự). */
export const AUTOPLAN_PARAM_CODES: Record<keyof AutoplanParams, string> = {
  restTargetMin: 'REST_TGT', restEarliestMin: 'REST_MIN', restLatestMin: 'REST_MAX', restDwellMin: 'REST_DWELL',
  dailyDriveMaxMin: 'DRIVE_DAY', overnightMin: 'OVERNIGHT', truckFactor: 'TRUCK_FACT', etaBufferMin: 'ETA_BUFFER',
  loadingMin: 'LOADING', borderDwellMin: 'BORDER_DWL', restWarnMin: 'REST_WARN', restBlockMin: 'REST_BLOCK', dayStartMin: 'DAY_START',
};

/** Đọc tham số từ system_parameters; giá trị thiếu hoặc vô lý thì giữ mặc định. */
export function autoplanParams(rows: { code: string; value: unknown }[]): AutoplanParams {
  const params = { ...DEFAULT_AUTOPLAN_PARAMS };
  for (const [key, code] of Object.entries(AUTOPLAN_PARAM_CODES) as [keyof AutoplanParams, string][]) {
    const raw = rows.find(row => row.code === code)?.value;
    const value = Number(raw);
    if (raw === null || raw === undefined || raw === '' || !Number.isFinite(value)) continue;
    if (key === 'truckFactor' ? value >= 1 && value <= 3 : Number.isInteger(value) && value >= 0 && value <= 1440) params[key] = value;
  }
  if (!(params.restEarliestMin <= params.restTargetMin && params.restTargetMin <= params.restLatestMin && params.restLatestMin > 0)) {
    Object.assign(params, { restTargetMin: DEFAULT_AUTOPLAN_PARAMS.restTargetMin, restEarliestMin: DEFAULT_AUTOPLAN_PARAMS.restEarliestMin, restLatestMin: DEFAULT_AUTOPLAN_PARAMS.restLatestMin });
  }
  return params;
}

export type LngLat = [number, number];
export type RouteLegInfo = { distanceM: number; durationS: number };
export type CatalogStop = { id: string; name: string; latitude: number; longitude: number };
export type PlannedRest = { atMin: number; latitude: number; longitude: number; label: string; catalogId: string | null };
export type StopKind = 'ORIGIN' | 'REST_STOP' | 'BORDER' | 'DESTINATION';
export type BorderStage = 'ARRIVED' | 'CLEARED';

export function distanceM(a: LngLat, b: LngLat): number {
  const rad = Math.PI / 180, dLat = (b[1] - a[1]) * rad, dLng = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Phút lái xe tải tại từng tọa độ của tuyến. Trong mỗi chặng OSRM (giữa hai điểm cố định) coi tốc độ đều,
 * nên giờ ở mỗi tọa độ nội suy theo quãng đường đã đi trong chặng đó.
 */
export function routeTimeline(coords: LngLat[], legs: RouteLegInfo[], truckFactor: number): number[] {
  const along = [0];
  for (let i = 1; i < coords.length; i++) along.push(along[i - 1] + distanceM(coords[i - 1], coords[i]));
  const geoTotal = along.at(-1) || 1;
  const legTotal = legs.reduce((sum, leg) => sum + leg.distanceM, 0) || geoTotal;
  const ends: number[] = []; const starts: number[] = [];
  let distance = 0, minutes = 0;
  for (const leg of legs) { starts.push(minutes); distance += leg.distanceM; ends.push(distance); minutes += leg.durationS * truckFactor / 60; }
  return along.map(value => {
    const scaled = value / geoTotal * legTotal;
    let k = ends.findIndex(end => scaled <= end + 1e-6);
    if (k < 0) k = legs.length - 1;
    if (k < 0) return 0;
    const legStart = k ? ends[k - 1] : 0, leg = legs[k];
    const share = leg.distanceM > 0 ? Math.min(1, Math.max(0, (scaled - legStart) / leg.distanceM)) : 0;
    return starts[k] + share * leg.durationS * truckFactor / 60;
  });
}

function pointAt(coords: LngLat[], times: number[], atMin: number): LngLat {
  let hi = times.findIndex(t => t >= atMin);
  if (hi <= 0) return coords[hi < 0 ? coords.length - 1 : 0];
  const lo = hi - 1, span = times[hi] - times[lo];
  const share = span > 0 ? (atMin - times[lo]) / span : 0;
  return [coords[lo][0] + (coords[hi][0] - coords[lo][0]) * share, coords[lo][1] + (coords[hi][1] - coords[lo][1]) * share];
}

const formatDrive = (minutes: number) => `${Math.floor(minutes / 60)} giờ${Math.round(minutes % 60) ? ` ${Math.round(minutes % 60)} phút` : ''}`;
export const MAX_CATALOG_DETOUR_M = 3_000;
const DAY_MARGIN_MIN = 15, MIN_LEG_MIN = 30;

/**
 * Đặt điểm nghỉ dọc tuyến: sau mỗi lần nghỉ, nhắm mốc `restTargetMin`; tìm trạm trong danh mục cách tuyến ≤ 3 km
 * trong khoảng [restEarliestMin, restLatestMin], chọn trạm gần mốc nhất; không có thì lấy đúng điểm trên tuyến.
 * `fixedRestMin` là các mốc đã là lần nghỉ sẵn (cửa khẩu phía đến), đặt lại bộ đếm khi xe đi qua.
 */
export function placeRestStops(coords: LngLat[], times: number[], fixedRestMin: number[], catalog: CatalogStop[], params: AutoplanParams): PlannedRest[] {
  const total = times.at(-1) ?? 0;
  const fixed = [...fixedRestMin].sort((a, b) => a - b);
  const rests: PlannedRest[] = [];
  // Lái trong ngày: khi phần còn lại của ngày không đủ một chặng nghỉ, điểm nghỉ kế tiếp đặt vừa hết giới hạn ngày
  // (trừ hao `DAY_MARGIN_MIN` vì tuyến cuối lệch vài phút) để lịch nghỉ qua đêm ở đó, thay vì dừng sớm từ giữa chiều.
  const dayCap = params.dailyDriveMaxMin - DAY_MARGIN_MIN;
  let last = 0, day = 0;
  for (let guard = 0; guard < 200; guard++) {
    const gate = fixed.find(t => t > last + 1e-6);
    // Cửa khẩu kế tiếp là lần nghỉ sẵn, trừ khi tới đó thì quá giới hạn ngày: khi ấy đặt điểm nghỉ đêm trước cửa khẩu.
    if (gate !== undefined && gate - last <= params.restLatestMin && (day + gate - last <= params.dailyDriveMaxMin || dayCap - day < MIN_LEG_MIN)) {
      day = day + gate - last > dayCap ? gate - last : day + gate - last; last = gate; continue;
    }
    let budget = dayCap - day;
    if (budget < MIN_LEG_MIN) { day = 0; budget = dayCap; } // điểm vừa qua là nơi nghỉ qua đêm
    if (total - last <= params.restLatestMin && total - last <= budget + DAY_MARGIN_MIN) break;
    const endOfDay = budget < params.restTargetMin;
    // Đoạn cuối chỉ hơi quá giới hạn thì nghỉ quãng giữa, không để điểm nghỉ sát ngay trước điểm nhận.
    const tail = total - last <= params.restTargetMin * 2 ? Math.max(params.restEarliestMin, (total - last) / 2) : params.restTargetMin;
    const target = last + (endOfDay ? budget : tail);
    const from = last + (endOfDay ? Math.max(MIN_LEG_MIN, budget - 60) : params.restEarliestMin);
    const to = Math.min(last + (endOfDay ? budget : params.restLatestMin), gate ?? Infinity);
    let best: { stop: CatalogStop; at: number } | null = null;
    for (const stop of catalog) {
      let nearest = Infinity, at = 0;
      for (let i = 0; i < coords.length; i++) {
        if (times[i] < from || times[i] > to) continue;
        const d = distanceM(coords[i], [stop.longitude, stop.latitude]);
        if (d < nearest) { nearest = d; at = times[i]; }
      }
      if (nearest <= MAX_CATALOG_DETOUR_M && (!best || Math.abs(at - target) < Math.abs(best.at - target))) best = { stop, at };
    }
    if (best) {
      rests.push({ atMin: best.at, latitude: best.stop.latitude, longitude: best.stop.longitude, label: best.stop.name, catalogId: best.stop.id });
      day = endOfDay ? 0 : day + best.at - last; last = best.at;
    } else {
      const at = Math.min(target, to);
      const [longitude, latitude] = pointAt(coords, times, at);
      // Không ghi số giờ lái vào nhãn: tuyến cuối đi qua điểm nghỉ nên giờ thật lệch vài phút; giờ đúng nằm trong lịch.
      rests.push({ atMin: at, latitude, longitude, label: `Điểm nghỉ ${rests.length + 1}`, catalogId: null });
      day = endOfDay ? 0 : day + at - last; last = at;
    }
  }
  return rests;
}

export type ScheduleStop = { kind: StopKind; borderStage?: BorderStage };
export type ScheduledStop = { index: number; arriveAt: string; departAt: string; dwellMin: number; overnight: boolean; driveMinFromPrevRest: number };
export type Schedule = {
  departureAt: string; startDrivingAt: string; rawArrivalAt: string; arrivalAt: string;
  breakdown: { loadingMin: number; driveMin: number; restMin: number; borderMin: number; overnightMin: number; bufferMin: number; truckFactor: number };
  stops: ScheduledStop[]; maxContinuousMin: number; warnings: string[];
};

/** Điểm được tính là một lần nghỉ cho ngựa: điểm nghỉ, và phía đến của cửa khẩu (dừng kiểm tra giấy tờ). */
const isRest = (stop: ScheduleStop) => stop.kind === 'REST_STOP' || (stop.kind === 'BORDER' && stop.borderStage === 'ARRIVED');
const dwellOf = (stop: ScheduleStop, params: AutoplanParams) => stop.kind === 'REST_STOP' ? params.restDwellMin : stop.kind === 'BORDER' && stop.borderStage === 'ARRIVED' ? params.borderDwellMin : 0;

const VN_OFFSET_MS = 7 * 3_600_000, DAY_MS = 86_400_000;
/** Mốc `startMin` (giờ Việt Nam) đầu tiên sau thời điểm `ms`. */
function nextDayStart(ms: number, startMin: number) {
  const local = ms + VN_OFFSET_MS;
  let start = Math.floor(local / DAY_MS) * DAY_MS + startMin * 60_000;
  if (start <= local) start += DAY_MS;
  return start - VN_OFFSET_MS;
}

/**
 * Lịch dự kiến theo tuyến cuối cùng: `legDriveMin[i]` là phút lái xe tải từ điểm i đến điểm i+1.
 * Quá giới hạn lái trong ngày thì điểm nghỉ đó thành nghỉ qua đêm. ETA = xuất phát + bốc ngựa + lái + nghỉ + cửa khẩu + dự phòng.
 */
export function computeSchedule(stops: ScheduleStop[], legDriveMin: number[], departureAt: Date, params: AutoplanParams): Schedule {
  const at = (minutes: number) => new Date(departureAt.getTime() + Math.round(minutes) * 60_000).toISOString();
  const warnings: string[] = [];
  const scheduled: ScheduledStop[] = [];
  let clock = params.loadingMin, dayDrive = 0, sinceRest = 0, maxContinuous = 0;
  let restMin = 0, borderMin = 0, overnightMin = 0;
  const driveMin = legDriveMin.reduce((sum, value) => sum + value, 0);
  for (let i = 1; i < stops.length; i++) {
    const leg = legDriveMin[i - 1] ?? 0;
    clock += leg; dayDrive += leg; sinceRest += leg;
    const stop = stops[i], last = i === stops.length - 1;
    if (!last && !isRest(stop)) { scheduled.push({ index: i, arriveAt: at(clock), departAt: at(clock), dwellMin: 0, overnight: false, driveMinFromPrevRest: Math.round(sinceRest) }); continue; }
    maxContinuous = Math.max(maxContinuous, sinceRest);
    const fromPrev = sinceRest;
    if (last) { scheduled.push({ index: i, arriveAt: at(clock), departAt: at(clock), dwellMin: 0, overnight: false, driveMinFromPrevRest: Math.round(fromPrev) }); break; }
    // Lái tiếp tới lần nghỉ kế tiếp (hoặc điểm nhận) mà vượt giới hạn trong ngày thì nghỉ qua đêm ngay tại đây.
    let ahead = 0;
    for (let j = i + 1; j < stops.length; j++) { ahead += legDriveMin[j - 1] ?? 0; if (isRest(stops[j]) || j === stops.length - 1) break; }
    let dwell = dwellOf(stop, params), overnight = false;
    if (dayDrive + ahead > params.dailyDriveMaxMin) {
      // Nghỉ ít nhất `overnightMin` và không đi tiếp trước `dayStartMin` sáng hôm sau, để không chạy xuyên đêm.
      const arrive = departureAt.getTime() + clock * 60_000;
      const night = Math.ceil((Math.max(arrive + params.overnightMin * 60_000, nextDayStart(arrive, params.dayStartMin)) - arrive) / 60_000);
      overnight = true; overnightMin += Math.max(0, night - dwell); dwell = Math.max(dwell, night); dayDrive = 0;
    }
    if (stop.kind === 'BORDER') borderMin += Math.min(dwell, params.borderDwellMin); else restMin += Math.min(dwell, params.restDwellMin);
    scheduled.push({ index: i, arriveAt: at(clock), departAt: at(clock + dwell), dwellMin: dwell, overnight, driveMinFromPrevRest: Math.round(fromPrev) });
    clock += dwell; sinceRest = 0;
  }
  if (maxContinuous > params.restBlockMin) warnings.push(`Có đoạn lái liên tục ${formatDrive(maxContinuous)}, quá ${formatDrive(params.restBlockMin)}: không gửi duyệt được. Hãy thêm điểm nghỉ.`);
  else if (maxContinuous > params.restWarnMin) warnings.push(`Có đoạn lái liên tục ${formatDrive(maxContinuous)}, quá ${formatDrive(params.restWarnMin)} theo luật. Nên thêm điểm nghỉ.`);
  if (dayDrive > params.dailyDriveMaxMin) warnings.push(`Có ngày lái quá ${formatDrive(params.dailyDriveMaxMin)} vì không còn điểm nghỉ để nghỉ qua đêm.`);
  const rawArrival = clock;
  return {
    departureAt: departureAt.toISOString(), startDrivingAt: at(params.loadingMin), rawArrivalAt: at(rawArrival), arrivalAt: at(rawArrival + params.etaBufferMin),
    breakdown: { loadingMin: params.loadingMin, driveMin: Math.round(driveMin), restMin, borderMin, overnightMin, bufferMin: params.etaBufferMin, truckFactor: params.truckFactor },
    stops: scheduled, maxContinuousMin: Math.round(maxContinuous), warnings,
  };
}

/**
 * Phút lái liên tục dài nhất của một lộ trình đã lưu (chỉ có tổng thời gian và đường vẽ): chiếu từng điểm lên tuyến,
 * chia thời gian theo quãng đường. Dùng để chặn gửi duyệt khi quá `restBlockMin` (B5, quy tắc Q5).
 */
export function longestContinuousDrive(stops: (ScheduleStop & { latitude: number; longitude: number })[], coords: LngLat[], durationS: number, truckFactor: number): number {
  if (stops.length < 2 || coords.length < 2) return 0;
  const times = routeTimeline(coords, [{ distanceM: 1, durationS }], truckFactor);
  let from = 0, lastRest = 0, longest = 0;
  for (let i = 1; i < stops.length; i++) {
    const target: LngLat = [stops[i].longitude, stops[i].latitude];
    let index = i === stops.length - 1 ? coords.length - 1 : from, nearest = Infinity;
    if (i < stops.length - 1) for (let k = from; k < coords.length; k++) { const d = distanceM(coords[k], target); if (d < nearest) { nearest = d; index = k; } }
    from = index;
    if (isRest(stops[i]) || i === stops.length - 1) { longest = Math.max(longest, times[index] - lastRest); lastRest = times[index]; }
  }
  return Math.round(longest);
}

/** Giờ bắt đầu trong khung giờ lấy ngựa của khách ("08:00 – 10:00"); không đọc được thì null. */
export function pickupStart(pickupTime: string | null | undefined): { hour: number; minute: number } | null {
  const match = pickupTime?.match(/(\d{1,2})\s*[:hH]\s*(\d{2})?/);
  if (!match) return null;
  const hour = Number(match[1]), minute = Number(match[2] ?? 0);
  return hour <= 23 && minute <= 59 ? { hour, minute } : null;
}
/** Giờ xuất phát theo dữ liệu khách: ngày khởi hành mong muốn + đầu khung giờ lấy ngựa (giờ Việt Nam), mặc định 08:00. */
export function customerDeparture(date: string | null | undefined, pickupTime: string | null | undefined): Date | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const start = pickupStart(pickupTime) ?? { hour: 8, minute: 0 };
  const value = new Date(`${date}T${String(start.hour).padStart(2, '0')}:${String(start.minute).padStart(2, '0')}:00+07:00`);
  return Number.isFinite(value.getTime()) ? value : null;
}
