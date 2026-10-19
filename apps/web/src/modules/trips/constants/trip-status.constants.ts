import type { TripDetailTab, TripLegStatus, TripPlanStatus } from '../types/trip.types';

export const tripPlanStatusLabels: Record<TripPlanStatus, string> = {
  DRAFT: 'Bản nháp',
  PENDING_APPROVAL: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
};

export const orderStatusLabels: Record<string, string> = {
  APPROVED: 'Đơn đã duyệt',
  PREPARING: 'Đang chuẩn bị',
  READY: 'Sẵn sàng vận chuyển',
};

export const legStatusLabels: Record<TripLegStatus, string> = {
  NOT_STARTED: 'Chưa bắt đầu',
  MOVING: 'Đang di chuyển',
  AT_STOP: 'Tại điểm dừng',
  COMPLETED: 'Hoàn thành',
};

export const tripDetailTabs: { id: TripDetailTab; label: string }[] = [
  { id: 'plan', label: 'Kế hoạch' },
  { id: 'crew', label: 'Nhân sự' },
  { id: 'readiness', label: 'Điều kiện READY' },
];

export const VALID_DETAIL_TABS: ReadonlySet<string> = new Set<TripDetailTab>(['plan', 'crew', 'readiness']);
