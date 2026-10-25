import { api } from '../../lib/axios';

export type LocationType = 'BORDER' | 'QUARANTINE_STATION' | 'REST_STOP' | 'AIRPORT' | 'FUEL_STOP';
export type CatalogLocation = {
  id: string;
  name: string;
  locationType: LocationType;
  country: string;
  timezone: string;
  address: string | null;
  /** WGS84; null khi địa điểm cũ chưa được ghim. */
  latitude: number | null;
  longitude: number | null;
  /** Số chặng đi từ/đến địa điểm: > 0 thì không xóa được. */
  legCount: number;
  /** Số quy định kiểm dịch dùng địa điểm làm cửa khẩu: > 0 thì không xóa được, không đổi loại được. */
  ruleCount: number;
  /** Nằm trong kế hoạch đã duyệt của đơn chưa giao xong: không đổi loại được. */
  inActiveUse: boolean;
};
export type LocationList = { items: CatalogLocation[]; total: number; page: number; limit: number };
export type CoordinatesFilter = 'all' | 'missing' | 'present';
export type LocationQuery = { page: number; limit: number; locationType?: LocationType; country?: string; coordinates: CoordinatesFilter; q?: string };
export type LocationInput = {
  name: string; locationType: LocationType; country: string; timezone: string; address: string | null; latitude: number; longitude: number;
};

export const LOCATION_TYPES: { value: LocationType; label: string; color: string }[] = [
  { value: 'BORDER', label: 'Cửa khẩu', color: 'gold' },
  { value: 'QUARANTINE_STATION', label: 'Trạm kiểm dịch', color: 'volcano' },
  { value: 'AIRPORT', label: 'Sân bay', color: 'blue' },
  { value: 'REST_STOP', label: 'Điểm dừng nghỉ', color: 'green' },
  { value: 'FUEL_STOP', label: 'Trạm nhiên liệu', color: 'default' },
];
export const locationTypeInfo = (type: LocationType) => LOCATION_TYPES.find(t => t.value === type) ?? { value: type, label: type, color: 'default' };

export const locationsApi = {
  list: (query: LocationQuery, signal?: AbortSignal) =>
    api.get<LocationList>('/locations', { params: { ...query, q: query.q || undefined }, signal }).then(r => r.data),
  create: (input: LocationInput) => api.post<CatalogLocation>('/locations', input).then(r => r.data),
  update: (id: string, input: LocationInput) => api.put<CatalogLocation>(`/locations/${encodeURIComponent(id)}`, input).then(r => r.data),
  remove: (id: string) => api.delete(`/locations/${encodeURIComponent(id)}`).then(() => undefined),
};
