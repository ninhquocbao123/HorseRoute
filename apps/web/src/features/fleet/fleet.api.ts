import { api } from '../../lib/axios';

export type VehicleType = 'TRUCK' | 'AIRCRAFT_HOLD' | 'CRATE';
export type Vehicle = {
  id: string;
  plateOrCode: string;
  vehicleType: VehicleType;
  capacityStalls: number;
  isActive: boolean;
  /** Số chặng đã tham chiếu xe: > 0 thì không xóa được. */
  legCount: number;
  /** Xe nằm trong kế hoạch đã duyệt của đơn chưa kết thúc. */
  inActiveUse: boolean;
};
export type VehicleList = { items: Vehicle[]; total: number; page: number; limit: number };
export type VehicleStatusFilter = 'all' | 'active' | 'inactive';
export type VehicleInput = { plateOrCode: string; vehicleType: VehicleType; capacityStalls: number };
export type VehicleUpdateInput = VehicleInput & { isActive: boolean };

export const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: 'TRUCK', label: 'Xe tải' },
  { value: 'AIRCRAFT_HOLD', label: 'Khoang máy bay' },
  { value: 'CRATE', label: 'Thùng / chuồng vận chuyển' },
];
export const vehicleTypeLabel = (type: VehicleType) => VEHICLE_TYPES.find(t => t.value === type)?.label ?? type;

export const fleetApi = {
  list: (params: { page: number; limit: number; status: VehicleStatusFilter; q?: string }, signal?: AbortSignal) =>
    api.get<VehicleList>('/vehicles', { params: { ...params, q: params.q || undefined }, signal }).then(r => r.data),
  create: (input: VehicleInput) => api.post<Vehicle>('/vehicles', input).then(r => r.data),
  update: (id: string, input: VehicleUpdateInput) => api.put<Vehicle>(`/vehicles/${encodeURIComponent(id)}`, input).then(r => r.data),
  remove: (id: string) => api.delete(`/vehicles/${encodeURIComponent(id)}`).then(() => undefined),
};
