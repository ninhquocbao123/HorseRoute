// Một nguồn sự thật cho "xe đang ở giai đoạn nào" của chuyến (D1b): timeline, thẻ "Chặng tiếp", thẻ "Đã chạy", nút Check-in và
// đoạn đã đi trên bản đồ đều suy ra từ đây để không lệch nhau. Hàm thuần, kiểm thử bằng test/trip-phase.cjs.
import type { ILegTracking, ITripMap } from '@my-project/shared';
import { formatDayTime, formatDuration } from './driver-ui';

/**
 * - not_started: chưa chặng nào chạy (chuyến READY).
 * - moving: một chặng đang chạy (MOVING) tới `leg.toLocation`.
 * - stopped: chặng `stop` ở AT_STOP: xe đang DỪNG tại `stop.toLocation`; `next` là chặng kế (null nếu đã tới điểm đích).
 * - between: chặng `prev` đã COMPLETED, chặng `next` chưa xuất phát: xe vẫn đang dừng tại `prev.toLocation`.
 * - finished: mọi chặng đã hoàn thành.
 */
export type TripPhase =
  | { kind: 'none' }
  | { kind: 'not_started'; next: ILegTracking }
  | { kind: 'moving'; leg: ILegTracking }
  | { kind: 'stopped'; stop: ILegTracking; next: ILegTracking | null }
  | { kind: 'between'; prev: ILegTracking | null; next: ILegTracking }
  | { kind: 'finished' };

export function tripPhase(input: ILegTracking[]): TripPhase {
  const legs = [...input].sort((a, b) => a.seqNo - b.seqNo);
  if (!legs.length) return { kind: 'none' };
  const moving = legs.find(leg => leg.status === 'MOVING');
  if (moving) return { kind: 'moving', leg: moving };
  const stop = legs.find(leg => leg.status === 'AT_STOP');
  if (stop) return { kind: 'stopped', stop, next: legs.find(leg => leg.seqNo === stop.seqNo + 1) ?? null };
  const next = legs.find(leg => leg.status !== 'COMPLETED');
  if (!next) return { kind: 'finished' };
  const prev = legs.find(leg => leg.seqNo === next.seqNo - 1) ?? null;
  return prev && prev.status === 'COMPLETED' ? { kind: 'between', prev, next } : { kind: 'not_started', next };
}

/** Xe đang dừng (chờ thao tác) hay đang lăn bánh. */
export const isStopped = (phase: TripPhase) => phase.kind === 'stopped' || phase.kind === 'between';

/** Chặng mà xe sắp/đang đi tới điểm đến của nó (điểm "kế tiếp"); null khi đã tới điểm đích hoặc đã xong. */
export function headingLeg(phase: TripPhase): ILegTracking | null {
  switch (phase.kind) {
    case 'moving': return phase.leg;
    case 'stopped': return phase.next;
    case 'between': case 'not_started': return phase.next;
    default: return null;
  }
}

/** Tên điểm xe đang dừng (null khi đang chạy / chưa xuất phát). */
export function stoppedAtName(phase: TripPhase): string | null {
  if (phase.kind === 'stopped') return phase.stop.toLocationName;
  if (phase.kind === 'between') return phase.prev?.toLocationName ?? null;
  return null;
}

/** Km còn lại của chặng `legId` = km còn lại cả chuyến − tổng km các chặng sau; null khi thiếu số liệu. */
export function kmLeftOnLeg(map: ITripMap, legId: string): number | null {
  if (map.remainingKm === null) return null;
  const index = map.legs.findIndex(item => item.id === legId);
  if (index < 0) return null;
  let later = 0;
  for (const item of map.legs.slice(index + 1)) {
    if (item.distanceKm === null) return null;
    later += item.distanceKm;
  }
  return Math.max(0, Math.round((map.remainingKm - later) * 10) / 10);
}

/**
 * Thẻ "Chặng tiếp": luôn là điểm KẾ TIẾP, không bao giờ là điểm đã tới.
 * Đang chạy: km còn lại tới điểm đến của chặng. Đang dừng: cả chặng kế (xe đứng ở điểm xuất phát của nó).
 * Đã tới điểm đích (chờ bàn giao): không có "còn km".
 */
export function nextStopView(phase: TripPhase, map: ITripMap | null): { name: string; km: number | null; arrivalAt: string | null; arrived: boolean } | null {
  const leg = headingLeg(phase);
  if (leg) {
    const mapLeg = map?.legs.find(item => item.id === leg.id);
    const km = phase.kind === 'moving' ? (map ? kmLeftOnLeg(map, leg.id) : null) : mapLeg?.distanceKm ?? null;
    return { name: leg.toLocationName, km, arrivalAt: leg.plannedArrivalAt, arrived: false };
  }
  if (phase.kind === 'stopped') return { name: phase.stop.toLocationName, km: null, arrivalAt: null, arrived: true };
  return null;
}

/** Dòng phụ thẻ "Đã chạy". Đang dừng: giờ xuất phát dự kiến của chặng kế, trễ thì "trễ xuất phát". */
export function elapsedSub(phase: TripPhase, now: number): { text: string; warn: boolean } {
  if (phase.kind === 'stopped' || phase.kind === 'between') {
    const next = phase.next;
    if (!next) return { text: 'đang dừng · chờ bàn giao', warn: false };
    const planned = Date.parse(next.plannedDepartureAt);
    if (now > planned) return { text: `đang dừng · trễ xuất phát ${formatDuration(now - planned)}`, warn: true };
    return { text: `đang dừng · dự kiến xuất phát ${formatClock(next.plannedDepartureAt, now)}`, warn: false };
  }
  const leg = headingLeg(phase);
  if (!leg) return { text: '—', warn: false };
  const remaining = Date.parse(leg.plannedArrivalAt) - now;
  return remaining >= 0 ? { text: `nghỉ tiếp sau ${formatDuration(remaining)}`, warn: false } : { text: `trễ ${formatDuration(-remaining)}`, warn: true };
}

/** "HH:mm" nếu cùng ngày với `now`, ngược lại "dd/MM HH:mm". */
export function formatClock(iso: string, now: number) {
  const date = new Date(iso);
  const today = new Date(now);
  const text = formatDayTime(date);
  return date.toDateString() === today.toDateString() ? text.slice(-5) : text;
}
