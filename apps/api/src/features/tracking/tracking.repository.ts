import { DataSource, EntityManager } from 'typeorm';
import { LegStatus, MilestoneType, CrewRole, OrderStatus, PlanStatus } from '@my-project/shared';
import { checkCrewReadiness } from '../trips/trips.crew';
import { DEFAULT_MAX_RETROACTIVE_MINUTES } from './tracking.validation';
import { DriverTripRow, LegDetailRow, MilestoneRow, HorseInTrip, TripCrewRow, TripContactsRow, TripVehicleRow, TripMapLegRow, PositionRow } from './tracking.dto';
import type { RouteMode } from '@my-project/shared';
import type { CachedRoute } from './trackmap.routes-provider';
import type { LngLat } from './trackmap.geo';

const coordinate = (value: unknown) => value === null || value === undefined ? null : Number(value);

/** Cột báo cáo sức khỏe khi tạo mới. */
export interface HorseReportColumns {
  reportStatus: import('@my-project/shared').HorseReportStatus;
  bodyTempC: number | null;
  heartRateBpm: number | null;
  appetite: import('@my-project/shared').HorseAppetite | null;
  customerNote: string | null;
  sendToCustomer: boolean;
}

/** Nội dung chỉnh được của nháp. */
export interface HorseReportEditable extends Omit<HorseReportColumns, 'reportStatus'> {
  conditionStatus: import('@my-project/shared').HorseConditionStatus;
  note: string | null;
  loggedAt: string;
}

export class TrackingRepository {
  constructor(private readonly db: DataSource | EntityManager) {}

  transaction<T>(work: (repo: TrackingRepository) => Promise<T>): Promise<T> {
    return this.db.transaction('READ COMMITTED', manager => work(new TrackingRepository(manager)));
  }

  async getDriverTrips(driverId: string): Promise<DriverTripRow[]> {
    return this.db.query(
      `SELECT CAST(t.id AS CHAR) AS id, CAST(t.order_id AS CHAR) AS orderId,
        o.order_code AS orderCode, o.status AS orderStatus, t.plan_status AS planStatus,
        t.planned_departure_at AS plannedDepartureAt, t.planned_arrival_at AS plannedArrivalAt,
        a.role AS crewRole
      FROM trips t
      JOIN trip_assignments a ON a.trip_id = t.id
      JOIN orders o ON o.id = t.order_id
      WHERE a.user_id = ? AND t.plan_status = 'APPROVED' AND o.status IN ('READY', 'IN_TRANSIT', 'DELIVERED')
      ORDER BY t.id DESC`,
      [driverId]
    );
  }

  async getDriverAssignment(tripId: string, userId: string): Promise<{ role: CrewRole } | undefined> {
    const [row] = await this.db.query(
      `SELECT role FROM trip_assignments WHERE trip_id = ? AND user_id = ?`,
      [tripId, userId]
    );
    return row;
  }

  async findTrip(tripId: string): Promise<{
    id: string;
    orderId: string;
    orderCode: string;
    orderStatus: OrderStatus;
    planStatus: PlanStatus;
    plannedDepartureAt: Date | null;
    plannedArrivalAt: Date | null;
    plannedBy: string;
    customerId: string;
  } | undefined> {
    const [row] = await this.db.query(
      `SELECT CAST(t.id AS CHAR) AS id, CAST(t.order_id AS CHAR) AS orderId,
        o.order_code AS orderCode, o.status AS orderStatus, t.plan_status AS planStatus,
        t.planned_departure_at AS plannedDepartureAt, t.planned_arrival_at AS plannedArrivalAt,
        CAST(t.planned_by AS CHAR) AS plannedBy, CAST(o.customer_id AS CHAR) AS customerId
      FROM trips t
      JOIN orders o ON o.id = t.order_id
      WHERE t.id = ?`,
      [tripId]
    );
    return row;
  }

  async getTripLegs(tripId: string): Promise<LegDetailRow[]> {
    return this.db.query(
      `SELECT CAST(l.id AS CHAR) AS id, l.seq_no AS seqNo,
        CAST(l.from_location_id AS CHAR) AS fromLocationId, f.name AS fromLocationName,
        CAST(l.to_location_id AS CHAR) AS toLocationId, dest.name AS toLocationName, dest.location_type AS toLocationType,
        CAST(l.vehicle_id AS CHAR) AS vehicleId, v.plate_or_code AS vehicleCode,
        l.planned_departure_at AS plannedDepartureAt, l.planned_arrival_at AS plannedArrivalAt,
        l.status, l.actual_departure_at AS actualDepartureAt, l.actual_arrival_at AS actualArrivalAt,
        l.updated_at AS updatedAt, u.full_name AS updatedByName
      FROM legs l
      JOIN locations f ON f.id = l.from_location_id
      JOIN locations dest ON dest.id = l.to_location_id
      LEFT JOIN vehicles v ON v.id = l.vehicle_id
      LEFT JOIN users u ON u.id = l.updated_by
      WHERE l.trip_id = ?
      ORDER BY l.seq_no ASC, l.id ASC`,
      [tripId]
    );
  }

  async getLegsForTrips(tripIds: string[]): Promise<(LegDetailRow & { tripId: string })[]> {
    if (!tripIds.length) return [];
    return this.db.query(
      `SELECT CAST(l.trip_id AS CHAR) AS tripId, CAST(l.id AS CHAR) AS id, l.seq_no AS seqNo,
        CAST(l.from_location_id AS CHAR) AS fromLocationId, f.name AS fromLocationName,
        CAST(l.to_location_id AS CHAR) AS toLocationId, dest.name AS toLocationName, dest.location_type AS toLocationType,
        CAST(l.vehicle_id AS CHAR) AS vehicleId, v.plate_or_code AS vehicleCode,
        l.planned_departure_at AS plannedDepartureAt, l.planned_arrival_at AS plannedArrivalAt,
        l.status, l.actual_departure_at AS actualDepartureAt, l.actual_arrival_at AS actualArrivalAt,
        l.updated_at AS updatedAt, u.full_name AS updatedByName
      FROM legs l
      JOIN locations f ON f.id = l.from_location_id
      JOIN locations dest ON dest.id = l.to_location_id
      LEFT JOIN vehicles v ON v.id = l.vehicle_id
      LEFT JOIN users u ON u.id = l.updated_by
      WHERE l.trip_id IN (${tripIds.map(() => '?').join(',')})
      ORDER BY l.trip_id ASC, l.seq_no ASC, l.id ASC`,
      tripIds
    );
  }

  /** Cửa sổ T (phút) nhập bù mốc; đọc từ system_parameters.LEG_BACK, mặc định khi thiếu/không hợp lệ. */
  async getMaxRetroactiveMinutes(): Promise<number> {
    const [row] = await this.db.query(`SELECT param_value AS value FROM system_parameters WHERE param_code = 'LEG_BACK'`);
    const value = Number(row?.value);
    return Number.isInteger(value) && value > 0 && value <= 10080 ? value : DEFAULT_MAX_RETROACTIVE_MINUTES;
  }

