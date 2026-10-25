import { isAxiosError } from 'axios';
import type {
  IDriverTripDetail,
  IDriverTripSummary,
  IHorseLog,
  IIncident,
  IAlert,
  IActiveTrips,
  IOrderTimeline,
  ITripTimeline,
  LegStatus,
  AlertType,
  MilestoneType,
  HorseConditionStatus,
  IncidentType,
  ITripMap,
  ITripPositionBatchResult,
  ITripPositionInput,
  ITripTrackPoint,
} from '@my-project/shared';
import { api } from '../../lib/axios';

export type MilestoneResult = { milestoneId: string; legId: string; milestoneType: MilestoneType; legStatus: string; orderStatus: string };

export const trackingApi = {
  driverTrips: () => api.get<IDriverTripSummary[]>('/tracking/driver/trips').then(r => r.data),
  tripDetail: (tripId: string) => api.get<IDriverTripDetail>(`/tracking/trips/${tripId}`).then(r => r.data),
  // Bản đồ + GPS (H1). Giới hạn theo tài khoản: /map và vệt đường 60/phút, gửi vị trí 30/phút.
  tripMap: (tripId: string) => api.get<ITripMap>(`/tracking/trips/${tripId}/map`).then(r => r.data),
  trackPoints: (tripId: string, since?: string) =>
    api.get<ITripTrackPoint[]>(`/tracking/trips/${tripId}/positions`, { params: since ? { since } : undefined }).then(r => r.data),
  postPositions: (tripId: string, points: ITripPositionInput[]) =>
    api.post<ITripPositionBatchResult>(`/tracking/trips/${tripId}/positions`, { points }).then(r => r.data),
  recordMilestone: (legId: string, milestoneType: MilestoneType, occurredAt: string) =>
    api.post<MilestoneResult>(`/tracking/legs/${legId}/milestones`, { milestoneType, occurredAt }).then(r => r.data),
  completeLeg: (legId: string, occurredAt: string) =>
    api.post(`/tracking/legs/${legId}/complete`, { occurredAt }).then(r => r.data),
  horseLogs: (tripId: string) => api.get<IHorseLog[]>(`/tracking/trips/${tripId}/horse-logs`).then(r => r.data),
  createHorseLog: (legId: string, form: FormData) => api.post<IHorseLog>(`/tracking/legs/${legId}/horse-logs`, form).then(r => r.data),
  incidents: (tripId: string) => api.get<IIncident[]>(`/tracking/trips/${tripId}/incidents`).then(r => r.data),
  createIncident: (tripId: string, form: FormData) => api.post<IIncident>(`/tracking/trips/${tripId}/incidents`, form).then(r => r.data),
  alerts: (tripId: string) => api.get<IAlert[]>(`/tracking/trips/${tripId}/alerts`).then(r => r.data),
  activeTrips: () => api.get<IActiveTrips>('/tracking/operations/active-trips').then(r => r.data),
  tripTimeline: (tripId: string) => api.get<ITripTimeline>(`/tracking/trips/${tripId}/timeline`).then(r => r.data),
  orderTimeline: (orderId: string) => api.get<IOrderTimeline>(`/tracking/orders/${orderId}/timeline`).then(r => r.data),
  correctLeg: (legId: string, body: { status: LegStatus; reason: string; occurredAt?: string }) =>
    api.patch<{ legId: string; status: string; orderStatus: string }>(`/tracking/legs/${legId}/correct`, body).then(r => r.data),
  updateIncident: (incidentId: string, body: { status: 'ACKNOWLEDGED' | 'CLOSED'; handlingNote?: string }) =>
    api.patch<IIncident>(`/tracking/incidents/${incidentId}`, body).then(r => r.data),
  createAlert: (tripId: string, body: { alertType: AlertType; content: string }) =>
    api.post<IAlert>(`/tracking/trips/${tripId}/alerts`, body).then(r => r.data),
  customerOrders: () =>
    api.get<{ items: { id: string; order_code: string; status: string; origin_country: string | null; destination_country: string | null }[] }>(
      '/orders', { params: { group: 'approved', limit: 100 } }).then(r => r.data.items),
  attachmentBlob: (id: string) => api.get<Blob>(`/tracking/attachments/${id}`, { responseType: 'blob' }).then(r => r.data),
};

/** Lỗi mạng (không có phản hồi từ server): dữ liệu chưa tới server, có thể gửi lại an toàn. */
export function isNetworkError(error: unknown) {
  return isAxiosError(error) && !error.response;
}

export function errorMessage(error: unknown, fallback = 'Không thực hiện được. Vui lòng thử lại.') {
  if (isAxiosError(error)) {
    if (!error.response) return 'Mất kết nối mạng. Dữ liệu của bạn vẫn được giữ, hãy thử gửi lại khi có mạng.';
    const data = error.response.data as { message?: string | string[]; fields?: Record<string, string> } | undefined;
    const fields = data?.fields ? Object.values(data.fields).join(' ') : '';
    const message = Array.isArray(data?.message) ? data?.message.join(' ') : data?.message;
    if (error.response.status === 429) return 'Bạn thao tác quá nhanh. Dữ liệu vẫn được giữ, hãy đợi vài giây rồi thử lại.';
    if (error.response.status === 403) return message || 'Bạn không có quyền thực hiện thao tác này.';
    return [message, fields].filter(Boolean).join(' ') || fallback;
  }
  return fallback;
}

export const CONDITIONS: { value: HorseConditionStatus; label: string; hint: string }[] = [
  { value: 'STABLE' as HorseConditionStatus, label: 'Ổn định', hint: 'Bình thường' },
  { value: 'OFF_FEED' as HorseConditionStatus, label: 'Bỏ ăn', hint: 'Không ăn/uống' },
  { value: 'STRESSED' as HorseConditionStatus, label: 'Căng thẳng', hint: 'Bồn chồn, vã mồ hôi' },
  { value: 'CLIMATE_CHANGE' as HorseConditionStatus, label: 'Thời tiết', hint: 'Ảnh hưởng nhiệt độ/khí hậu' },
];

export const INCIDENT_TYPES: { value: IncidentType; label: string }[] = [
  { value: 'VEHICLE_BREAKDOWN' as IncidentType, label: 'Hỏng xe' },
  { value: 'LONG_TRAFFIC_JAM' as IncidentType, label: 'Tắc đường' },
  { value: 'HORSE_MEDICAL' as IncidentType, label: 'Y tế ngựa' },
];

export const ALERT_TYPES: { value: AlertType; label: string }[] = [
  { value: 'WEATHER' as AlertType, label: 'Thời tiết' },
  { value: 'TRAFFIC' as AlertType, label: 'Giao thông' },
  { value: 'BORDER' as AlertType, label: 'Cửa khẩu' },
];
