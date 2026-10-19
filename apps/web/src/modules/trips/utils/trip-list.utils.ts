import type { TripListParams } from '../types/trip.types';

export function readTripListParams(params: URLSearchParams): TripListParams {
  const positiveInteger = (value: string | null, fallback: number) => {
    if (!value || !/^\d+$/.test(value)) return fallback;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
  };
  const requestedLimit = positiveInteger(params.get('limit'), 20);
  const limit = requestedLimit <= 100 ? requestedLimit : 20;
  const requestedPage = positiveInteger(params.get('page'), 1);
  const page = Number.isSafeInteger((requestedPage - 1) * limit) ? requestedPage : 1;
  return { page, limit };
}

export function tripListSearch({ page, limit }: TripListParams) {
  return `?${new URLSearchParams({ page: String(page), limit: String(limit) })}`;
}

const tripDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
export function formatTripDate(value: string | null) {
  if (!value) return 'Chưa có kế hoạch';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Thời gian không hợp lệ' : tripDateFormatter.format(date);
}
