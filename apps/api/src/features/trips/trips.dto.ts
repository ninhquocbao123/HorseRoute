export interface TripSummary {
  id: string; orderId: string; orderCode: string;
  planStatus: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED'; plannedBy: string;
  plannedDepartureAt: string | null; plannedArrivalAt: string | null;
}
export interface TripLeg {
  id: string; seqNo: number; fromLocationId: string; fromLocationName: string;
  toLocationId: string; toLocationName: string; vehicleId: string | null;
  vehicleCode: string | null; vehicleStatus: 'AVAILABLE' | 'RESERVED' | 'IN_TRANSIT' | null;
  plannedDepartureAt: string; plannedArrivalAt: string;
  status: 'NOT_STARTED' | 'MOVING' | 'AT_STOP' | 'COMPLETED';
}
export interface TripDetail extends TripSummary {
  orderStatus: string; approvedBy: string | null; approvedAt: string | null;
  returnReason: string | null; legs: TripLeg[];
}
export interface TripListItem extends TripSummary {
  tripId: string; orderStatus: string; desiredDepartureDate: string | null;
  requestedPickupTime: string | null; horseCount: number;
}
export interface TripList { items: TripListItem[]; total: number; page: number; limit: number }
export interface TripPlanOptions {
  locations: { id: string; name: string; locationType: 'BORDER' | 'QUARANTINE_STATION' | 'REST_STOP' | 'AIRPORT' | 'FUEL_STOP'; country: string; timezone: string; address: string | null; latitude: number | null; longitude: number | null }[];
  vehicles: { id: string; plateOrCode: string; vehicleType: 'LIGHT' | 'MEDIUM' | 'HEAVY'; capacityStalls: number;
    status: 'AVAILABLE' | 'RESERVED' | 'IN_TRANSIT'; selectable: boolean | null; scheduleEvaluation: 'NOT_EVALUATED';
    blockingReasons: { code: string; message: string }[] }[];
}

export interface CrewOption { id: string; fullName: string; crewType: 'DRIVER' | 'ESCORT' | null;
  workStatus: 'AVAILABLE' | 'IN_TRIP' | null; selectable: boolean | null; scheduleEvaluation: 'NOT_EVALUATED'; blockingReasons: { code: string; message: string }[] }
export interface TripAssignment {
  id: string; userId: string; fullName: string; role: 'DRIVER' | 'ESCORT';
  assignedBy: string; assignedAt: string; crewType: 'DRIVER' | 'ESCORT' | null; workStatus: 'AVAILABLE' | 'IN_TRIP' | null;
}
export interface CrewReadiness {
  complete: boolean;
  blockers: { code: 'MISSING_DRIVER' | 'MISSING_ESCORT' | 'INELIGIBLE_CREW' | 'MISSING_CREW_PROFILE' | 'CREW_TYPE_MISMATCH' | 'CREW_UNAVAILABLE'; message: string; userId?: string }[];
}
export interface TripAssignments {
  tripId: string; items: TripAssignment[]; crewReadiness: CrewReadiness;
}
