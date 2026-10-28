import { api } from '../../lib/axios';

export type VehicleType = 'LIGHT' | 'MEDIUM' | 'HEAVY';
export type VehicleStatus = 'AVAILABLE' | 'RESERVED' | 'IN_TRANSIT';
export type Vehicle = {
  id: string;
  plateOrCode: string;
  vehicleType: VehicleType;
  capacityStalls: number;
  status: VehicleStatus;
  /** Số chặng đã tham chiếu xe: > 0 thì không xóa được. */
  legCount: number;
  /** Xe nằm trong kế hoạch đã duyệt của đơn chưa kết thúc. */
  inActiveUse: boolean;
};
export type VehicleList = { items: Vehicle[]; total: number; page: number; limit: number };
export type VehicleStatusFilter = 'all' | VehicleStatus;
export type VehicleInput = { plateOrCode: string; vehicleType: VehicleType; capacityStalls: number };
export type VehicleUpdateInput = VehicleInput & { status: VehicleStatus };

export const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: 'LIGHT', label: 'Xe nhẹ' },
  { value: 'MEDIUM', label: 'Xe trung' },
  { value: 'HEAVY', label: 'Xe nặng' },
];
export const vehicleTypeLabel = (type: VehicleType) => VEHICLE_TYPES.find(t => t.value === type)?.label ?? type;

export const fleetApi = {
  list: (params: { page: number; limit: number; status: VehicleStatusFilter; q?: string }, signal?: AbortSignal) =>
    api.get<VehicleList>('/vehicles', { params: { ...params, q: params.q || undefined }, signal }).then(r => r.data),
  create: (input: VehicleInput) => api.post<Vehicle>('/vehicles', input).then(r => r.data),
  update: (id: string, input: VehicleUpdateInput) => api.put<Vehicle>(`/vehicles/${encodeURIComponent(id)}`, input).then(r => r.data),
  remove: (id: string) => api.delete(`/vehicles/${encodeURIComponent(id)}`).then(() => undefined),
};
