export interface TripSummary {
  id: string; orderId: string; orderCode: string;
  planStatus: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED'; plannedBy: string;
  plannedDepartureAt: string | null; plannedArrivalAt: string | null;
}
export interface TripLeg {
  id: string; seqNo: number; fromLocationId: string; fromLocationName: string;
  toLocationId: string; toLocationName: string; vehicleId: string | null;
  vehicleCode: string | null; vehicleActive: boolean | null;
  plannedDepartureAt: string; plannedArrivalAt: string;
  status: 'NOT_STARTED' | 'MOVING' | 'AT_STOP' | 'COMPLETED';
}
export interface TripDetail extends TripSummary {
  orderStatus: string; approvedBy: string | null; approvedAt: string | null;
  returnReason: string | null; legs: TripLeg[];
}
export interface TripList { items: TripSummary[]; total: number; page: number; limit: number }
export interface TripPlanOptions {
  locations: { id: string; name: string; locationType: 'BORDER' | 'QUARANTINE_STATION' | 'REST_STOP' | 'AIRPORT' | 'FUEL_STOP'; country: string; timezone: string; address: string | null }[];
  vehicles: { id: string; plateOrCode: string; vehicleType: 'TRUCK' | 'AIRCRAFT_HOLD' | 'CRATE'; capacityStalls: number; isActive: true }[];
}
