export type TripPlanStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED';
export type OrderStatus = 'APPROVED' | 'PREPARING' | 'READY';
export type TripLegStatus = 'NOT_STARTED' | 'MOVING' | 'AT_STOP' | 'COMPLETED';
export type TripDetailTab = 'plan' | 'crew';

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
export interface TripPlanOptions { locations: { id:string; name:string; locationType:string; country:string; timezone:string; address:string|null; latitude:number|null; longitude:number|null }[]; vehicles: { id:string; plateOrCode:string; vehicleType:string; capacityStalls:number; isActive:true }[] }
export interface TripPlanLegInput { id?:string; fromLocationId:string; toLocationId:string; vehicleId:string; plannedDepartureAt:string; plannedArrivalAt:string }
export interface TripPlanInput { legs:TripPlanLegInput[] }
export interface CrewOption { id:string; fullName:string }
export interface TripAssignment { id:string; userId:string; fullName:string; role:'DRIVER'|'ESCORT'; assignedBy:string; assignedAt:string }
export interface TripAssignments { tripId:string; items:TripAssignment[]; crewReadiness:{complete:boolean;blockers:{code:string;message:string;userId?:string}[]} }
export interface TripAssignmentsInput { assignments:{userId:string;role:'DRIVER'|'ESCORT'}[] }
