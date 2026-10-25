// Dựng phản hồi GET /tracking/trips/:tripId/map (hàm thuần): điểm dừng, tuyến từng chặng, km, vị trí xe.
// Vị trí: GPS khi còn tươi (LIVE/STALE) và chặng hiện tại không phải chặng bay; ngược lại ước tính theo mốc
// (thiết kế mục 8). Mọi vị trí ước tính đều có nhãn "ước tính theo kế hoạch, không phải GPS".
import {
  LegStatus,
  OrderStatus,
  type GpsFreshness,
  type ITripLatestPosition,
  type ITripMap,
  type ITripMapLeg,
  type ITripMapPosition,
  type ITripMapStop,
} from '@my-project/shared';
import type { PositionRow, TripMapLegRow } from './tracking.dto';
import type { ResolvedRoute } from './trackmap.routes-provider';
import { pointAlong, projectOnLine, roundKm, type LngLat } from './trackmap.geo';

export const LIVE_MS = 2 * 60_000;
export const STALE_MS = 10 * 60_000;
const ESTIMATE = 'Ước tính theo kế hoạch, không phải GPS';

/** Chặng chưa hoàn thành mà đã quá giờ đến dự kiến. */
export function isLegOverdue(leg: { status: LegStatus; plannedArrivalAt: Date }, now: number): boolean {
  return leg.status !== LegStatus.COMPLETED && leg.plannedArrivalAt.getTime() < now;
}

const num = (value: string | number | null | undefined) => (value === null || value === undefined ? null : Number(value));

export function legEnds(leg: TripMapLegRow): { from: LngLat | null; to: LngLat | null } {
  const [fromLat, fromLng, toLat, toLng] = [num(leg.fromLat), num(leg.fromLng), num(leg.toLat), num(leg.toLng)];
  return {
    from: fromLat !== null && fromLng !== null ? [fromLng, fromLat] : null,
    to: toLat !== null && toLng !== null ? [toLng, toLat] : null,
  };
}

export function freshnessOf(recordedAt: Date, now: number): GpsFreshness {
  const age = now - recordedAt.getTime();
  return age < LIVE_MS ? 'LIVE' : age < STALE_MS ? 'STALE' : 'OLD';
}

export function toLatestPosition(row: PositionRow | undefined, now: number): ITripLatestPosition | null {
  if (!row) return null;
  const speed = num(row.speedMps);
  return {
    lat: Number(row.latitude),
    lng: Number(row.longitude),
    speedKmh: speed === null ? null : Math.round(speed * 3.6 * 10) / 10,
    accuracyM: row.accuracyM ?? null,
    headingDeg: row.headingDeg ?? null,
    recordedAt: row.recordedAt.toISOString(),
    legId: row.legId,
    freshness: freshnessOf(row.recordedAt, now),
  };
}

type Input = {
  trip: { id: string; orderCode: string; orderStatus: OrderStatus };
  legs: TripMapLegRow[];
  /** Tuyến đã dựng theo id chặng; null khi thiếu tọa độ một đầu */
  routes: Map<string, ResolvedRoute | null>;
  latest: PositionRow | undefined;
  speedLimitKmh: number | null;
  now: number;
};

