import type { ILegTracking } from '@my-project/shared';

export const LEG_STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: 'Chưa bắt đầu',
  MOVING: 'Đang di chuyển',
  AT_STOP: 'Đã đến điểm dừng',
  COMPLETED: 'Hoàn thành',
};

export const MILESTONE_LABEL: Record<string, string> = {
  DEPARTED: 'Xuất phát',
  ARRIVED_AT_STOP: 'Đã đến điểm dừng',
  CUSTOMS_CLEARED: 'Đã thông quan',
  DELIVERED: 'Đã giao ngựa',
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  READY: 'Sẵn sàng',
  IN_TRANSIT: 'Đang vận chuyển',
  DELIVERED: 'Đã giao',
};

export const CONDITION_LABEL: Record<string, string> = {
  STABLE: 'Ổn định',
  OFF_FEED: 'Bỏ ăn',
  STRESSED: 'Căng thẳng',
  CLIMATE_CHANGE: 'Thời tiết',
};

export const INCIDENT_STATUS_LABEL: Record<string, string> = { NEW: 'Mới', ACKNOWLEDGED: 'Đã tiếp nhận', CLOSED: 'Đã đóng' };

const dateTime = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

export function formatDateTime(value: string | null | undefined) {
  return value ? dateTime.format(new Date(value)) : '—';
}

/** Giá trị cho <input type="datetime-local"> theo giờ địa phương của thiết bị. */
export function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalInput(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export type NextAction =
  | { kind: 'milestone'; milestone: 'DEPARTED' | 'ARRIVED_AT_STOP' | 'CUSTOMS_CLEARED' | 'DELIVERED'; label: string; hint: string }
  | { kind: 'complete'; label: string; hint: string };

/** Chặng đang cần thao tác: chặng đang chạy, nếu không thì chặng đầu tiên chưa hoàn thành. */
export function currentLeg(legs: ILegTracking[]) {
  return legs.find(l => l.status === 'MOVING' || l.status === 'AT_STOP') ?? legs.find(l => l.status !== 'COMPLETED') ?? null;
}

/**
 * Một nút hành động duy nhất cho chặng hiện tại (NFR-USE-01).
 * Quy tắc khớp backend: chặng cuối hoàn tất bằng DELIVERED, chặng trung gian bằng "hoàn thành chặng";
 * điểm đến là cửa khẩu cần CUSTOMS_CLEARED trước.
 */
export function nextAction(leg: ILegTracking, legs: ILegTracking[], orderStatus: string): NextAction | null {
  const isLast = leg.seqNo === legs.length;
  const has = (type: string) => leg.milestones.some(m => m.milestoneType === type);
  if (leg.status === 'NOT_STARTED') {
    const previous = legs.find(l => l.seqNo === leg.seqNo - 1);
    if (previous && previous.status !== 'COMPLETED') return null;
    if (leg.seqNo === 1 && orderStatus !== 'READY') return null;
    return { kind: 'milestone', milestone: 'DEPARTED', label: 'XÁC NHẬN XUẤT PHÁT', hint: 'Ghi mốc xuất phát của chặng này.' };
  }
  if (leg.status === 'MOVING') {
    return { kind: 'milestone', milestone: 'ARRIVED_AT_STOP', label: isLast ? 'ĐÃ ĐẾN ĐIỂM ĐÍCH' : 'ĐÃ ĐẾN TRẠM DỪNG', hint: 'Ghi mốc đã đến điểm dừng của chặng.' };
  }
  if (leg.status === 'AT_STOP') {
    if (leg.toLocationType === 'BORDER' && !has('CUSTOMS_CLEARED')) {
      return { kind: 'milestone', milestone: 'CUSTOMS_CLEARED', label: 'ĐÃ THÔNG QUAN', hint: 'Cửa khẩu: ghi mốc đã thông quan.' };
    }
    return isLast
      ? { kind: 'milestone', milestone: 'DELIVERED', label: 'ĐÃ GIAO NGỰA AN TOÀN', hint: 'Hoàn tất bàn giao tại điểm đích.' }
      : { kind: 'complete', label: 'HOÀN THÀNH CHẶNG', hint: 'Hoàn tất chặng để chuyển sang chặng kế tiếp.' };
  }
  return null;
}

export const ALERT_LABEL: Record<string, string> = { TRAFFIC: 'Giao thông', WEATHER: 'Thời tiết', BORDER: 'Cửa khẩu' };
export const URGENCY_LABEL: Record<string, string> = { NORMAL: 'Bình thường', HIGH: 'KHẨN CẤP' };
export const INCIDENT_TYPE_LABEL: Record<string, string> = { VEHICLE_BREAKDOWN: 'Hỏng xe', LONG_TRAFFIC_JAM: 'Tắc đường', HORSE_MEDICAL: 'Y tế ngựa' };
