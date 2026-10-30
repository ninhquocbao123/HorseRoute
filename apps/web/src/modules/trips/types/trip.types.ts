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
  vehicleStatus: 'AVAILABLE' | 'RESERVED' | 'IN_TRANSIT' | null;
  plannedDepartureAt: string;
  plannedArrivalAt: string;
  status: TripLegStatus;
}

export interface TripDetail extends TripSummary {
  orderStatus: string;
  approvedBy: string | null;
  approvedAt: string | null;
  returnReason: string | null;
  originAddress: string;
  destinationAddress: string;
  routePlan: import('../../coordinator/maps/TripRoutePlanner').RoutePlan | null;
  routePlanRevision: number;
  legs: TripLeg[];
}

export interface TripListParams { page: number; limit: number }
export interface TripListItem extends TripSummary {
  tripId: string;
  orderStatus: string;
  desiredDepartureDate: string | null;
  requestedPickupTime: string | null;
  horseCount: number;
}
export interface TripListResponse extends TripListParams {
  items: TripListItem[];
  total: number;
}
export interface TripPlanOptions { requiredHorseCount:number; locations: { id:string; name:string; locationType:string; country:string; timezone:string; address:string|null; latitude:number|null; longitude:number|null }[]; vehicles: { id:string; plateOrCode:string; vehicleType:'LIGHT'|'MEDIUM'|'HEAVY'; capacityStalls:number; status:'AVAILABLE'|'RESERVED'|'IN_TRANSIT'; currentTrips?:{tripId:string;orderCode:string}[]; selectable:boolean }[] }
export interface TripPlanLegInput { id?:string; fromLocationId:string; toLocationId:string; vehicleId?:string; plannedDepartureAt:string; plannedArrivalAt:string }
export interface TripPlanInput { legs:TripPlanLegInput[] }
export interface TripScheduleInput { plannedDepartureAt:string; plannedArrivalAt:string; routePlanRevision:number }
export interface CrewOption { id:string; fullName:string; crewType:'DRIVER'|'ESCORT'|null; workStatus:'AVAILABLE'|'RESERVED'|'IN_TRIP'|null; selectable:boolean }
export interface TripAssignment { tripVehicleId?:string|null; id:string; userId:string; fullName:string; role:'DRIVER'|'ESCORT'; assignedBy:string; assignedAt:string; crewType:'DRIVER'|'ESCORT'|null; workStatus:'AVAILABLE'|'RESERVED'|'IN_TRIP'|null }
export interface TripAssignments { vehicles?: {id:string;vehicleId:string;plateNumber:string;capacityStalls:number;horseCount:number|null;crew:TripAssignment[]}[]; tripId:string; items:TripAssignment[]; crewReadiness:{complete:boolean;blockers:{code:string;message:string;userId?:string}[]} }
export interface TripAssignmentsInput { vehicles:{vehicleId:string;horseCount:number;crew:{userId:string;role:'DRIVER'|'ESCORT'}[]}[] }
