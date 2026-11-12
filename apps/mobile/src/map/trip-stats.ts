/**
 * Ba số liệu dưới bản đồ tài xế: chặng tiếp, tốc độ, đã chạy. Hàm thuần, cùng quy tắc với
 * LiveStatsCards.tsx và trip-phase.ts của web.
 */
import type { ITripMap } from "../../../../packages/shared/src/types/trackmap.type";
import type { OwnFix } from "./map-scene";

export type StatLeg = {
  id: string;
  seqNo: number;
  status: string;
  toLocationName: string;
  plannedDepartureAt: string;
  plannedArrivalAt: string;
  actualDepartureAt: string | null;
};
export type Stat = { value: string; sub: string; warn: boolean };

/** Số đo GPS trên máy còn được coi là đang có tín hiệu trong khoảng này. */
export const OWN_FIX_FRESH_MS = 30_000;

export function formatDuration(ms: number) {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} phút`;
  return rest ? `${hours} giờ ${String(rest).padStart(2, "0")}` : `${hours} giờ`;
}

export function formatKm(km: number) {
  if (km < 10) return (Math.round(km * 10) / 10).toString().replace(".", ",");
  return Math.round(km)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

type Phase =
  | { kind: "none" | "finished" }
  | { kind: "not_started"; next: StatLeg }
  | { kind: "moving"; leg: StatLeg }
  | { kind: "stopped"; stop: StatLeg; next: StatLeg | null }
  | { kind: "between"; next: StatLeg };

export function tripPhase(input: StatLeg[]): Phase {
  const legs = [...input].sort((a, b) => a.seqNo - b.seqNo);
  if (!legs.length) return { kind: "none" };
  const moving = legs.find((leg) => leg.status === "MOVING");
  if (moving) return { kind: "moving", leg: moving };
  const stop = legs.find((leg) => leg.status === "AT_STOP");
  if (stop)
    return {
      kind: "stopped",
      stop,
      next: legs.find((leg) => leg.seqNo === stop.seqNo + 1) ?? null,
    };
  const next = legs.find((leg) => leg.status !== "COMPLETED");
  if (!next) return { kind: "finished" };
  const prev = legs.find((leg) => leg.seqNo === next.seqNo - 1);
  return prev?.status === "COMPLETED"
    ? { kind: "between", next }
    : { kind: "not_started", next };
}

function kmLeftOnLeg(map: ITripMap, legId: string): number | null {
  if (map.remainingKm === null) return null;
  const index = map.legs.findIndex((item) => item.id === legId);
  if (index < 0) return null;
  let later = 0;
  for (const item of map.legs.slice(index + 1)) {
    if (item.distanceKm === null) return null;
    later += item.distanceKm;
  }
  return Math.max(0, Math.round((map.remainingKm - later) * 10) / 10);
}

const clockOf = (iso: string, now: number) => {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return date.toDateString() === new Date(now).toDateString()
    ? time
    : `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${time}`;
};

function nextStat(
  phase: Phase,
  map: ITripMap | null,
  waypoint: string | null,
  now: number,
): Stat {
  if (waypoint) return { value: waypoint, sub: "điểm nghỉ kế tiếp", warn: false };
  if (phase.kind === "stopped" && !phase.next)
    return { value: phase.stop.toLocationName, sub: "đã tới điểm đích", warn: false };
  const leg =
    phase.kind === "moving"
      ? phase.leg
      : phase.kind === "stopped" || phase.kind === "between" || phase.kind === "not_started"
        ? phase.next
        : null;
  if (!leg) return { value: "—", sub: "—", warn: false };
  const km =
    phase.kind === "moving"
      ? map
        ? kmLeftOnLeg(map, leg.id)
        : null
      : (map?.legs.find((item) => item.id === leg.id)?.distanceKm ?? null);
  const parts = [
    km !== null && km > 0 ? `còn ${formatKm(km)} km` : null,
    clockOf(leg.plannedArrivalAt, now),
  ].filter(Boolean);
  return { value: leg.toLocationName, sub: parts.join(" · "), warn: false };
}

function speedStat(
  phase: Phase,
  map: ITripMap | null,
  ownFix: OwnFix | null,
  now: number,
): Stat {
  const limit = map?.speedLimitKmh ?? null;
  const limitText =
    limit !== null ? `giới hạn ${limit} km/h` : "Chưa cấu hình giới hạn";
  const local =
    ownFix && ownFix.speedKmh !== null && now - Date.parse(ownFix.at) < OWN_FIX_FRESH_MS
      ? ownFix.speedKmh
      : null;
  // Không truyền nghĩa chỉ bằng màu: vượt giới hạn thì chữ cũng nói rõ.
  const speedValue = (kmh: number): Stat => {
    const over = limit !== null && kmh > limit;
    return {
      value: `${Math.round(kmh)} km/h`,
      sub: over ? `vượt giới hạn ${limit} km/h` : limitText,
      warn: over,
    };
  };
  if (local !== null) return speedValue(local);
  const gps = map?.latestPosition ?? null;
  if (!gps) return { value: "—", sub: "Chưa có tín hiệu GPS", warn: false };
  const stopped = phase.kind === "stopped" || phase.kind === "between";
  if (stopped && (gps.speedKmh === null || gps.freshness !== "LIVE"))
    return { value: "0 km/h", sub: "đang dừng", warn: false };
  if (gps.freshness !== "LIVE") {
    const minutes = Math.max(1, Math.round((now - Date.parse(gps.recordedAt)) / 60_000));
    return { value: "—", sub: `GPS cũ ${minutes} phút`, warn: false };
  }
  if (gps.speedKmh === null) return { value: "—", sub: limitText, warn: false };
  return speedValue(gps.speedKmh);
}

/** B4: giờ nghỉ gần nhất và còn điểm nghỉ phía trước; null khi chuyến không theo lộ trình có điểm nghỉ. */
export type RestInfo = { lastRestAt: string | null; restAhead: boolean };
/** Luật: không lái liên tục quá 4 giờ, cũng là mốc nghỉ trễ nhất của lộ trình tự lập. */
export const REST_LIMIT_MS = 4 * 3_600_000;

/**
 * Lần nghỉ của chuyến một chặng theo lộ trình: điểm nghỉ, hoặc phía "tới cửa khẩu" (dừng kiểm tra giấy tờ);
 * phía "đã qua cửa khẩu" không tính. Cùng quy tắc với useWaypointCheckins.tsx của web.
 */
export function restInfoOf(
  map: ITripMap | null,
  legCount: number,
  checkins: { waypointId: string; occurredAt: string }[],
): RestInfo | null {
  if (!map || legCount !== 1 || map.stops.length <= 2) return null;
  const rests = map.stops
    .slice(1, -1)
    .filter(
      (stop) =>
        stop.locationType === "REST_STOP" ||
        (stop.locationType === "BORDER" && !/đã qua cửa khẩu$/.test(stop.name)),
    );
  const at = (id: string) => checkins.find((c) => c.waypointId === id)?.occurredAt ?? null;
  const done = rests.map((stop) => at(stop.locationId)).filter((t): t is string => !!t).sort();
  return { lastRestAt: done.at(-1) ?? null, restAhead: rests.some((stop) => !at(stop.locationId)) };
}

function elapsedStat(phase: Phase, legs: StatLeg[], now: number, rest: RestInfo | null): Stat {
  const first = [...legs].sort((a, b) => a.seqNo - b.seqNo)[0];
  const value = first?.actualDepartureAt
    ? formatDuration(now - Date.parse(first.actualDepartureAt))
    : "—";
  if (phase.kind === "stopped" || phase.kind === "between") {
    const next = phase.next;
    if (!next) return { value, sub: "đang dừng · chờ bàn giao", warn: false };
    const planned = Date.parse(next.plannedDepartureAt);
    return now > planned
      ? { value, sub: `đang dừng · trễ xuất phát ${formatDuration(now - planned)}`, warn: true }
      : { value, sub: `đang dừng · dự kiến xuất phát ${clockOf(next.plannedDepartureAt, now)}`, warn: false };
  }
  const leg =
    phase.kind === "moving" ? phase.leg : phase.kind === "not_started" ? phase.next : null;
  if (!leg) return { value, sub: "—", warn: false };
  if (phase.kind !== "moving") {
    const planned = Date.parse(leg.plannedDepartureAt);
    return now > planned
      ? { value, sub: `trễ xuất phát ${formatDuration(now - planned)}`, warn: true }
      : { value, sub: `dự kiến xuất phát ${clockOf(leg.plannedDepartureAt, now)}`, warn: false };
  }
  // B4: đếm ngược tới lần nghỉ trễ nhất (4 giờ từ lần nghỉ gần nhất hoặc từ lúc xuất phát), không tính theo giờ giao.
  const since = Math.max(
    leg.actualDepartureAt ? Date.parse(leg.actualDepartureAt) : -Infinity,
    rest?.lastRestAt ? Date.parse(rest.lastRestAt) : -Infinity,
  );
  if (Number.isFinite(since)) {
    const driving = now - since;
    if (driving > REST_LIMIT_MS)
      return { value, sub: `lái liên tục ${formatDuration(driving)} · cần nghỉ`, warn: true };
    if (rest?.restAhead)
      return { value, sub: `nghỉ chậm nhất sau ${formatDuration(REST_LIMIT_MS - driving)}`, warn: false };
  }
  const remaining = Date.parse(leg.plannedArrivalAt) - now;
  return remaining >= 0
    ? { value, sub: `tới nơi dự kiến ${clockOf(leg.plannedArrivalAt, now)}`, warn: false }
    : { value, sub: `trễ ${formatDuration(-remaining)} so với giờ đến dự kiến`, warn: true };
}

export function tripStats(input: {
  legs: StatLeg[];
  map: ITripMap | null;
  ownFix: OwnFix | null;
  waypoint?: string | null;
  rest?: RestInfo | null;
  now: number;
}) {
  const phase = tripPhase(input.legs);
  return {
    next: nextStat(phase, input.map, input.waypoint ?? null, input.now),
    speed: speedStat(phase, input.map, input.ownFix, input.now),
    elapsed: elapsedStat(phase, input.legs, input.now, input.rest ?? null),
  };
}
