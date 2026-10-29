import {
  LegStatus,
  MilestoneType,
  ILegMilestone,
  ILegTracking,
  IDriverTripSummary,
  IDriverTripDetail,
  ITripHorse,
  CrewRole,
  OrderStatus,
  PlanStatus,
} from '@my-project/shared';

export interface DriverTripRow {
  id: string;
  orderId: string;
  orderCode: string;
  orderStatus: OrderStatus;
  planStatus: PlanStatus;
  plannedDepartureAt: Date | null;
  plannedArrivalAt: Date | null;
  crewRole: CrewRole;
}

export interface LegDetailRow {
  id: string;
  seqNo: number;
  fromLocationId: string;
  fromLocationName: string;
  toLocationId: string;
  toLocationName: string;
  toLocationType: string;
  vehicleId: string | null;
  vehicleCode: string | null;
  plannedDepartureAt: Date;
  plannedArrivalAt: Date;
  status: LegStatus;
  actualDepartureAt: Date | null;
  actualArrivalAt: Date | null;
  updatedAt: Date | null;
  updatedByName: string | null;
}

export interface MilestoneRow {
  id: string;
  legId: string;
  milestoneType: MilestoneType;
  occurredAt: Date;
  recordedBy: string;
  recordedByName: string;
}

/** Response GET /tracking/trips/:id; kiểu dùng chung với web nằm trong packages/shared. */
export type HorseInTrip = ITripHorse;
export type TrackingTripDetail = IDriverTripDetail;

export interface TripCrewRow {
  userId: string;
  name: string;
  phone: string | null;
  role: CrewRole;
}

export interface TripContactsRow {
  customerName: string;
  recipientName: string | null;
  recipientPhone: string | null;
  coordinatorName: string | null;
  coordinatorPhone: string | null;
}

export interface TripVehicleRow {
  id: string;
  code: string;
  type: string;
  capacityStalls: number | string;
}

export interface HorseLogRow {
  id: string;
  horseId: string;
  horseName: string;
  legId: string;
  conditionStatus: import('@my-project/shared').HorseConditionStatus;
  note: string | null;
  loggedAt: Date;
  createdBy: string;
  createdByName: string;
  correctsLogId: string | null;
}

export interface AttachmentRow {
  id: string;
  originalName: string;
  fileType: 'PDF' | 'JPG' | 'PNG';
  sizeBytes: number;
  uploadedAt: Date;
  caption: string | null;
  horseLogId: string | null;
  incidentId: string | null;
}

export interface IncidentRow {
  id: string;
  tripId: string;
  legId: string | null;
  horseId: string | null;
  horseName: string | null;
  incidentType: import('@my-project/shared').IncidentType;
  description: string;
  urgency: import('@my-project/shared').IncidentUrgency;
  severity: import('@my-project/shared').IncidentSeverity | null;
  subType: string | null;
  damageTarget: import('@my-project/shared').DamageTarget | null;
  latitude: number | null;
  longitude: number | null;
  locationText: string | null;
  status: import('@my-project/shared').IncidentStatus;
  reportedBy: string;
  reportedByName: string;
  reportedAt: Date;
  receivedBy: string | null;
  handlingNote: string | null;
  closedAt: Date | null;
}

export interface AlertRow {
  id: string;
  tripId: string;
  alertType: import('@my-project/shared').AlertType;
  content: string;
  sentBy: string;
  sentByName: string;
  sentAt: Date;
}

/** Chặng cho bản đồ: tọa độ hai đầu (DECIMAL → chuỗi hoặc null) và loại xe. */
export interface TripMapLegRow {
  id: string;
  seqNo: number;
  status: LegStatus;
  plannedDepartureAt: Date;
  plannedArrivalAt: Date;
  actualDepartureAt: Date | null;
  actualArrivalAt: Date | null;
  fromId: string;
  fromName: string;
  fromType: string;
  fromLat: string | number | null;
  fromLng: string | number | null;
  toId: string;
  toName: string;
  toType: string;
  toLat: string | number | null;
  toLng: string | number | null;
  vehicleType: string | null;
  routeCoordinates?: [number, number][];
  routeDistanceM?: number;
  routeWaypoints?: { id: string; name: string; type: string; lat: number; lng: number }[];
}

export interface PositionRow {
  legId: string | null;
  latitude: string | number;
  longitude: string | number;
  accuracyM: number | null;
  speedMps: string | number | null;
  headingDeg: number | null;
  recordedAt: Date;
}