  async getLegMilestones(legIds: string[]): Promise<MilestoneRow[]> {
    if (!legIds.length) return [];
    return this.db.query(
      `SELECT CAST(m.id AS CHAR) AS id, CAST(m.leg_id AS CHAR) AS legId,
        m.milestone_type AS milestoneType, m.occurred_at AS occurredAt,
        CAST(m.recorded_by AS CHAR) AS recordedBy, u.full_name AS recordedByName
      FROM leg_milestones m
      JOIN users u ON u.id = m.recorded_by
      WHERE m.leg_id IN (${legIds.map(() => '?').join(',')})
      ORDER BY m.occurred_at ASC, m.id ASC`,
      legIds
    );
  }

  async getTripHorses(orderId: string): Promise<HorseInTrip[]> {
    return this.db.query(
      `SELECT CAST(id AS CHAR) AS id, name, passport_no AS passportNo, order_status AS orderStatus,
        breed, DATE_FORMAT(birth_date, '%Y-%m-%d') AS birthDate
      FROM horses WHERE order_id = ? AND order_status = 'NORMAL' ORDER BY id ASC`,
      [orderId]
    );
  }

  /** Driver/Escort được phân công; DRIVER trước ESCORT. */
  async getTripCrew(tripId: string): Promise<TripCrewRow[]> {
    return this.db.query(
      `SELECT CAST(a.user_id AS CHAR) AS userId, u.full_name AS name, u.phone, a.role
      FROM trip_assignments a
      JOIN users u ON u.id = a.user_id
      WHERE a.trip_id = ?
      ORDER BY FIELD(a.role, 'DRIVER', 'ESCORT'), a.user_id ASC`,
      [tripId]
    );
  }

  /** Khách hàng, người nhận (orders) và điều phối viên lập kế hoạch (trips.planned_by). */
  async getTripContacts(tripId: string): Promise<TripContactsRow | undefined> {
    const [row] = await this.db.query(
      `SELECT c.full_name AS customerName, o.recipient_name AS recipientName, o.recipient_phone AS recipientPhone,
        p.full_name AS coordinatorName, p.phone AS coordinatorPhone
      FROM trips t
      JOIN orders o ON o.id = t.order_id
      JOIN users c ON c.id = o.customer_id
      LEFT JOIN users p ON p.id = t.planned_by
      WHERE t.id = ?`,
      [tripId]
    );
    return row;
  }

  /** Các xe khác nhau dùng trong chặng, theo chặng đầu tiên dùng xe. */
  async getTripVehicles(tripId: string): Promise<TripVehicleRow[]> {
    return this.db.query(
      `SELECT CAST(v.id AS CHAR) AS id, v.plate_or_code AS code, v.vehicle_type AS type, v.capacity_stalls AS capacityStalls
      FROM legs l
      JOIN vehicles v ON v.id = l.vehicle_id
      WHERE l.trip_id = ?
      GROUP BY v.id, v.plate_or_code, v.vehicle_type, v.capacity_stalls
      ORDER BY MIN(l.seq_no) ASC, v.id ASC`,
      [tripId]
    );
  }

  async lockLegForUpdate(legId: string): Promise<{
    id: string;
    tripId: string;
    seqNo: number;
    status: LegStatus;
    fromLocationId: string;
    toLocationId: string;
    toLocationType: string;
    vehicleId: string | null;
    actualDepartureAt: Date | null;
    actualArrivalAt: Date | null;
    orderId: string;
    orderCode: string;
    orderStatus: OrderStatus;
    planStatus: PlanStatus;
    plannedBy: string;
    customerId: string;
  } | undefined> {
    const [row] = await this.db.query(
      `SELECT CAST(l.id AS CHAR) AS id, CAST(l.trip_id AS CHAR) AS tripId, l.seq_no AS seqNo, l.status,
        CAST(l.from_location_id AS CHAR) AS fromLocationId, CAST(l.to_location_id AS CHAR) AS toLocationId,
        dest.location_type AS toLocationType, CAST(l.vehicle_id AS CHAR) AS vehicleId,
        l.actual_departure_at AS actualDepartureAt, l.actual_arrival_at AS actualArrivalAt,
        CAST(t.order_id AS CHAR) AS orderId, o.order_code AS orderCode, o.status AS orderStatus,
        t.plan_status AS planStatus, CAST(t.planned_by AS CHAR) AS plannedBy, CAST(o.customer_id AS CHAR) AS customerId
      FROM legs l
      JOIN trips t ON t.id = l.trip_id
      JOIN orders o ON o.id = t.order_id
      JOIN locations dest ON dest.id = l.to_location_id
      WHERE l.id = ? FOR UPDATE`,
      [legId]
    );
    return row;
  }

  async lockAllTripLegs(tripId: string): Promise<{
    id: string;
    seqNo: number;
    status: LegStatus;
    toLocationType: string;
    actualDepartureAt: Date | null;
    actualArrivalAt: Date | null;
  }[]> {
    return this.db.query(
      `SELECT CAST(l.id AS CHAR) AS id, l.seq_no AS seqNo, l.status, dest.location_type AS toLocationType,
        l.actual_departure_at AS actualDepartureAt, l.actual_arrival_at AS actualArrivalAt
      FROM legs l
      JOIN locations dest ON dest.id = l.to_location_id
      WHERE l.trip_id = ?
      ORDER BY l.seq_no ASC FOR UPDATE`,
      [tripId]
    );
  }

  /** Đơn kèm chuyến duy nhất của đơn (nếu có) để dựng timeline cho Customer. */
  async findOrderForTimeline(orderId: string): Promise<{
    orderId: string;
    orderCode: string;
    orderStatus: OrderStatus;
    customerId: string;
    tripId: string | null;
    planStatus: PlanStatus | null;
    plannedDepartureAt: Date | null;
    plannedArrivalAt: Date | null;
  } | undefined> {
    const [row] = await this.db.query(
      `SELECT CAST(o.id AS CHAR) AS orderId, o.order_code AS orderCode, o.status AS orderStatus,
        CAST(o.customer_id AS CHAR) AS customerId, CAST(t.id AS CHAR) AS tripId, t.plan_status AS planStatus,
        t.planned_departure_at AS plannedDepartureAt, t.planned_arrival_at AS plannedArrivalAt
      FROM orders o LEFT JOIN trips t ON t.order_id = o.id
      WHERE o.id = ? ORDER BY t.id ASC LIMIT 1`,
      [orderId]
    );
    return row;
  }

  /** Chuyến đã duyệt đang chạy hoặc còn sự cố chưa đóng; plannerId để giới hạn theo Coordinator. */
  async getActiveTrips(plannerId: string | null, limit: number): Promise<{
    tripId: string;
    orderId: string;
    orderCode: string;
    orderStatus: OrderStatus;
    customerName: string;
    plannedDepartureAt: Date | null;
    plannedArrivalAt: Date | null;
  }[]> {
    return this.db.query(
      `SELECT CAST(t.id AS CHAR) AS tripId, CAST(o.id AS CHAR) AS orderId, o.order_code AS orderCode,
        o.status AS orderStatus, cu.full_name AS customerName,
        t.planned_departure_at AS plannedDepartureAt, t.planned_arrival_at AS plannedArrivalAt
      FROM trips t
      JOIN orders o ON o.id = t.order_id
      JOIN users cu ON cu.id = o.customer_id
      WHERE t.plan_status = 'APPROVED'
        AND (o.status = 'IN_TRANSIT' OR EXISTS (SELECT 1 FROM incidents i WHERE i.trip_id = t.id AND i.status <> 'CLOSED'))
        ${plannerId ? 'AND t.planned_by = ?' : ''}
      ORDER BY t.id DESC LIMIT ${Math.trunc(limit)}`,
      plannerId ? [plannerId] : []
    );
  }

