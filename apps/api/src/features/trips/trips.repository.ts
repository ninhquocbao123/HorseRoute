import { DataSource, EntityManager } from "typeorm";
import {
  TripSummary,
  TripLeg,
  TripPlanOptions,
  TripAssignment,
  CrewOption,
} from "./trips.dto";

export type AssignmentRow = Omit<TripAssignment, "assignedAt"> & {
  assignedAt: Date;
  accountRole: string;
  accountStatus: string;
};
export type TripScope = { coordinatorId: string } | { manager: true };
export type TripRow = Omit<
  TripSummary,
  "plannedDepartureAt" | "plannedArrivalAt"
> & {
  plannedDepartureAt: Date | null;
  plannedArrivalAt: Date | null;
  orderStatus: string;
  approvedBy: string | null;
  approvedAt: Date | null;
  returnReason: string | null;
};
export type LegRow = Omit<
  TripLeg,
  "plannedDepartureAt" | "plannedArrivalAt" | "vehicleActive"
> & {
  plannedDepartureAt: Date;
  plannedArrivalAt: Date;
  vehicleActive: number | null;
};
const columns = `CAST(t.id AS CHAR) AS id, CAST(t.order_id AS CHAR) AS orderId,
  o.order_code AS orderCode, t.plan_status AS planStatus, CAST(t.planned_by AS CHAR) AS plannedBy,
  t.planned_departure_at AS plannedDepartureAt, t.planned_arrival_at AS plannedArrivalAt,
  o.status AS orderStatus, CAST(t.approved_by AS CHAR) AS approvedBy, t.approved_at AS approvedAt, t.return_reason AS returnReason`;
