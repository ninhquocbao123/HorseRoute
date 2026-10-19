/** Enums dùng chung cho đơn hàng, chuyến đi và phân công (schema.sql). */

/** trip_assignments.role (crew role, different from user account Role) */
export enum CrewRole {
  DRIVER = 'DRIVER',
  ESCORT = 'ESCORT',
}

/** orders.status */
export enum OrderStatus {
  DRAFT      = 'DRAFT',
  PENDING    = 'PENDING',
  NEED_INFO  = 'NEED_INFO',
  REJECTED   = 'REJECTED',
  APPROVED   = 'APPROVED',
  PREPARING  = 'PREPARING',
  READY      = 'READY',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED  = 'DELIVERED',
  CANCELLED  = 'CANCELLED',
}

/** trips.plan_status */
export enum PlanStatus {
  DRAFT            = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED         = 'APPROVED',
}

