export type TripPlanStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED';
export type OrderStatus = 'APPROVED' | 'PREPARING' | 'READY';
export type TripLegStatus = 'NOT_STARTED' | 'MOVING' | 'AT_STOP' | 'COMPLETED';
export type TripDetailTab = 'plan' | 'crew' | 'readiness';

export interface TripSummary {
  id: string;
  orderId: string;
  orderCode: string;
  planStatus: TripPlanStatus;
  plannedBy: string;
  plannedDepartureAt: string | null;
  plannedArrivalAt: string | null;
}

export interface TripLeg {
  id: string;
  seqNo: number;
  fromLocationId: string;
  fromLocationName: string;
  toLocationId: string;
  toLocationName: string;
  vehicleId: string | null;
  vehicleCode: string | null;
  vehicleActive: boolean | null;
  plannedDepartureAt: string;
  plannedArrivalAt: string;
  status: TripLegStatus;
}

export interface TripDetail extends TripSummary {
  orderStatus: string;
  approvedBy: string | null;
  approvedAt: string | null;
  returnReason: string | null;
  legs: TripLeg[];
}

export interface TripListParams { page: number; limit: number }
export interface TripListResponse extends TripListParams {
  items: TripSummary[];
  total: number;
}
