import { DataSource, EntityManager } from 'typeorm';
import { z } from 'zod';
import { Role } from '@my-project/shared';
import { User } from '../users/users.model';
import { TripsRepository } from '../trips/trips.repository';
import { checkCrewReadiness } from '../trips/trips.crew';
import { requirementsSchema } from './requirements';
import { verifyStoredFile } from '../documents/file-storage';
import { ConflictException, ForbiddenException, NotFoundException } from '../../shared/core/error.response';
import { parse } from '../../shared/utils/validation.util';

export type ReadinessBlocker = { code: string; message: string; horseId?: string; documentId?: string; dossierId?: string; legId?: string; userId?: string };
export type Readiness = { tripId: string; orderId: string; orderStatus: string; planStatus: string; eligibleForReady: boolean; blockers: ReadinessBlocker[] };
type Row = Record<string, any>;
type Evidence = Map<string, boolean>;
const sorted = (ids: string[]) => [...new Set(ids)].sort((a, b) => a.length - b.length || a.localeCompare(b));
const millis = (value: unknown) => value instanceof Date ? value.getTime() : NaN;

export class ReadinessService {
  constructor(private readonly db: DataSource, private readonly verify = verifyStoredFile) {}
  private allowed(user: User, managerOnly = false) {
    if (user.role !== Role.MANAGER && (managerOnly || user.role !== Role.COORDINATOR)) throw new ForbiddenException();
  }
  private async trip(m: EntityManager, user: User, id: string) {
    const repo = new TripsRepository(m);
    const trip = await repo.find(user.role === Role.MANAGER ? { manager: true } : { coordinatorId: String(user.id) }, id);
    if (!trip) throw new NotFoundException('Không tìm thấy chuyến.');
    return trip;
  }
  async readiness(user: User, id: string): Promise<Readiness> {
    this.allowed(user);
    // Consistent read only. In particular, do not call Documents.detail/expireOrder.
    return this.db.transaction('REPEATABLE READ', m => this.evaluate(m, user, id, new Map(), true));
  }
  async markReady(user: User, orderId: string, body: unknown): Promise<{ orderId: string; tripId: string; orderStatus: 'READY'; planStatus: string }> {
    this.allowed(user, true);
    parse(z.object({}).strict(), body);
    const [probe] = await this.db.query('SELECT CAST(id AS CHAR) AS id FROM trips WHERE order_id=?', [orderId]);
    if (!probe) throw new NotFoundException('Không tìm thấy chuyến của đơn.');
    // External storage is not transactional. Verify immutable keys outside row locks;
    // the locked evaluation below must match the same key AND size, otherwise fail closed.
    const evidence: Evidence = new Map();
    await this.db.transaction('REPEATABLE READ', m => this.evaluate(m, user, probe.id, evidence, true));
    return this.db.transaction('READ COMMITTED', async m => {
      const repo = new TripsRepository(m);
      const order = await repo.lockOrder(orderId);
      const trip = await repo.lockTrip(probe.id);
      if (!order || !trip || trip.orderId !== orderId) throw new NotFoundException('Không tìm thấy chuyến của đơn.');
      await repo.lockLegs(probe.id);
      const legs = await repo.legs(probe.id);
      // Same resource order as plan review: locations -> vehicles -> horses.
      for (const id of sorted(legs.flatMap(l => [l.fromLocationId, l.toLocationId]))) await repo.lockLocation(id);
      for (const id of sorted(legs.flatMap(l => l.vehicleId ? [l.vehicleId] : []))) await repo.lockActiveVehicle(id, true);
      await repo.lockTransportHorses(orderId);
      const crew = await repo.assignments(probe.id);
      for (const id of sorted(crew.map(a => a.userId))) await repo.lockCrewUser(id);
      await repo.lockAssignments(probe.id);
      for (const table of ['documents', 'dossiers']) {
        await m.query(`SELECT d.id FROM ${table} d JOIN horses h ON h.id=d.horse_id WHERE h.order_id=? ORDER BY d.id FOR UPDATE`, [orderId]);
      }
      await m.query(`SELECT v.id FROM document_versions v JOIN documents d ON d.id=v.document_id
        JOIN horses h ON h.id=d.horse_id WHERE h.order_id=? ORDER BY v.id FOR SHARE`, [orderId]);
      const attachments: { id: string }[] = await m.query(`SELECT CAST(a.id AS CHAR) AS id FROM attachments a WHERE
        a.id IN (SELECT v.attachment_id FROM document_versions v JOIN documents d ON d.id=v.document_id JOIN horses h ON h.id=d.horse_id WHERE h.order_id=?)
        OR a.id IN (SELECT d.permit_attachment_id FROM dossiers d JOIN horses h ON h.id=d.horse_id WHERE h.order_id=?) ORDER BY a.id`, [orderId, orderId]);
      for (const attachment of attachments) await m.query('SELECT id FROM attachments WHERE id=? FOR SHARE', [attachment.id]);
      const result = await this.evaluate(m, user, probe.id, evidence, false);
      if (!result.eligibleForReady) throw new ConflictException({ message: 'Đơn chưa đủ điều kiện chuyển READY.', blockers: result.blockers });
      await m.query("UPDATE orders SET status='READY' WHERE id=?", [orderId]);
      await m.query(`INSERT INTO audit_logs(actor_id,entity_type,entity_id,action,old_value,new_value)
        VALUES (?,'ORDER',?,'MARK_READY',?,?)`, [user.id, orderId, JSON.stringify({ status: order.status }), JSON.stringify({ status: 'READY', tripId: probe.id })]);
      await m.query(`INSERT INTO notifications(recipient_id,event_type,content,related_type,related_id,channel)
        SELECT id,'ORDER_READY',?,'ORDER',?,'IN_APP' FROM users WHERE id IN
        (SELECT customer_id FROM orders WHERE id=? UNION SELECT planned_by FROM trips WHERE id=? UNION SELECT user_id FROM trip_assignments WHERE trip_id=?)`,
      [`Đơn ${orderId} đã sẵn sàng. Cần kiểm tra lại điều kiện trước khởi hành.`, orderId, orderId, probe.id, probe.id]);
      return { orderId, tripId: probe.id, orderStatus: 'READY', planStatus: result.planStatus };
    });
  }
  private async evaluate(m: EntityManager, user: User, id: string, evidence: Evidence, inspectStorage: boolean): Promise<Readiness> {
    const trip = await this.trip(m, user, id), repo = new TripsRepository(m);
    const blockers: ReadinessBlocker[] = [];
    const add = (code: string, message: string, ids: Omit<ReadinessBlocker, 'code' | 'message'> = {}) => blockers.push({ code, message, ...ids });
    if (!['APPROVED', 'PREPARING'].includes(trip.orderStatus)) add('ORDER_NOT_PREPARING', 'Đơn phải ở APPROVED hoặc PREPARING để chuyển READY.');
    if (trip.planStatus !== 'APPROVED' || !trip.approvedBy || !trip.approvedAt) add('PLAN_NOT_APPROVED', 'Kế hoạch chưa được duyệt đầy đủ.');
    const horses: Row[] = await m.query('SELECT CAST(id AS CHAR) AS id,order_status AS status FROM horses WHERE order_id=? ORDER BY id', [trip.orderId]);
    const normal = horses.filter(h => h.status === 'NORMAL');
    if (!normal.length) add('NO_TRANSPORT_HORSES', 'Chưa có ngựa NORMAL để vận chuyển.');
    for (const horse of horses.filter(h => h.status === 'FLAGGED')) add('HORSE_FLAGGED', 'Cần xử lý ngựa bị đánh dấu.', { horseId: horse.id });
    const legs = await repo.legs(id);
    if (!legs.length) add('NO_LEGS', 'Kế hoạch chưa có chặng.');
    for (const [index, leg] of legs.entries()) {
      const before = legs[index - 1], departure = millis(leg.plannedDepartureAt), arrival = millis(leg.plannedArrivalAt);
      if (leg.seqNo !== index + 1 || leg.fromLocationId === leg.toLocationId || !Number.isFinite(departure) || !Number.isFinite(arrival) || arrival <= departure ||
        (before && (before.toLocationId !== leg.fromLocationId || millis(before.plannedArrivalAt) > departure))) add('INVALID_LEG', 'Chặng sai tuyến, thứ tự hoặc thời gian.', { legId: leg.id });
      if (!leg.vehicleId || !leg.vehicleActive) add('VEHICLE_INACTIVE', 'Chặng thiếu xe hoặc xe không active.', { legId: leg.id });
      if (leg.vehicleId) {
        const capacity = await repo.vehicleCapacity(leg.vehicleId);
        if (capacity === undefined || capacity < normal.length) add('VEHICLE_CAPACITY', 'Xe không đủ chỗ cho ngựa NORMAL.', { legId: leg.id });
        if (Number.isFinite(departure) && Number.isFinite(arrival) &&
          (await repo.vehicleOverlaps(id, leg.vehicleId, leg.plannedDepartureAt.toISOString(), leg.plannedArrivalAt.toISOString()) || await repo.vehicleStillOperating(id, leg.vehicleId))) {
          add('VEHICLE_CONFLICT', 'Xe trùng lịch hoặc còn đang vận hành chuyến khác.', { legId: leg.id });
        }
      }
    }
    if (legs.length && (millis(trip.plannedDepartureAt) !== millis(legs[0].plannedDepartureAt) || millis(trip.plannedArrivalAt) !== millis(legs[legs.length - 1].plannedArrivalAt))) add('PLAN_TIME_MISMATCH', 'Thời gian Trip không khớp chặng đầu/cuối.');
    const [history] = await m.query(`SELECT
      EXISTS(SELECT 1 FROM legs WHERE trip_id=? AND (status<>'NOT_STARTED' OR actual_departure_at IS NOT NULL OR actual_arrival_at IS NOT NULL)) OR
      EXISTS(SELECT 1 FROM leg_milestones x JOIN legs l ON l.id=x.leg_id WHERE l.trip_id=?) OR
      EXISTS(SELECT 1 FROM horse_logs x JOIN legs l ON l.id=x.leg_id WHERE l.trip_id=?) OR
      EXISTS(SELECT 1 FROM incidents x LEFT JOIN legs l ON l.id=x.leg_id WHERE x.trip_id=? OR l.trip_id=?) AS present`, [id, id, id, id, id]);
    if (Number(history.present) === 1) add('OPERATION_STARTED', 'Chuyến đã có vận hành hoặc lịch sử tham chiếu.');
    blockers.push(...checkCrewReadiness(await repo.assignments(id)).blockers);
    const [order] = await m.query('SELECT requirements_snapshot AS snapshot FROM orders WHERE id=?', [trip.orderId]);
    let snapshot: unknown = order.snapshot;
    if (typeof snapshot === 'string') { try { snapshot = JSON.parse(snapshot); } catch { snapshot = null; } }
    const requirements = requirementsSchema.safeParse(snapshot);
    if (!requirements.success) add('REQUIREMENTS_UNVERIFIED', 'Đơn chưa có bản chụp yêu cầu tại thời điểm duyệt; cần đối soát dữ liệu cũ, không tự suy ra từ quy định hiện tại.');
    const documents: Row[] = await m.query(`SELECT CAST(d.id AS CHAR) AS id,CAST(d.horse_id AS CHAR) AS horseId,
      CAST(d.document_type_id AS CHAR) AS typeId,d.status,DATE_FORMAT(d.expiry_date,'%Y-%m-%d') AS expiry,
      d.reviewed_by,d.reviewed_at,v.uploaded_at AS uploadedAt,CAST(v.id AS CHAR) AS versionId,a.storage_path AS storageKey,CAST(a.size_bytes AS CHAR) AS size
      FROM documents d JOIN horses h ON h.id=d.horse_id LEFT JOIN document_versions v ON v.document_id=d.id
      AND v.version_no=(SELECT MAX(v2.version_no) FROM document_versions v2 WHERE v2.document_id=d.id)
      LEFT JOIN attachments a ON a.id=v.attachment_id WHERE h.order_id=?`, [trip.orderId]);
    const dossiers: Row[] = await m.query(`SELECT CAST(d.id AS CHAR) AS id,CAST(d.horse_id AS CHAR) AS horseId,
      CAST(d.authority_id AS CHAR) AS authorityId,d.status,a.storage_path AS storageKey,CAST(a.size_bytes AS CHAR) AS size
      FROM dossiers d JOIN horses h ON h.id=d.horse_id LEFT JOIN attachments a ON a.id=d.permit_attachment_id WHERE h.order_id=?`, [trip.orderId]);
    const [clock] = await m.query("SELECT DATE_FORMAT(UTC_DATE(),'%Y-%m-%d') AS today");
    const arrivalDate = trip.plannedArrivalAt?.toISOString().slice(0, 10);
    const fileValid = async (row: Row) => {
      if (!row.storageKey || !row.size) return false;
      const key = JSON.stringify([row.storageKey, row.size]);
      if (inspectStorage && !evidence.has(key)) {
        try { evidence.set(key, await this.verify(row.storageKey, row.size)); } catch { evidence.set(key, false); }
      }
      return evidence.get(key) === true;
    };
    if (requirements.success) for (const horse of normal) {
      const expected = requirements.data.horses.find(h => h.horseId === horse.id);
      if (!expected) { add('REQUIREMENTS_UNVERIFIED', 'Ngựa không có trong bản chụp yêu cầu đã duyệt.', { horseId: horse.id }); continue; }
      for (const type of expected.documents) {
        const document = documents.find(d => d.horseId === horse.id && d.typeId === type.documentTypeId);
        if (!document) { add('DOCUMENT_MISSING', 'Thiếu giấy tờ bắt buộc.', { horseId: horse.id }); continue; }
        const ids = { horseId: horse.id, documentId: document.id };
        if (document.status !== 'VALID' || !document.reviewed_by || !document.reviewed_at || (document.uploadedAt && millis(document.uploadedAt) > millis(document.reviewed_at))) add('DOCUMENT_NOT_VALID', 'Giấy tờ chưa được xác nhận VALID.', ids);
        if (type.hasExpiry && !document.expiry) add('DOCUMENT_EXPIRY_MISSING', 'Giấy tờ bắt buộc có hạn sử dụng.', ids);
        if (document.expiry && (document.expiry < clock.today || (arrivalDate && document.expiry < arrivalDate))) add('DOCUMENT_EXPIRED', 'Giấy tờ đã hết hạn hoặc hết hạn trước ngày đến dự kiến (UTC).', ids);
        if (!document.versionId || !await fileValid(document)) add('DOCUMENT_FILE_UNVERIFIED', 'Không xác minh được file thật của phiên bản giấy tờ mới nhất.', ids);
      }
      for (const authorityId of expected.authorityIds) {
        const dossier = dossiers.find(d => d.horseId === horse.id && d.authorityId === authorityId);
        if (!dossier) { add('DOSSIER_MISSING', 'Thiếu hồ sơ cơ quan bắt buộc.', { horseId: horse.id }); continue; }
        const ids = { horseId: horse.id, dossierId: dossier.id };
        if (dossier.status !== 'APPROVED') add('DOSSIER_NOT_APPROVED', 'Hồ sơ cơ quan chưa APPROVED.', ids);
        if (!await fileValid(dossier)) add('PERMIT_FILE_UNVERIFIED', 'Không xác minh được file giấy phép thật.', ids);
      }
    }
    return { tripId: id, orderId: trip.orderId, orderStatus: trip.orderStatus, planStatus: trip.planStatus, eligibleForReady: blockers.length === 0, blockers };
  }
}