export function buildTripMap({ trip, legs, routes, latest, speedLimitKmh, now }: Input): ITripMap {
  const warnings: string[] = [];
  const stops: ITripMapStop[] = [];
  const seen = new Set<string>();
  const addStop = (id: string, name: string, locationType: string, point: LngLat | null) => {
    if (seen.has(id)) return;
    seen.add(id);
    stops.push({ locationId: id, name, locationType, lat: point ? point[1] : null, lng: point ? point[0] : null });
    if (!point) warnings.push(`Chưa có tọa độ cho ${name}`);
  };

  const mapLegs: ITripMapLeg[] = legs.map((leg, index) => {
    const ends = legEnds(leg);
    if (index === 0) addStop(leg.fromId, leg.fromName, leg.fromType, ends.from);
    addStop(leg.toId, leg.toName, leg.toType, ends.to);
    const route = routes.get(leg.id) ?? null;
    if (route?.mode === 'STRAIGHT') warnings.push(`Chặng ${leg.seqNo}: chưa có tuyến đường bộ, đang vẽ đường thẳng ước lượng`);
    return {
      id: leg.id,
      seqNo: leg.seqNo,
      status: leg.status,
      fromLocationId: leg.fromId,
      toLocationId: leg.toId,
      mode: route?.mode ?? (leg.vehicleType === 'AIRCRAFT_HOLD' ? 'AIR' : 'STRAIGHT'),
      coordinates: route ? route.coordinates : null,
      distanceKm: route ? roundKm(route.distanceKm) : null,
      plannedDepartureAt: leg.plannedDepartureAt.toISOString(),
      plannedArrivalAt: leg.plannedArrivalAt.toISOString(),
      actualDepartureAt: leg.actualDepartureAt ? leg.actualDepartureAt.toISOString() : null,
      actualArrivalAt: leg.actualArrivalAt ? leg.actualArrivalAt.toISOString() : null,
      isOverdue: isLegOverdue(leg, now),
    };
  });

  const distances = legs.map(leg => routes.get(leg.id)?.distanceKm ?? null);
  const allKnown = distances.length > 0 && distances.every(d => d !== null);
  const totalKm = allKnown ? roundKm(distances.reduce<number>((sum, d) => sum + (d ?? 0), 0)) : null;
  /** Km từ tỉ lệ `fraction` của chặng `index` tới hết chuyến. */
  const remainingFrom = (index: number, fraction: number) => {
    if (!allKnown) return null;
    let km = (distances[index] ?? 0) * (1 - fraction);
    for (let j = index + 1; j < legs.length; j++) km += distances[j] ?? 0;
    return roundKm(km);
  };

  const latestPosition = toLatestPosition(latest, now);
  const current = legs.findIndex(leg => leg.status === LegStatus.MOVING || leg.status === LegStatus.AT_STOP);
  let position: ITripMapPosition | null = null;
  let remainingKm: number | null = null;

  const coordsOf = (index: number) => routes.get(legs[index].id)?.coordinates ?? null;
  const at = (index: number, point: LngLat, fraction: number, label: string) => {
    position = { source: 'ESTIMATED', lat: point[1], lng: point[0], asOf: new Date(now).toISOString(), legId: legs[index].id, label: `${ESTIMATE}: ${label}` };
    remainingKm = remainingFrom(index, fraction);
  };

  if (legs.length) {
    const currentLine = current >= 0 ? coordsOf(current) : null;
    const gpsUsable = current >= 0 && latestPosition && latestPosition.freshness !== 'OLD'
      && legs[current].vehicleType !== 'AIRCRAFT_HOLD';
    if (gpsUsable && latestPosition) {
      const point: LngLat = [latestPosition.lng, latestPosition.lat];
      position = {
        source: 'GPS', lat: latestPosition.lat, lng: latestPosition.lng, asOf: latestPosition.recordedAt, legId: legs[current].id,
        label: latestPosition.freshness === 'STALE' ? 'Mất tín hiệu GPS hơn 2 phút' : null,
      };
      remainingKm = currentLine ? remainingFrom(current, projectOnLine(currentLine, point).fraction) : null;
    } else if (trip.orderStatus === OrderStatus.DELIVERED || legs.every(leg => leg.status === LegStatus.COMPLETED)) {
      const last = legs.length - 1;
      const line = coordsOf(last);
      if (line) at(last, line[line.length - 1], 1, `đã giao tại ${legs[last].toName}`);
      remainingKm = 0;
    } else if (current >= 0) {
      const leg = legs[current];
      if (currentLine && leg.status === LegStatus.AT_STOP) {
        at(current, currentLine[currentLine.length - 1], 1, `đang ở ${leg.toName}`);
      } else if (currentLine) {
        const started = (leg.actualDepartureAt ?? leg.plannedDepartureAt).getTime();
        const planned = leg.plannedArrivalAt.getTime() - leg.plannedDepartureAt.getTime();
        // Không bao giờ "đến nơi" khi chưa có mốc đến: kẹp [0, 0.95].
        const fraction = planned > 0 ? Math.min(0.95, Math.max(0, (now - started) / planned)) : 0;
        at(current, pointAlong(currentLine, fraction), fraction, `đang trên đường từ ${leg.fromName} đến ${leg.toName}`);
      }
    } else {
      const lastDone = legs.map(leg => leg.status).lastIndexOf(LegStatus.COMPLETED);
      if (lastDone < 0) {
        const line = coordsOf(0);
        if (line) at(0, line[0], 0, `chưa xuất phát, đang ở ${legs[0].fromName}`);
      } else {
        const line = coordsOf(lastDone);
        if (line) at(lastDone, line[line.length - 1], 1, `đang ở ${legs[lastDone].toName}, chờ chặng tiếp`);
      }
    }
  }

  return {
    tripId: trip.id,
    orderCode: trip.orderCode,
    orderStatus: trip.orderStatus,
    stops,
    legs: mapLegs,
    totalKm,
    remainingKm,
    position,
    latestPosition,
    speedLimitKmh,
    warnings,
  };
}