function scopeWhere(scope: TripScope) {
  return "coordinatorId" in scope
    ? { sql: "t.planned_by = ?", args: [scope.coordinatorId] }
    : { sql: "1=1", args: [] };
}
export class TripsRepository {
  constructor(private readonly db: DataSource | EntityManager) {}
  transaction<T>(
    work: (repository: TripsRepository) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction("READ COMMITTED", (manager) =>
      work(new TripsRepository(manager)),
    );
  }
  async orderId(id: string): Promise<string | undefined> {
    const [row] = await this.db.query(
      "SELECT CAST(order_id AS CHAR) AS orderId FROM trips WHERE id=?",
      [id],
    );
    return row?.orderId;
  }
  async lockOrder(id: string): Promise<{ status: string } | undefined> {
    const [row] = await this.db.query(
      "SELECT status FROM orders WHERE id=? FOR UPDATE",
      [id],
    );
    return row;
  }
  async lockTrip(
    id: string,
  ): Promise<
    { orderId: string; plannedBy: string; planStatus: string } | undefined
  > {
    const [row] = await this.db.query(
      `SELECT CAST(order_id AS CHAR) AS orderId, CAST(planned_by AS CHAR) AS plannedBy,
      plan_status AS planStatus FROM trips WHERE id=? FOR UPDATE`,
      [id],
    );
    return row;
  }
  lockLegs(id: string): Promise<
    {
      id: string;
      seqNo: number;
      status: string;
      actualDepartureAt: Date | null;
      actualArrivalAt: Date | null;
    }[]
  > {
    return this.db.query(
      `SELECT CAST(id AS CHAR) AS id, seq_no AS seqNo, status,
      actual_departure_at AS actualDepartureAt, actual_arrival_at AS actualArrivalAt
      FROM legs WHERE trip_id=? ORDER BY seq_no,id FOR UPDATE`,
      [id],
    );
  }
  async hasHistory(id: string): Promise<boolean> {
    // Parent Trip/Leg locks also block new FK references until this transaction finishes.
    for (const sql of [
      "SELECT m.id FROM leg_milestones m JOIN legs l ON l.id=m.leg_id WHERE l.trip_id=? LIMIT 1 FOR UPDATE",
      "SELECT h.id FROM horse_logs h JOIN legs l ON l.id=h.leg_id WHERE l.trip_id=? LIMIT 1 FOR UPDATE",
      "SELECT i.id FROM incidents i LEFT JOIN legs l ON l.id=i.leg_id WHERE i.trip_id=? OR l.trip_id=? LIMIT 1 FOR UPDATE",
    ]) {
      const rows = await this.db.query(
        sql,
        sql.includes("OR l.trip_id") ? [id, id] : [id],
      );
      if (rows.length) return true;
    }
    return false;
  }
  async lockLocation(id: string): Promise<boolean> {
    const rows = await this.db.query(
      "SELECT id FROM locations WHERE id=? FOR SHARE",
      [id],
    );
    return rows.length > 0;
  }
  async lockActiveVehicle(id: string, exclusive = false): Promise<boolean> {
    const rows = await this.db.query(
      `SELECT id FROM vehicles WHERE id=? AND is_active=1 ${exclusive ? "FOR UPDATE" : "FOR SHARE"}`,
      [id],
    );
    return rows.length > 0;
  }
  async writeLeg(
    tripId: string,
    actorId: string,
    leg: import("./trips.validation").TripPlanInput["legs"][number],
    seqNo: number,
  ) {
    const values = [
      leg.fromLocationId,
      leg.toLocationId,
      leg.vehicleId,
      new Date(leg.plannedDepartureAt),
      new Date(leg.plannedArrivalAt),
      actorId,
    ];
    if (leg.id) {
      await this.db.query(
        `UPDATE legs SET from_location_id=?,to_location_id=?,vehicle_id=?,planned_departure_at=?,
        planned_arrival_at=?,updated_by=?,updated_at=UTC_TIMESTAMP() WHERE id=? AND trip_id=?`,
        [...values, leg.id, tripId],
      );
    } else {
      await this.db.query(
        `INSERT INTO legs(from_location_id,to_location_id,vehicle_id,planned_departure_at,
        planned_arrival_at,updated_by,updated_at,trip_id,seq_no,status) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP(),?,?,'NOT_STARTED')`,
        [...values, tripId, seqNo],
      );
    }
  }
  async updatePlanTimes(id: string, departure: string, arrival: string) {
    await this.db.query(
      "UPDATE trips SET planned_departure_at=?,planned_arrival_at=? WHERE id=?",
      [new Date(departure), new Date(arrival), id],
    );
  }
  async audit(actor: string, id: string, before: string, after: string) {
    await this.db.query(
      "INSERT INTO audit_logs(actor_id,entity_type,entity_id,action,old_value,new_value) VALUES (?,'TRIP',?,'SAVE_PLAN',?,?)",
      [actor, id, before, after],
    );
  }
  async normalHorseCount(orderId: string): Promise<number> {
    const [row] = await this.db.query(
      "SELECT COUNT(*) AS total FROM horses WHERE order_id=? AND order_status='NORMAL'",
      [orderId],
    );
    return Number(row.total);
  }
  async vehicleCapacity(id: string): Promise<number | undefined> {
    const [row] = await this.db.query(
      "SELECT capacity_stalls AS capacity FROM vehicles WHERE id=?",
      [id],
    );
    return row?.capacity;
  }
  async vehicleOverlaps(
    tripId: string,
    vehicleId: string,
    departure: string,
    arrival: string,
  ): Promise<boolean> {
    const rows = await this.db.query(
      `SELECT l.id FROM legs l JOIN trips t ON t.id=l.trip_id JOIN orders o ON o.id=t.order_id
      WHERE l.vehicle_id=? AND t.id<>? AND t.plan_status='APPROVED'
      AND o.status IN ('APPROVED','PREPARING','READY','IN_TRANSIT')
      AND l.planned_departure_at < ? AND l.planned_arrival_at > ? LIMIT 1`,
      [vehicleId, tripId, new Date(arrival), new Date(departure)],
    );
    return rows.length > 0;
  }
  async lockTransportHorses(orderId: string): Promise<void> {
    await this.db.query(
      "SELECT id FROM horses WHERE order_id=? ORDER BY id FOR SHARE",
      [orderId],
    );
  }
  async vehicleStillOperating(
    tripId: string,
    vehicleId: string,
  ): Promise<boolean> {
    const rows = await this.db.query(
      `SELECT l.id FROM legs l JOIN trips t ON t.id=l.trip_id JOIN orders o ON o.id=t.order_id
      WHERE l.vehicle_id=? AND t.id<>? AND o.status='IN_TRANSIT'
      AND (l.status IN ('MOVING','AT_STOP') OR (l.actual_departure_at IS NOT NULL AND l.actual_arrival_at IS NULL)) LIMIT 1`,
      [vehicleId, tripId],
    );
    return rows.length > 0;
  }
  async reviewPlan(
    id: string,
    actor: string,
    input: import("./trips.validation").ReviewTripPlanInput,
  ) {
    if (input.decision === "APPROVED") {
      await this.db.query(
        "UPDATE trips SET plan_status='APPROVED',approved_by=?,approved_at=UTC_TIMESTAMP(),return_reason=NULL WHERE id=?",
        [actor, id],
      );
    } else {
      await this.db.query(
        "UPDATE trips SET plan_status='DRAFT',approved_by=NULL,approved_at=NULL,return_reason=? WHERE id=?",
        [input.reason, id],
      );
    }
  }
  async auditReview(
    actor: string,
    id: string,
    before: string,
    after: string,
    reason: string | null,
  ) {
    await this.db.query(
      `INSERT INTO audit_logs(actor_id,entity_type,entity_id,action,old_value,new_value,reason)
      VALUES (?,'TRIP',?,'REVIEW_PLAN',?,?,?)`,
      [actor, id, before, after, reason],
    );
  }
  async notifyPlanCoordinator(
    id: string,
    coordinatorId: string,
    decision: string,
    reason: string | null,
  ) {
    const message = `Chuyến ${id}: ${decision === "APPROVED" ? "kế hoạch đã được duyệt." : "kế hoạch được trả lại: " + reason}`;
    await this.db.query(
      `INSERT INTO notifications(recipient_id,event_type,content,related_type,related_id,channel)
      VALUES (?,'TRIP_PLAN_REVIEWED',?,'TRIP',?,'IN_APP')`,
      [coordinatorId, message, id],
    );
  }
  async submitPlan(id: string, orderId: string) {
    await this.db.query(
      `UPDATE trips SET plan_status='PENDING_APPROVAL',approved_by=NULL,approved_at=NULL,return_reason=NULL WHERE id=?`,
      [id],
    );
    await this.db.query(
      "UPDATE orders SET status='PREPARING' WHERE id=? AND status='APPROVED'",
      [orderId],
    );
  }
  async auditSubmission(
    actor: string,
    id: string,
    orderId: string,
    oldOrderStatus: string,
  ) {
    await this.db.query(
      `INSERT INTO audit_logs(actor_id,entity_type,entity_id,action,old_value,new_value)
      VALUES (?,'TRIP',?,'SUBMIT_PLAN',?,?)`,
      [
        actor,
        id,
        JSON.stringify({
          planStatus: "DRAFT",
          orderId,
          orderStatus: oldOrderStatus,
        }),
        JSON.stringify({
          planStatus: "PENDING_APPROVAL",
          orderId,
          orderStatus: "PREPARING",
        }),
      ],
    );
    if (oldOrderStatus === "APPROVED") {
      await this.db.query(
        `INSERT INTO audit_logs(actor_id,entity_type,entity_id,action,old_value,new_value)
        VALUES (?,'ORDER',?,'PREPARE_TRIP',?,?)`,
        [
          actor,
          orderId,
          JSON.stringify({ status: oldOrderStatus }),
          JSON.stringify({ status: "PREPARING", tripId: id }),
        ],
      );
    }
  }
  async notifyPlanManagers(id: string) {
    await this.db.query(
      `INSERT INTO notifications(recipient_id,event_type,content,related_type,related_id,channel)
      SELECT id,'TRIP_PLAN_SUBMITTED',?,'TRIP',?,'IN_APP' FROM users WHERE role='MANAGER' AND account_status='ACTIVE'`,
      [`Chuyến ${id}: kế hoạch đã được gửi, chờ Manager duyệt.`, id],
    );
  }
  assignmentOptions(): Promise<CrewOption[]> {
    return this.db.query(
      "SELECT CAST(id AS CHAR) AS id,full_name AS fullName FROM users WHERE role='DRIVER_ESCORT' AND account_status='ACTIVE' ORDER BY full_name,id",
    );
  }
  assignments(id: string): Promise<AssignmentRow[]> {
    return this.db.query(
      `SELECT CAST(a.id AS CHAR) AS id,CAST(a.user_id AS CHAR) AS userId,u.full_name AS fullName,
      a.role,CAST(a.assigned_by AS CHAR) AS assignedBy,a.assigned_at AS assignedAt,
      u.role AS accountRole,u.account_status AS accountStatus
      FROM trip_assignments a JOIN users u ON u.id=a.user_id WHERE a.trip_id=? ORDER BY a.user_id,a.id`,
      [id],
    );
  }
  async lockCrewUser(
    id: string,
  ): Promise<{ role: string; accountStatus: string } | undefined> {
    const [row] = await this.db.query(
      "SELECT role,account_status AS accountStatus FROM users WHERE id=? FOR UPDATE",
      [id],
    );
    return row;
  }
  async lockAssignments(id: string) {
    await this.db.query(
      "SELECT id FROM trip_assignments WHERE trip_id=? ORDER BY user_id,id FOR UPDATE",
      [id],
    );
  }
  async insertAssignment(
    tripId: string,
    userId: string,
    role: string,
    actor: string,
  ) {
    await this.db.query(
      "INSERT INTO trip_assignments(trip_id,user_id,role,assigned_by,assigned_at) VALUES (?,?,?,?,UTC_TIMESTAMP())",
      [tripId, userId, role, actor],
    );
  }
  async updateAssignment(id: string, role: string, actor: string) {
    await this.db.query(
      "UPDATE trip_assignments SET role=?,assigned_by=?,assigned_at=UTC_TIMESTAMP() WHERE id=?",
      [role, actor, id],
    );
  }
  async deleteAssignment(id: string) {
    await this.db.query("DELETE FROM trip_assignments WHERE id=?", [id]);
  }
  async auditCrew(
    actor: string,
    tripId: string,
    before: string,
    after: string,
  ) {
    await this.db.query(
      `INSERT INTO audit_logs(actor_id,entity_type,entity_id,action,old_value,new_value)
      VALUES (?,'TRIP',?,'ASSIGN_CREW',?,?)`,
      [actor, tripId, before, after],
    );
  }
  async notifyCrew(tripId: string, userId: string, role: string | null) {
    await this.db.query(
      `INSERT INTO notifications(recipient_id,event_type,content,related_type,related_id,channel)
      VALUES (?,'TRIP_CREW_CHANGED',?,'TRIP',?,'IN_APP')`,
      [
        userId,
        role
          ? `Chuyến ${tripId}: bạn được phân công vai trò ${role}.`
          : `Chuyến ${tripId}: phân công của bạn đã được gỡ.`,
        tripId,
      ],
    );
  }
  async list(
    scope: TripScope,
    limit: number,
    offset: number,
  ): Promise<{ rows: TripRow[]; total: number }> {
    const where = scopeWhere(scope);
    const rows: TripRow[] = await this.db.query(
      `SELECT ${columns} FROM trips t JOIN orders o ON o.id=t.order_id
      WHERE ${where.sql} ORDER BY t.id DESC LIMIT ? OFFSET ?`,
      [...where.args, limit, offset],
    );
    const [count] = await this.db.query(
      `SELECT COUNT(*) AS total FROM trips t JOIN orders o ON o.id=t.order_id
      WHERE ${where.sql}`,
      where.args,
    );
    const total = Number(count.total);
    if (!Number.isSafeInteger(total))
      throw new Error("Trip count exceeds safe integer range");
    return { rows, total };
  }
  async find(scope: TripScope, id: string): Promise<TripRow | undefined> {
    const where = scopeWhere(scope);
    const rows: TripRow[] = await this.db.query(
      `SELECT ${columns} FROM trips t JOIN orders o ON o.id=t.order_id
      WHERE t.id=? AND ${where.sql}`,
      [id, ...where.args],
    );
    return rows[0];
  }
  legs(id: string): Promise<LegRow[]> {
    return this.db.query(
      `SELECT CAST(l.id AS CHAR) AS id, l.seq_no AS seqNo,
      CAST(l.from_location_id AS CHAR) AS fromLocationId, f.name AS fromLocationName,
      CAST(l.to_location_id AS CHAR) AS toLocationId, dest.name AS toLocationName,
      CAST(l.vehicle_id AS CHAR) AS vehicleId, v.plate_or_code AS vehicleCode, v.is_active AS vehicleActive,
      l.planned_departure_at AS plannedDepartureAt, l.planned_arrival_at AS plannedArrivalAt, l.status
      FROM legs l JOIN locations f ON f.id=l.from_location_id JOIN locations dest ON dest.id=l.to_location_id
      LEFT JOIN vehicles v ON v.id=l.vehicle_id WHERE l.trip_id=? ORDER BY l.seq_no ASC, l.id ASC`,
      [id],
    );
  }
  locations(): Promise<TripPlanOptions["locations"]> {
    return this.db
      .query(`SELECT CAST(id AS CHAR) AS id, name, location_type AS locationType, country, timezone, address
      FROM locations ORDER BY name ASC, id ASC`);
  }
  vehicles(): Promise<
    (Omit<TripPlanOptions["vehicles"][number], "isActive"> & {
      isActive: number;
    })[]
  > {
    return this.db
      .query(`SELECT CAST(id AS CHAR) AS id, plate_or_code AS plateOrCode, vehicle_type AS vehicleType,
      capacity_stalls AS capacityStalls, is_active AS isActive FROM vehicles WHERE is_active=1 ORDER BY plate_or_code ASC, id ASC`);
  }
}
