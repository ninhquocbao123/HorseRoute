/**
 * Enums for Flow 4 — Tracking & Journey Logging.
 * Values are sourced directly from schema.sql ENUM definitions.
 */

/** legs.status */
export enum LegStatus {
  NOT_STARTED = 'NOT_STARTED',
  MOVING      = 'MOVING',
  AT_STOP     = 'AT_STOP',
  COMPLETED   = 'COMPLETED',
}

/** leg_milestones.milestone_type */
export enum MilestoneType {
  DEPARTED          = 'DEPARTED',
  ARRIVED_AT_STOP   = 'ARRIVED_AT_STOP',
  CUSTOMS_CLEARED   = 'CUSTOMS_CLEARED',
  DELIVERED         = 'DELIVERED',
}

/** horse_logs.condition_status */
export enum HorseConditionStatus {
  STABLE         = 'STABLE',
  OFF_FEED       = 'OFF_FEED',
  STRESSED       = 'STRESSED',
  CLIMATE_CHANGE = 'CLIMATE_CHANGE',
}

/** incidents.incident_type */
export enum IncidentType {
  VEHICLE_BREAKDOWN = 'VEHICLE_BREAKDOWN',
  LONG_TRAFFIC_JAM  = 'LONG_TRAFFIC_JAM',
  HORSE_MEDICAL     = 'HORSE_MEDICAL',
}

/** incidents.urgency */
export enum IncidentUrgency {
  NORMAL = 'NORMAL',
  HIGH   = 'HIGH',
}

/** incidents.status */
export enum IncidentStatus {
  NEW          = 'NEW',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  CLOSED       = 'CLOSED',
}

/** alerts.alert_type */
export enum AlertType {
  TRAFFIC = 'TRAFFIC',
  WEATHER = 'WEATHER',
  BORDER  = 'BORDER',
}