  async getOpenIncidentCounts(tripIds: string[]): Promise<{ tripId: string; open: number; high: number }[]> {
    if (!tripIds.length) return [];
    const rows = await this.db.query(
      `SELECT CAST(trip_id AS CHAR) AS tripId, COUNT(*) AS open, SUM(urgency = 'HIGH') AS high
      FROM incidents WHERE status <> 'CLOSED' AND trip_id IN (${tripIds.map(() => '?').join(',')})
      GROUP BY trip_id`,
      tripIds
    );
    // BIGINT/DECIMAL aggregates come back as strings with bigNumberStrings enabled.
    return rows.map((row: { tripId: string; open: unknown; high: unknown }) => ({ tripId: row.tripId, open: Number(row.open), high: Number(row.high) }));
  }

  /** Ghi nhận cập nhật chặng (người/giờ) cho mốc không đổi trạng thái, ví dụ CUSTOMS_CLEARED. */
  async touchLeg(legId: string, actorId: string): Promise<void> {
    await this.db.query(`UPDATE legs SET updated_by = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?`, [actorId, legId]);
  }

  async hasMilestone(legId: string, milestoneType: MilestoneType): Promise<boolean> {
    const rows = await this.db.query(
      `SELECT id FROM leg_milestones WHERE leg_id = ? AND milestone_type = ? LIMIT 1`,
      [legId, milestoneType]
    );
    return rows.length > 0;
  }

  async getLegMilestoneRecords(legId: string): Promise<{ id: string; milestoneType: MilestoneType; occurredAt: Date }[]> {
    return this.db.query(
      `SELECT CAST(id AS CHAR) AS id, milestone_type AS milestoneType, occurred_at AS occurredAt
      FROM leg_milestones WHERE leg_id = ? ORDER BY id ASC`,
      [legId]
    );
  }

