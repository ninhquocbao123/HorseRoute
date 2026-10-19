import {
  LegStatus,
  MilestoneType,
  ILegMilestone,
  ILegTracking,
  IDriverTripSummary,
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

export interface HorseInTrip {
  id: string;
  name: string;
  passportNo: string;
  orderStatus: string;
}

export interface TrackingTripDetail {
  id: string;
  orderId: string;
  orderCode: string;
  orderStatus: OrderStatus;
  planStatus: PlanStatus;
  plannedDepartureAt: string | null;
  plannedArrivalAt: string | null;
  crewRole?: CrewRole;
  horses: HorseInTrip[];
  legs: ILegTracking[];
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