  async deleteMilestones(ids: string[]): Promise<void> {
    if (!ids.length) return;
    await this.db.query(`DELETE FROM leg_milestones WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
  }

  async insertMilestone(legId: string, milestoneType: MilestoneType, occurredAt: string, recordedBy: string): Promise<string> {
    const result = await this.db.query(
      `INSERT INTO leg_milestones (leg_id, milestone_type, occurred_at, recorded_by)
      VALUES (?, ?, ?, ?)`,
      [legId, milestoneType, new Date(occurredAt), recordedBy]
    );
    return String(result.insertId);
  }

  async updateLegDeparture(legId: string, actualDepartureAt: string, actorId: string): Promise<void> {
    await this.db.query(
      `UPDATE legs SET status = 'MOVING', actual_departure_at = ?, updated_by = ?, updated_at = UTC_TIMESTAMP()
      WHERE id = ?`,
      [new Date(actualDepartureAt), actorId, legId]
    );
  }

  async updateLegArrival(legId: string, actualArrivalAt: string, actorId: string): Promise<void> {
    await this.db.query(
      `UPDATE legs SET status = 'AT_STOP', actual_arrival_at = ?, updated_by = ?, updated_at = UTC_TIMESTAMP()
      WHERE id = ?`,
      [new Date(actualArrivalAt), actorId, legId]
    );
  }

  async updateLegStatus(legId: string, status: LegStatus, actorId: string): Promise<void> {
    await this.db.query(
      `UPDATE legs SET status = ?, updated_by = ?, updated_at = UTC_TIMESTAMP()
      WHERE id = ?`,
      [status, actorId, legId]
    );
  }

  async updateLegCorrection(
    legId: string,
    status: LegStatus,
    actualDepartureAt: Date | null,
    actualArrivalAt: Date | null,
    actorId: string
  ): Promise<void> {
    await this.db.query(
      `UPDATE legs SET status = ?, actual_departure_at = ?, actual_arrival_at = ?, updated_by = ?, updated_at = UTC_TIMESTAMP()
      WHERE id = ?`,
      [status, actualDepartureAt, actualArrivalAt, actorId, legId]
    );
  }

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
    await this.db.query(
      `UPDATE orders SET status = ? WHERE id = ?`,
      [status, orderId]
    );
  }

  async audit(actorId: string, entityType: string, entityId: string, action: string, oldValue: string | null, newValue: string, reason: string | null = null): Promise<void> {
    await this.db.query(
      `INSERT INTO audit_logs (actor_id, entity_type, entity_id, action, old_value, new_value, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [actorId, entityType, entityId, action, oldValue, newValue, reason]
    );
  }

  /** Mã người dùng được phân công chuyến (tài xế / hộ tống). */
  async getTripCrewIds(tripId: string): Promise<string[]> {
    const rows = await this.db.query(`SELECT CAST(user_id AS CHAR) AS userId FROM trip_assignments WHERE trip_id = ?`, [tripId]);
    return rows.map((row: { userId: string }) => row.userId);
  }

  /** Thông báo IN_APP mới nhất của từng người nhận cho một sự kiện của chuyến (để đẩy qua socket sau khi commit). */
  async findLatestTripNotifications(recipientIds: string[], eventType: string, tripId: string): Promise<{ recipientId: string; id: string; content: string; createdAt: Date }[]> {
    if (!recipientIds.length) return [];
    const rows = await this.db.query(
      `SELECT CAST(id AS CHAR) AS id, CAST(recipient_id AS CHAR) AS recipientId, content, created_at AS createdAt
      FROM notifications WHERE recipient_id IN (${recipientIds.map(() => '?').join(',')}) AND event_type = ? AND related_type = 'TRIP' AND related_id = ? AND channel = 'IN_APP'
      ORDER BY id DESC LIMIT 50`,
      [...recipientIds, eventType, tripId]
    );
    const seen = new Set<string>();
    return rows.filter((row: { recipientId: string }) => (seen.has(row.recipientId) ? false : (seen.add(row.recipientId), true)));
  }

  /** Tạo thông báo IN_APP; trả mã để đẩy `notification:new` sau khi commit. */
  async notify(recipientId: string, eventType: string, content: string, relatedType: string, relatedId: string): Promise<string> {
    const result = await this.db.query(
      `INSERT INTO notifications (recipient_id, event_type, content, related_type, related_id, channel)
      VALUES (?, ?, ?, ?, ?, 'IN_APP')`,
      [recipientId, eventType, content, relatedType, relatedId]
    );
    return String(result?.insertId ?? '');
  }

  async notifyStakeholders(tripId: string, orderId: string, eventType: string, content: string): Promise<void> {
    await this.db.query(
      `INSERT INTO notifications (recipient_id, event_type, content, related_type, related_id, channel)
      SELECT DISTINCT id, ?, ?, 'TRIP', ?, 'IN_APP'
      FROM users
      WHERE id IN (
        SELECT customer_id FROM orders WHERE id = ?
        UNION
        SELECT planned_by FROM trips WHERE id = ?
        UNION
        SELECT user_id FROM trip_assignments WHERE trip_id = ?
        UNION
        SELECT id FROM users WHERE role = 'MANAGER' AND account_status = 'ACTIVE'
      )`,
      [eventType, content, tripId, orderId, tripId, tripId]
    );
  }

  // ─── Stage 2: Horse Logs ───────────────────────────────────────────────────

  async checkHorseBelongsToOrder(horseId: string, orderId: string): Promise<boolean> {
    const rows = await this.db.query(
      `SELECT id FROM horses WHERE id = ? AND order_id = ? AND order_status = 'NORMAL' LIMIT 1`,
      [horseId, orderId]
    );
    return rows.length > 0;
  }

  /**
   * Nhật ký / báo cáo kèm ngữ cảnh đơn và chuyến. `lock` khóa dòng báo cáo (sửa / xóa / gửi) để hai request không gửi đôi.
   * `corrected` = đã có bản ĐÃ GỬI (hoặc nhật ký cũ) đính chính nó; nháp đính chính chưa tính (hai nháp cùng sửa một bản được phép tồn tại, bản gửi sau bị chặn).
   */
  async findHorseLog(logId: string, lock = false): Promise<{
    id: string;
    horseId: string;
    horseName: string;
    legId: string;
    tripId: string;
    orderId: string;
    orderCode: string;
    orderStatus: OrderStatus;
    customerId: string;
    plannedBy: string;
    createdBy: string;
    conditionStatus: import('@my-project/shared').HorseConditionStatus;
    customerNote: string | null;
    reportStatus: import('@my-project/shared').HorseReportStatus | null;
    sendToCustomer: boolean;
    correctsLogId: string | null;
    corrected: boolean;
  } | undefined> {
    const [row] = await this.db.query(
      `SELECT CAST(hl.id AS CHAR) AS id, CAST(hl.horse_id AS CHAR) AS horseId, h.name AS horseName, CAST(hl.leg_id AS CHAR) AS legId,
        CAST(l.trip_id AS CHAR) AS tripId, CAST(t.order_id AS CHAR) AS orderId, o.order_code AS orderCode, o.status AS orderStatus,
        CAST(o.customer_id AS CHAR) AS customerId, CAST(t.planned_by AS CHAR) AS plannedBy, CAST(hl.created_by AS CHAR) AS createdBy,
        hl.condition_status AS conditionStatus, hl.customer_note AS customerNote, hl.report_status AS reportStatus,
        hl.send_to_customer AS sendToCustomer, CAST(hl.corrects_log_id AS CHAR) AS correctsLogId,
        EXISTS (SELECT 1 FROM horse_logs c WHERE c.corrects_log_id = hl.id AND (c.report_status IS NULL OR c.report_status = 'SENT')) AS corrected
      FROM horse_logs hl
      JOIN legs l ON l.id = hl.leg_id
      JOIN trips t ON t.id = l.trip_id
      JOIN orders o ON o.id = t.order_id
      JOIN horses h ON h.id = hl.horse_id
      WHERE hl.id = ?${lock ? ' FOR UPDATE OF hl' : ''}`,
      [logId]
    );
    return row ? { ...row, sendToCustomer: Boolean(Number(row.sendToCustomer)), corrected: Boolean(Number(row.corrected)) } : undefined;
  }

  async legBelongsToTrip(legId: string, tripId: string): Promise<boolean> {
    const rows = await this.db.query(`SELECT id FROM legs WHERE id = ? AND trip_id = ? LIMIT 1`, [legId, tripId]);
    return rows.length > 0;
  }

  async findAttachment(id: string): Promise<{
    id: string;
    originalName: string;
    fileType: 'PDF' | 'JPG' | 'PNG';
    storagePath: string;
    tripId: string;
    horseLogId: string | null;
    incidentId: string | null;
    /** Chỉ có với ảnh của nhật ký ngựa: trạng thái báo cáo và người tạo (ảnh nháp chỉ người tạo xem được). */
    reportStatus?: string | null;
    logCreatedBy?: string | null;
  } | undefined> {
    const [row] = await this.db.query(
      `SELECT CAST(a.id AS CHAR) AS id, a.original_name AS originalName, a.file_type AS fileType,
        a.storage_path AS storagePath, CAST(COALESCE(l.trip_id, i.trip_id) AS CHAR) AS tripId,
        CAST(a.horse_log_id AS CHAR) AS horseLogId, CAST(a.incident_id AS CHAR) AS incidentId,
        h.report_status AS reportStatus, CAST(h.created_by AS CHAR) AS logCreatedBy
      FROM attachments a
      LEFT JOIN horse_logs h ON h.id = a.horse_log_id
      LEFT JOIN legs l ON l.id = h.leg_id
      LEFT JOIN incidents i ON i.id = a.incident_id
      WHERE a.id = ?`,
      [id]
    );
    return row;
  }

  async notifyCrewAndManagers(tripId: string, eventType: string, content: string, includeCustomer = false): Promise<void> {
    await this.db.query(
      `INSERT INTO notifications (recipient_id, event_type, content, related_type, related_id, channel)
      SELECT DISTINCT id, ?, ?, 'TRIP', ?, 'IN_APP'
      FROM users
      WHERE account_status = 'ACTIVE' AND (
        role = 'MANAGER'
        OR id IN (SELECT user_id FROM trip_assignments WHERE trip_id = ?)
        ${includeCustomer ? 'OR id IN (SELECT o.customer_id FROM trips t JOIN orders o ON o.id = t.order_id WHERE t.id = ?)' : ''}
      )`,
      includeCustomer ? [eventType, content, tripId, tripId, tripId] : [eventType, content, tripId, tripId]
    );
  }

  /**
   * Kiểm tra lại điều kiện vận hành do Flow 3 lập (nhân sự, xe, ngựa) ngay trước khi chặng đầu xuất phát.
   * Dữ liệu có thể đã đổi từ lúc đơn được chuyển READY (tài khoản bị khóa, xe ngừng hoạt động, ngựa bị đánh dấu...).
   */
  async getDepartureBlockers(tripId: string, orderId: string): Promise<{ code: string; message: string; legId?: string; userId?: string; horseId?: string }[]> {
    const blockers: { code: string; message: string; legId?: string; userId?: string; horseId?: string }[] = [];
    const crew = await this.db.query(
      `SELECT CAST(a.user_id AS CHAR) AS userId, a.role, u.role AS accountRole, u.account_status AS accountStatus
      FROM trip_assignments a JOIN users u ON u.id = a.user_id WHERE a.trip_id = ?`,
      [tripId]
    );
    blockers.push(...checkCrewReadiness(crew).blockers);

    const horses: { id: string; status: string }[] = await this.db.query(
      `SELECT CAST(id AS CHAR) AS id, order_status AS status FROM horses WHERE order_id = ?`,
      [orderId]
    );
    const normal = horses.filter(h => h.status === 'NORMAL').length;
    if (!normal) blockers.push({ code: 'NO_TRANSPORT_HORSES', message: 'Đơn không còn ngựa NORMAL để vận chuyển.' });
    for (const horse of horses.filter(h => h.status === 'FLAGGED')) {
      blockers.push({ code: 'HORSE_FLAGGED', message: 'Có ngựa đang bị đánh dấu, cần xử lý trước khi xuất phát.', horseId: horse.id });
    }

    const legs: { id: string; vehicleActive: number | null; capacity: number | null; busy: number }[] = await this.db.query(
      `SELECT CAST(l.id AS CHAR) AS id, v.is_active AS vehicleActive, v.capacity_stalls AS capacity,
        EXISTS(
          SELECT 1 FROM legs x JOIN trips xt ON xt.id = x.trip_id JOIN orders xo ON xo.id = xt.order_id
          WHERE x.vehicle_id = l.vehicle_id AND xt.id <> l.trip_id AND xo.status = 'IN_TRANSIT'
            AND (x.status IN ('MOVING', 'AT_STOP') OR (x.actual_departure_at IS NOT NULL AND x.actual_arrival_at IS NULL))
        ) AS busy
      FROM legs l LEFT JOIN vehicles v ON v.id = l.vehicle_id WHERE l.trip_id = ? ORDER BY l.seq_no`,
      [tripId]
    );
    for (const leg of legs) {
      if (!leg.vehicleActive) blockers.push({ code: 'VEHICLE_INACTIVE', message: 'Chặng thiếu xe hoặc xe không còn hoạt động.', legId: leg.id });
      else if (leg.capacity === null || leg.capacity < normal) blockers.push({ code: 'VEHICLE_CAPACITY', message: 'Xe không đủ chỗ cho ngựa NORMAL.', legId: leg.id });
      if (Number(leg.busy) === 1) blockers.push({ code: 'VEHICLE_BUSY', message: 'Xe còn đang vận hành chuyến khác.', legId: leg.id });
    }
    return blockers;
  }

  async insertHorseLog(
    horseId: string,
    legId: string,
    conditionStatus: import('@my-project/shared').HorseConditionStatus,
    note: string | null,
    loggedAt: string,
    createdBy: string,
    correctsLogId: string | null,
    report?: HorseReportColumns
  ): Promise<string> {
    // Nhật ký cũ không truyền `report`: các cột báo cáo giữ giá trị mặc định (NULL / 0).
    const result = await this.db.query(
      `INSERT INTO horse_logs (horse_id, leg_id, condition_status, note, logged_at, created_by, corrects_log_id,
        body_temp_c, heart_rate_bpm, appetite, customer_note, report_status, send_to_customer, sent_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${report?.reportStatus === 'SENT' ? 'UTC_TIMESTAMP()' : 'NULL'})`,
      [horseId, legId, conditionStatus, note, new Date(loggedAt), createdBy, correctsLogId,
        report?.bodyTempC ?? null, report?.heartRateBpm ?? null, report?.appetite ?? null, report?.customerNote ?? null,
        report?.reportStatus ?? null, report?.sendToCustomer ? 1 : 0]
    );
    return String(result.insertId);
  }

  /** Sửa nháp: thay toàn bộ nội dung chỉnh được. Chỉ chạy trên dòng còn DRAFT. */
  async updateHorseReport(logId: string, fields: HorseReportEditable): Promise<number> {
    const result = await this.db.query(
      `UPDATE horse_logs SET condition_status = ?, note = ?, logged_at = ?, customer_note = ?, body_temp_c = ?, heart_rate_bpm = ?,
        appetite = ?, send_to_customer = ?
      WHERE id = ? AND report_status = 'DRAFT'`,
      [fields.conditionStatus, fields.note, new Date(fields.loggedAt), fields.customerNote, fields.bodyTempC, fields.heartRateBpm,
        fields.appetite, fields.sendToCustomer ? 1 : 0, logId]
    );
    return Number(result?.affectedRows ?? 0);
  }

  /** DRAFT → SENT (giờ UTC của DB). Trả số dòng đổi: 0 nghĩa là không còn là nháp. */
  async markHorseReportSent(logId: string, sendToCustomer: boolean): Promise<number> {
    const result = await this.db.query(
      `UPDATE horse_logs SET report_status = 'SENT', send_to_customer = ?, sent_at = UTC_TIMESTAMP()
      WHERE id = ? AND report_status = 'DRAFT'`,
      [sendToCustomer ? 1 : 0, logId]
    );
    return Number(result?.affectedRows ?? 0);
  }

  async deleteHorseReport(logId: string): Promise<number> {
    const result = await this.db.query(`DELETE FROM horse_logs WHERE id = ? AND report_status = 'DRAFT'`, [logId]);
    return Number(result?.affectedRows ?? 0);
  }

  /** Ảnh hiện có của một nhật ký (để đếm, xóa và dọn tệp). */
  async getLogAttachmentRefs(logId: string): Promise<{ id: string; storagePath: string }[]> {
    return this.db.query(`SELECT CAST(id AS CHAR) AS id, storage_path AS storagePath FROM attachments WHERE horse_log_id = ?`, [logId]);
  }

  async deleteAttachments(ids: string[]): Promise<void> {
    if (!ids.length) return;
    await this.db.query(`DELETE FROM attachments WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
  }

  /** Chặng đầu tiên của chuyến: nơi ghi nhật ký khi đơn READY (chưa chặng nào chạy). */
  async getFirstLegId(tripId: string): Promise<string | null> {
    const [row] = await this.db.query(`SELECT CAST(id AS CHAR) AS id FROM legs WHERE trip_id = ? ORDER BY seq_no ASC LIMIT 1`, [tripId]);
    return row?.id ?? null;
  }

  /**
   * Báo cáo khách xem được của một đơn: SENT + gửi khách; bỏ bản gốc đã có bản đính chính cũng SENT + gửi khách (khách chỉ thấy bản mới nhất).
   */
  async getCustomerHorseReports(orderId: string): Promise<import('./tracking.dto').CustomerHorseReportRow[]> {
    return this.db.query(
      `SELECT CAST(hl.id AS CHAR) AS id, CAST(hl.horse_id AS CHAR) AS horseId, h.name AS horseName, hl.condition_status AS conditionStatus,
        hl.body_temp_c AS bodyTempC, hl.heart_rate_bpm AS heartRateBpm, hl.appetite, hl.customer_note AS customerNote,
        hl.logged_at AS loggedAt, hl.sent_at AS sentAt, hl.customer_viewed_at AS viewedAt, u.full_name AS escortName,
        CAST(hl.created_by AS CHAR) AS createdBy
      FROM horse_logs hl
      JOIN horses h ON h.id = hl.horse_id
      JOIN users u ON u.id = hl.created_by
      WHERE h.order_id = ? AND hl.report_status = 'SENT' AND hl.send_to_customer = 1
        AND NOT EXISTS (SELECT 1 FROM horse_logs c WHERE c.corrects_log_id = hl.id AND c.report_status = 'SENT' AND c.send_to_customer = 1)
      ORDER BY hl.sent_at DESC, hl.id DESC LIMIT 200`,
      [orderId]
    );
  }

  /** Đặt "khách đã xem" lần đầu. Trả số dòng đổi: 1 = lần đầu, 0 = đã xem từ trước. */
  async markHorseReportViewed(logId: string): Promise<number> {
    const result = await this.db.query(
      `UPDATE horse_logs SET customer_viewed_at = UTC_TIMESTAMP() WHERE id = ? AND customer_viewed_at IS NULL AND report_status = 'SENT'`,
      [logId]
    );
    return Number(result?.affectedRows ?? 0);
  }

  async getHorseReportViewedAt(logId: string): Promise<Date | null> {
    const [row] = await this.db.query(`SELECT customer_viewed_at AS viewedAt FROM horse_logs WHERE id = ?`, [logId]);
    return row?.viewedAt ?? null;
  }

  /** Ảnh có thuộc báo cáo đã gửi cho khách này (đơn của họ) không. */
  async isReportPhotoVisibleToCustomer(attachmentId: string, customerId: string): Promise<boolean> {
    const rows = await this.db.query(
      `SELECT a.id FROM attachments a
      JOIN horse_logs hl ON hl.id = a.horse_log_id
      JOIN horses h ON h.id = hl.horse_id
      JOIN orders o ON o.id = h.order_id
      WHERE a.id = ? AND hl.report_status = 'SENT' AND hl.send_to_customer = 1 AND o.customer_id = ? LIMIT 1`,
      [attachmentId, customerId]
    );
    return rows.length > 0;
  }

  /** Nháp chỉ người tạo (`viewerId`) thấy; nhật ký cũ và báo cáo đã gửi hiện cho mọi vai trò đọc nội bộ. */
  async getTripHorseLogs(tripId: string, viewerId: string): Promise<import('./tracking.dto').HorseLogRow[]> {
    return this.db.query(
      `SELECT CAST(hl.id AS CHAR) AS id,
        CAST(hl.horse_id AS CHAR) AS horseId,
        h.name AS horseName,
        CAST(hl.leg_id AS CHAR) AS legId,
        hl.condition_status AS conditionStatus,
        hl.note,
        hl.logged_at AS loggedAt,
        CAST(hl.created_by AS CHAR) AS createdBy,
        u.full_name AS createdByName,
        ta.role AS createdByCrewRole,
        CAST(hl.corrects_log_id AS CHAR) AS correctsLogId,
        hl.body_temp_c AS bodyTempC,
        hl.heart_rate_bpm AS heartRateBpm,
        hl.appetite,
        hl.customer_note AS customerNote,
        hl.report_status AS reportStatus,
        hl.send_to_customer AS sendToCustomer,
        hl.sent_at AS sentAt,
        hl.customer_viewed_at AS customerViewedAt
      FROM horse_logs hl
      JOIN legs l ON l.id = hl.leg_id
      JOIN horses h ON h.id = hl.horse_id
      JOIN users u ON u.id = hl.created_by
      LEFT JOIN trip_assignments ta ON ta.trip_id = l.trip_id AND ta.user_id = hl.created_by
      WHERE l.trip_id = ? AND (hl.report_status IS NULL OR hl.report_status = 'SENT' OR hl.created_by = ?)
      ORDER BY hl.logged_at ASC, hl.id ASC`,
      [tripId, viewerId]
    );
  }

  // ─── Hoạt động chăm sóc (horse_care_activities) ─────────────────────────────

  /** Chặng đang chạy (MOVING / AT_STOP) của chuyến; null khi chưa xuất phát. */
  async getCurrentLegId(tripId: string): Promise<string | null> {
    const [row] = await this.db.query(
      `SELECT CAST(id AS CHAR) AS id FROM legs WHERE trip_id = ? AND status IN ('MOVING','AT_STOP') ORDER BY seq_no ASC LIMIT 1`,
      [tripId]
    );
    return row ? row.id : null;
  }

  async insertCareActivity(input: {
    tripId: string; legId: string | null; horseId: string | null; activityType: string; feedDescription: string | null;
    amountLiters: number | null; durationMinutes: number | null; note: string | null; performedAt: string; createdBy: string; correctsActivityId: string | null;
  }): Promise<string> {
    const result = await this.db.query(
      `INSERT INTO horse_care_activities
        (trip_id, leg_id, horse_id, activity_type, feed_description, amount_liters, duration_minutes, note, performed_at, created_by, corrects_activity_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.tripId, input.legId, input.horseId, input.activityType, input.feedDescription, input.amountLiters, input.durationMinutes, input.note,
        new Date(input.performedAt), input.createdBy, input.correctsActivityId]
    );
    return String(result.insertId);
  }

  /** Bản ghi gốc để đính chính, kèm việc đã có bản đính chính khác trỏ tới nó chưa. */
  async findCareActivity(id: string): Promise<{ id: string; tripId: string; horseId: string | null; activityType: string; corrected: boolean } | undefined> {
    const [row] = await this.db.query(
      `SELECT CAST(a.id AS CHAR) AS id, CAST(a.trip_id AS CHAR) AS tripId, CAST(a.horse_id AS CHAR) AS horseId, a.activity_type AS activityType,
        EXISTS (SELECT 1 FROM horse_care_activities c WHERE c.corrects_activity_id = a.id) AS corrected
      FROM horse_care_activities a WHERE a.id = ?`,
      [id]
    );
    return row ? { ...row, horseId: row.horseId ?? null, corrected: Boolean(Number(row.corrected)) } : undefined;
  }

  /**
   * Mới nhất trước; bỏ các bản đã bị đính chính (chỉ trả bản mới nhất). Có khoảng thì lọc `performed_at` trong [from, to).
   * `onlyId` lấy đúng một bản ghi (kể cả đã bị đính chính). Tối đa 1000 dòng.
   */
  async getCareActivities(tripId: string, range?: { from: Date; to: Date }, onlyId?: string): Promise<import('./tracking.dto').CareActivityRow[]> {
    const filters = ['a.trip_id = ?', 'NOT EXISTS (SELECT 1 FROM horse_care_activities c WHERE c.corrects_activity_id = a.id)'];
    const params: unknown[] = [tripId];
    if (range) { filters.push('a.performed_at >= ? AND a.performed_at < ?'); params.push(range.from, range.to); }
    if (onlyId) { filters.length = 1; filters.push('a.id = ?'); params.push(onlyId); }
    return this.db.query(
      `SELECT CAST(a.id AS CHAR) AS id, CAST(a.trip_id AS CHAR) AS tripId, CAST(a.leg_id AS CHAR) AS legId, CAST(a.horse_id AS CHAR) AS horseId,
        h.name AS horseName, a.activity_type AS activityType, a.feed_description AS feedDescription, a.amount_liters AS amountLiters,
        a.duration_minutes AS durationMinutes, a.note, a.performed_at AS performedAt, CAST(a.created_by AS CHAR) AS createdBy,
        u.full_name AS createdByName, a.created_at AS createdAt, CAST(a.corrects_activity_id AS CHAR) AS correctsActivityId
      FROM horse_care_activities a
      LEFT JOIN horses h ON h.id = a.horse_id
      JOIN users u ON u.id = a.created_by
      WHERE ${filters.join(' AND ')}
      ORDER BY a.performed_at DESC, a.id DESC LIMIT 1000`,
      params
    );
  }

  /** Lần cho ăn mới nhất (chưa bị đính chính) của từng ngựa trên toàn chuyến, không phụ thuộc khoảng from/to. */
  async getLastFeedByHorse(tripId: string): Promise<{ horseId: string; performedAt: Date }[]> {
    return this.db.query(
      `SELECT CAST(a.horse_id AS CHAR) AS horseId, MAX(a.performed_at) AS performedAt
      FROM horse_care_activities a
      WHERE a.trip_id = ? AND a.activity_type = 'FEED' AND a.horse_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM horse_care_activities c WHERE c.corrects_activity_id = a.id)
      GROUP BY a.horse_id`,
      [tripId]
    );
  }

  async getHorseLogAttachments(logIds: string[]): Promise<import('./tracking.dto').AttachmentRow[]> {
    if (!logIds.length) return [];
    return this.db.query(
      `SELECT CAST(id AS CHAR) AS id,
        original_name AS originalName,
        file_type AS fileType,
        size_bytes AS sizeBytes,
        uploaded_at AS uploadedAt,
        caption,
        CAST(horse_log_id AS CHAR) AS horseLogId,
        CAST(incident_id AS CHAR) AS incidentId
      FROM attachments
      WHERE horse_log_id IN (${logIds.map(() => '?').join(',')})
      ORDER BY id ASC`,
      logIds
    );
  }

  // ─── Stage 2: Incidents ────────────────────────────────────────────────────

  async insertIncident(input: {
    tripId: string;
    legId: string | null;
    horseId: string | null;
    incidentType: import('@my-project/shared').IncidentType;
    description: string;
    urgency: import('@my-project/shared').IncidentUrgency;
    severity: import('@my-project/shared').IncidentSeverity;
    subType: string | null;
    damageTarget: import('@my-project/shared').DamageTarget;
    latitude: number | null;
    longitude: number | null;
    locationText: string | null;
    reportedBy: string;
    reportedAt: string;
  }): Promise<string> {
    const result = await this.db.query(
      `INSERT INTO incidents (trip_id, leg_id, horse_id, incident_type, sub_type, severity, damage_target, description, urgency,
        latitude, longitude, location_text, status, reported_by, reported_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', ?, ?)`,
      [input.tripId, input.legId, input.horseId, input.incidentType, input.subType, input.severity, input.damageTarget, input.description,
        input.urgency, input.latitude, input.longitude, input.locationText, input.reportedBy, new Date(input.reportedAt)]
    );
    return String(result.insertId);
  }

  /** Số cứu hộ 24/7 (system_parameters.HOTLINE); chưa cấu hình thì null. */
  async getEmergencyHotline(): Promise<string | null> {
    const [row] = await this.db.query(`SELECT param_value AS value FROM system_parameters WHERE param_code = 'HOTLINE'`);
    const value = typeof row?.value === 'string' ? row.value.trim() : '';
    return value || null;
  }

  async findIncident(incidentId: string): Promise<{
    id: string;
    tripId: string;
    status: import('@my-project/shared').IncidentStatus;
    reportedBy: string;
    plannedBy: string;
    customerId: string;
  } | undefined> {
    const [row] = await this.db.query(
      `SELECT CAST(i.id AS CHAR) AS id,
        CAST(i.trip_id AS CHAR) AS tripId,
        i.status,
        CAST(i.reported_by AS CHAR) AS reportedBy,
        CAST(t.planned_by AS CHAR) AS plannedBy,
        CAST(o.customer_id AS CHAR) AS customerId
      FROM incidents i
      JOIN trips t ON t.id = i.trip_id
      JOIN orders o ON o.id = t.order_id
      WHERE i.id = ? FOR UPDATE OF i`,
      [incidentId]
    );
    return row;
  }

  async updateIncidentStatus(
    incidentId: string,
    status: import('@my-project/shared').IncidentStatus,
    receivedBy: string,
    handlingNote: string | null
  ): Promise<void> {
    const isClosed = status === 'CLOSED';
    await this.db.query(
      `UPDATE incidents
      SET status = ?, received_by = COALESCE(received_by, ?), handling_note = COALESCE(?, handling_note),
        closed_at = ${isClosed ? 'UTC_TIMESTAMP()' : 'NULL'}
      WHERE id = ?`,
      [status, receivedBy, handlingNote, incidentId]
    );
  }

  async getTripIncidents(tripId: string): Promise<import('./tracking.dto').IncidentRow[]> {
    const rows = await this.db.query(
      `SELECT CAST(i.id AS CHAR) AS id,
        CAST(i.trip_id AS CHAR) AS tripId,
        CAST(i.leg_id AS CHAR) AS legId,
        CAST(i.horse_id AS CHAR) AS horseId,
        h.name AS horseName,
        i.incident_type AS incidentType,
        i.description,
        i.urgency,
        i.severity,
        i.sub_type AS subType,
        i.damage_target AS damageTarget,
        i.latitude,
        i.longitude,
        i.location_text AS locationText,
        i.status,
        CAST(i.reported_by AS CHAR) AS reportedBy,
        u1.full_name AS reportedByName,
        i.reported_at AS reportedAt,
        CAST(i.received_by AS CHAR) AS receivedBy,
        i.handling_note AS handlingNote,
        i.closed_at AS closedAt
      FROM incidents i
      LEFT JOIN horses h ON h.id = i.horse_id
      JOIN users u1 ON u1.id = i.reported_by
      WHERE i.trip_id = ?
      ORDER BY i.reported_at ASC, i.id ASC`,
      [tripId]
    );
    // DECIMAL comes back as a string (bigNumberStrings); old incidents have no coordinates.
    return rows.map((row: import('./tracking.dto').IncidentRow) => ({
      ...row, latitude: coordinate(row.latitude), longitude: coordinate(row.longitude),
    }));
  }

  async getIncidentAttachments(incidentIds: string[]): Promise<import('./tracking.dto').AttachmentRow[]> {
    if (!incidentIds.length) return [];
    return this.db.query(
      `SELECT CAST(id AS CHAR) AS id,
        original_name AS originalName,
        file_type AS fileType,
        size_bytes AS sizeBytes,
        uploaded_at AS uploadedAt,
        caption,
        CAST(horse_log_id AS CHAR) AS horseLogId,
        CAST(incident_id AS CHAR) AS incidentId
      FROM attachments
      WHERE incident_id IN (${incidentIds.map(() => '?').join(',')})
      ORDER BY id ASC`,
      incidentIds
    );
  }

  async notifyManagersAndCoordinators(tripId: string, title: string, content: string): Promise<void> {
    await this.db.query(
      `INSERT INTO notifications (recipient_id, event_type, content, related_type, related_id, channel)
      SELECT DISTINCT id, ?, ?, 'TRIP', ?, 'IN_APP'
      FROM users
      WHERE role = 'MANAGER' AND account_status = 'ACTIVE'
         OR id IN (SELECT planned_by FROM trips WHERE id = ?)`,
      [title, content, tripId, tripId]
    );
  }

  // ─── Stage 2: Alerts ───────────────────────────────────────────────────────

  async insertAlert(
    tripId: string,
    alertType: import('@my-project/shared').AlertType,
    content: string,
    sentBy: string,
    sentAt: string
  ): Promise<string> {
    const result = await this.db.query(
      `INSERT INTO alerts (trip_id, alert_type, content, sent_by, sent_at)
      VALUES (?, ?, ?, ?, ?)`,
      [tripId, alertType, content, sentBy, new Date(sentAt)]
    );
    return String(result.insertId);
  }

  async getTripAlerts(tripId: string): Promise<import('./tracking.dto').AlertRow[]> {
    return this.db.query(
      `SELECT CAST(a.id AS CHAR) AS id,
        CAST(a.trip_id AS CHAR) AS tripId,
        a.alert_type AS alertType,
        a.content,
        CAST(a.sent_by AS CHAR) AS sentBy,
        u.full_name AS sentByName,
        a.sent_at AS sentAt
      FROM alerts a
      JOIN users u ON u.id = a.sent_by
      WHERE a.trip_id = ?
      ORDER BY a.sent_at ASC, a.id ASC`,
      [tripId]
    );
  }

  // ─── Attachments link helper ───────────────────────────────────────────────

  async linkAttachmentToHorseLog(attachmentId: string, horseLogId: string): Promise<void> {
    await this.db.query(
      `UPDATE attachments SET horse_log_id = ? WHERE id = ?`,
      [horseLogId, attachmentId]
    );
  }

  async linkAttachmentToIncident(attachmentId: string, incidentId: string): Promise<void> {
    await this.db.query(
      `UPDATE attachments SET incident_id = ? WHERE id = ?`,
      [incidentId, attachmentId]
    );
  }

  async insertAttachmentRecord(
    originalName: string,
    fileType: 'PDF' | 'JPG' | 'PNG',
    sizeBytes: number,
    storagePath: string,
    uploadedBy: string,
    horseLogId: string | null = null,
    incidentId: string | null = null,
    caption: string | null = null
  ): Promise<string> {
    const result = await this.db.query(
      `INSERT INTO attachments (original_name, file_type, size_bytes, storage_path, uploaded_by, horse_log_id, incident_id, caption)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [originalName, fileType, sizeBytes, storagePath, uploadedBy, horseLogId, incidentId, caption]
    );
    return String(result.insertId);
  }

  // ─── Bản đồ chuyến + GPS (kế hoạch Bước 4 + 6) ──────────────────────────────

  /** Chặng kèm tọa độ hai đầu và loại xe (để chọn ROAD/AIR). */
  async getTripMapLegs(tripId: string): Promise<TripMapLegRow[]> {
    return this.db.query(
      `SELECT CAST(l.id AS CHAR) AS id, l.seq_no AS seqNo, l.status,
        l.planned_departure_at AS plannedDepartureAt, l.planned_arrival_at AS plannedArrivalAt,
        l.actual_departure_at AS actualDepartureAt, l.actual_arrival_at AS actualArrivalAt,
        CAST(f.id AS CHAR) AS fromId, f.name AS fromName, f.location_type AS fromType, f.latitude AS fromLat, f.longitude AS fromLng,
        CAST(t.id AS CHAR) AS toId, t.name AS toName, t.location_type AS toType, t.latitude AS toLat, t.longitude AS toLng,
        v.vehicle_type AS vehicleType
      FROM legs l
      JOIN locations f ON f.id = l.from_location_id
      JOIN locations t ON t.id = l.to_location_id
      LEFT JOIN vehicles v ON v.id = l.vehicle_id
      WHERE l.trip_id = ?
      ORDER BY l.seq_no ASC, l.id ASC`,
      [tripId]
    );
  }

  async findRoutes(fromId: string, toId: string): Promise<CachedRoute[]> {
    const rows: { mode: RouteMode; coordinates: unknown; distanceM: number | null; fetchedAt: Date }[] = await this.db.query(
      `SELECT mode, coordinates, distance_m AS distanceM, fetched_at AS fetchedAt
      FROM location_routes WHERE from_location_id = ? AND to_location_id = ?`,
      [fromId, toId]
    );
    // mysql2 trả cột JSON đã parse; một số driver trả chuỗi.
    return rows.map(row => ({ ...row, coordinates: (typeof row.coordinates === 'string' ? JSON.parse(row.coordinates) : row.coordinates) as LngLat[] }));
  }

  async saveRoute(fromId: string, toId: string, route: { mode: RouteMode; coordinates: LngLat[]; distanceM: number | null; durationS: number | null }): Promise<void> {
    await this.db.query(
      `INSERT INTO location_routes (from_location_id, to_location_id, mode, coordinates, distance_m, duration_s, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())
      ON DUPLICATE KEY UPDATE coordinates = VALUES(coordinates), distance_m = VALUES(distance_m), duration_s = VALUES(duration_s), fetched_at = UTC_TIMESTAMP()`,
      [fromId, toId, route.mode, JSON.stringify(route.coordinates), route.distanceM, route.durationS]
    );
  }

  async deleteRoute(fromId: string, toId: string, mode: RouteMode): Promise<void> {
    await this.db.query(`DELETE FROM location_routes WHERE from_location_id = ? AND to_location_id = ? AND mode = ?`, [fromId, toId, mode]);
  }

  /** Giới hạn tốc độ (km/h) từ system_parameters.VMAX; thiếu hoặc không hợp lệ → null. */
  async getSpeedLimitKmh(): Promise<number | null> {
    const [row] = await this.db.query(`SELECT param_value AS value FROM system_parameters WHERE param_code = 'VMAX'`);
    const value = Number(row?.value);
    return Number.isFinite(value) && value > 0 && value <= 300 ? value : null;
  }

  /** Điểm GPS mới nhất của chuyến (bất kỳ thành viên tổ lái nào gửi). */
  async getLatestPosition(tripId: string): Promise<PositionRow | undefined> {
    const [row] = await this.db.query(
      `SELECT CAST(leg_id AS CHAR) AS legId, latitude, longitude, accuracy_m AS accuracyM, speed_mps AS speedMps,
        heading_deg AS headingDeg, recorded_at AS recordedAt
      FROM trip_positions WHERE trip_id = ?
      ORDER BY recorded_at DESC, id DESC LIMIT 1`,
      [tripId]
    );
    return row;
  }

  /** Vệt đường: tối đa `limit` điểm mới nhất sau `since`, trả theo thời gian tăng dần. */
  async getTrackPoints(tripId: string, since: Date | null, limit: number): Promise<PositionRow[]> {
    const rows: PositionRow[] = await this.db.query(
      `SELECT CAST(leg_id AS CHAR) AS legId, latitude, longitude, accuracy_m AS accuracyM, speed_mps AS speedMps,
        heading_deg AS headingDeg, recorded_at AS recordedAt
      FROM trip_positions WHERE trip_id = ? AND (? IS NULL OR recorded_at > ?)
      ORDER BY recorded_at DESC, id DESC LIMIT ?`,
      [tripId, since, since, limit]
    );
    return rows.reverse();
  }

  /** Ghi lô vị trí; trùng (trip, người gửi, recorded_at) thì bỏ qua. Trả số dòng thực sự thêm. */
  async insertPositions(tripId: string, legId: string, userId: string, points: {
    latitude: number; longitude: number; accuracyM: number | null; speedMps: number | null; headingDeg: number | null; recordedAt: Date;
  }[]): Promise<number> {
    if (!points.length) return 0;
    const result = await this.db.query(
      `INSERT IGNORE INTO trip_positions (trip_id, leg_id, user_id, latitude, longitude, accuracy_m, speed_mps, heading_deg, recorded_at)
      VALUES ${points.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
      points.flatMap(p => [tripId, legId, userId, p.latitude, p.longitude, p.accuracyM, p.speedMps, p.headingDeg, p.recordedAt])
    );
    return Number(result.affectedRows ?? 0);
  }

  /** Xóa vị trí cũ hơn `days` ngày theo từng lô để không khóa bảng lâu. Trả số dòng đã xóa trong lô. */
  async deletePositionsOlderThan(days: number, batch: number): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM trip_positions WHERE recorded_at < UTC_TIMESTAMP() - INTERVAL ? DAY ORDER BY recorded_at LIMIT ?`,
      [days, batch]
    );
    return Number(result.affectedRows ?? 0);
  }
}
