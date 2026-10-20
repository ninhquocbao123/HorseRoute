import { parse } from '../../shared/utils/validation.util';
import { tripIdSchema, tripPlanSchema, submitTripPlanSchema, TripPlanInput, reviewTripPlanSchema, tripAssignmentsSchema } from './trips.validation';
import { Role } from '@my-project/shared';
import { User } from '../users/users.model';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '../../shared/core/error.response';
import { PaginationDto } from '../../shared/utils/pagination.util';
import { TripDetail, TripList, TripPlanOptions, TripSummary, TripAssignments } from './trips.dto';
import { checkCrewReadiness } from './trips.crew';
import { TripsRepository, TripRow, TripScope } from './trips.repository';

function scope(account: Pick<User, 'id' | 'role'>): TripScope {
  if (account.role === Role.COORDINATOR) return { coordinatorId: account.id };
  if (account.role === Role.MANAGER) return { manager: true };
  throw new ForbiddenException('Không đủ quyền');
}
// MySQL DataSource uses timezone Z. BIGINT columns are cast to CHAR in SQL before JS receives them.
function summary(row: TripRow): TripSummary {
  return { id: row.id, orderId: row.orderId, orderCode: row.orderCode, planStatus: row.planStatus,
    plannedBy: row.plannedBy, plannedDepartureAt: row.plannedDepartureAt?.toISOString() ?? null,
    plannedArrivalAt: row.plannedArrivalAt?.toISOString() ?? null };
}
export class TripsService {
  constructor(private readonly repository: TripsRepository) {}
  async savePlan(account: User, rawId: string, body: unknown): Promise<TripDetail> {
    if (account.role !== Role.COORDINATOR) throw new ForbiddenException('Chỉ Coordinator phụ trách được lưu kế hoạch.');
    const id = parse(tripIdSchema, rawId), input = parse(tripPlanSchema, body);
    return this.repository.transaction(async repo => {
      const { existing } = await this.lockEditablePlan(repo, account, id);
      const invalid = (field: string, message: string): never => {
        throw new BadRequestException({ message: 'Vui lòng kiểm tra kế hoạch.', fields: { [field]: message } });
      };
      if (input.legs.length < existing.length) invalid('legs', 'Phải gửi đầy đủ chặng cũ đúng thứ tự.');
      input.legs.forEach((leg, index) => {
        if (index < existing.length ? leg.id !== existing[index].id : leg.id !== undefined) {
          invalid(`legs.${index}.id`, 'Giữ đủ ID chặng cũ đúng thứ tự; chặng mới không có ID và chỉ thêm cuối.');
        }
      });
      await this.validateCatalog(repo, input);
      const service = new TripsService(repo);
      const before = await service.detail(account, id);
      let nextSeq = existing.length ? existing[existing.length - 1].seqNo + 1 : 1;
      if (nextSeq + input.legs.length - existing.length - 1 > 2147483647) throw new ConflictException('Số thứ tự chặng vượt giới hạn.');
      for (let index = 0; index < input.legs.length; index++) {
        const leg = input.legs[index];
        await repo.writeLeg(id, account.id, leg, index < existing.length ? existing[index].seqNo : nextSeq++);
      }
      await repo.updatePlanTimes(id, input.legs[0].plannedDepartureAt, input.legs[input.legs.length - 1].plannedArrivalAt);
      const after = await service.detail(account, id);
      // Compact plan-only snapshots fit audit TEXT even at 50 legs with long location names.
      const snapshot = (detail: TripDetail) => JSON.stringify({ id: detail.id, planStatus: detail.planStatus,
        plannedDepartureAt: detail.plannedDepartureAt, plannedArrivalAt: detail.plannedArrivalAt,
        legs: detail.legs.map(l => ({ id: l.id, seqNo: l.seqNo, fromLocationId: l.fromLocationId, toLocationId: l.toLocationId,
          vehicleId: l.vehicleId, plannedDepartureAt: l.plannedDepartureAt, plannedArrivalAt: l.plannedArrivalAt })) });
      await repo.audit(account.id, id, snapshot(before), snapshot(after));
      return after;
    });
  }
  private async lockEditablePlan(repo: TripsRepository, account: User, id: string) {
    // Probe only to locate the Order. Recheck the association and owner after locking.
    const orderId = await repo.orderId(id);
    if (!orderId) throw new NotFoundException('Không tìm thấy chuyến.');
    const order = await repo.lockOrder(orderId);
    const trip = await repo.lockTrip(id);
    if (!trip || trip.plannedBy !== account.id) throw new NotFoundException('Không tìm thấy chuyến.');
    if (!order || trip.orderId !== orderId) throw new ConflictException('Đơn của chuyến đã thay đổi. Vui lòng tải lại.');
    if (trip.planStatus !== 'DRAFT' || !['APPROVED', 'PREPARING'].includes(order.status)) {
      throw new ConflictException('Chỉ được sửa Trip DRAFT khi đơn hàng APPROVED hoặc PREPARING.');
    }
    const existing = await repo.lockLegs(id);
    if (existing.some(l => l.status !== 'NOT_STARTED' || l.actualDepartureAt || l.actualArrivalAt) || await repo.hasHistory(id)) {
      throw new ConflictException('Chuyến đã có dữ liệu vận hành, không được sửa kế hoạch nháp.');
    }
    return { orderId, order, existing };
  }
  private async validateCatalog(repo: TripsRepository, input: TripPlanInput, exclusiveVehicles = false) {
    const invalid = (field: string, message: string): never => {
      throw new BadRequestException({ message: 'Vui lòng kiểm tra kế hoạch.', fields: { [field]: message } });
    };
    // Lock catalogs in deterministic ID order, retaining their validity until commit.
    const sortIds = (ids: string[]) => [...new Set(ids)].sort((a, b) => a.length - b.length || a.localeCompare(b));
    const locations = new Map<string, boolean>(), vehicles = new Map<string, boolean>();
    for (const location of sortIds(input.legs.flatMap(l => [l.fromLocationId, l.toLocationId]))) locations.set(location, await repo.lockLocation(location));
    for (const vehicle of sortIds(input.legs.map(l => l.vehicleId))) vehicles.set(vehicle, await repo.lockActiveVehicle(vehicle, exclusiveVehicles));
    input.legs.forEach((leg, index) => {
      for (const field of ['fromLocationId', 'toLocationId'] as const) if (!locations.get(leg[field])) invalid(`legs.${index}.${field}`, 'Địa điểm không tồn tại.');
      if (!vehicles.get(leg.vehicleId)) invalid(`legs.${index}.vehicleId`, 'Xe không tồn tại hoặc không còn active.');
    });
  }
  async submitPlan(account: User, rawId: string, body: unknown): Promise<TripDetail> {
    if (account.role !== Role.COORDINATOR) throw new ForbiddenException('Chỉ Coordinator phụ trách được gửi kế hoạch.');
    const id = parse(tripIdSchema, rawId);
    parse(submitTripPlanSchema, body);
    return this.repository.transaction(async repo => {
      const { orderId, order, existing } = await this.lockEditablePlan(repo, account, id);
      const service = new TripsService(repo);
      const detail = await service.detail(account, id);
      await this.validateStoredPlan(repo, detail, existing.length, orderId, false);
      await repo.submitPlan(id, orderId);
      await repo.auditSubmission(account.id, id, orderId, order.status);
      await repo.notifyPlanManagers(id);
      return service.detail(account, id);
    });
  }
  private async validateStoredPlan(repo: TripsRepository, detail: TripDetail, existingCount: number, orderId: string, approval: boolean) {
    // A broken catalog JOIN must not silently omit stored legs during submission.
    if (detail.legs.length !== existingCount || !existingCount) {
      throw new ConflictException('Kế hoạch chưa có chặng hoặc thiếu dữ liệu địa điểm.');
    }
    const checked = tripPlanSchema.safeParse({ legs: detail.legs.map(leg => ({
      id: leg.id, fromLocationId: leg.fromLocationId, toLocationId: leg.toLocationId,
      vehicleId: leg.vehicleId, plannedDepartureAt: leg.plannedDepartureAt, plannedArrivalAt: leg.plannedArrivalAt,
    })) });
    if (!checked.success) throw new ConflictException('Kế hoạch đã lưu chưa hợp lệ. Vui lòng sửa xe, tuyến và ngày giờ trước khi gửi.');
    const input = checked.data;
    if (detail.plannedDepartureAt !== detail.legs[0].plannedDepartureAt || detail.plannedArrivalAt !== detail.legs[detail.legs.length - 1].plannedArrivalAt) {
      throw new ConflictException('Thời gian Trip không khớp chặng đầu/cuối. Vui lòng lưu lại kế hoạch.');
    }
    try { await this.validateCatalog(repo, input, approval); }
    catch (error) {
      if (error instanceof BadRequestException) throw new ConflictException(error.getResponse());
      throw error;
    }
    if (input.legs.some(leg => Date.parse(leg.plannedArrivalAt) <= Date.parse(leg.plannedDepartureAt))) {
      throw new ConflictException('Mỗi chặng gửi duyệt phải có giờ đến sau giờ đi.');
    }
    if (approval) await repo.lockTransportHorses(orderId);
    const horseCount = await repo.normalHorseCount(orderId);
    if (!horseCount) throw new ConflictException('Đơn chưa có ngựa NORMAL để vận chuyển.');
    for (const leg of input.legs) {
      // Exclusive vehicle locks serialize approvals; READ COMMITTED sees the winner after waiting.
      if (approval && await repo.vehicleStillOperating(detail.id, leg.vehicleId)) throw new ConflictException('Xe còn đang vận hành ở chuyến khác, chưa thể xác nhận khả dụng.');
      const capacity = await repo.vehicleCapacity(leg.vehicleId);
      if (capacity === undefined || capacity < horseCount) throw new ConflictException('Xe không đủ sức chứa cho toàn bộ ngựa NORMAL của đơn.');
      if (await repo.vehicleOverlaps(detail.id, leg.vehicleId, leg.plannedDepartureAt, leg.plannedArrivalAt)) {
        throw new ConflictException('Xe trùng lịch với kế hoạch đã được duyệt.');
      }
    }
  }
  async reviewPlan(account: User, rawId: string, body: unknown): Promise<TripDetail> {
    if (account.role !== Role.MANAGER) throw new ForbiddenException('Chỉ Manager được duyệt hoặc trả lại kế hoạch.');
    const id = parse(tripIdSchema, rawId), input = parse(reviewTripPlanSchema, body);
    return this.repository.transaction(async repo => {
      const orderId = await repo.orderId(id);
      if (!orderId) throw new NotFoundException('Không tìm thấy chuyến.');
      const order = await repo.lockOrder(orderId);
      const trip = await repo.lockTrip(id);
      if (!trip) throw new NotFoundException('Không tìm thấy chuyến.');
      if (!order || trip.orderId !== orderId) throw new ConflictException('Đơn của chuyến đã thay đổi.');
      if (trip.planStatus !== 'PENDING_APPROVAL' || !['APPROVED', 'PREPARING'].includes(order.status)) {
        throw new ConflictException('Chỉ xử lý kế hoạch PENDING_APPROVAL của đơn APPROVED/PREPARING.');
      }
      const existing = await repo.lockLegs(id);
      if (existing.some(l => l.status !== 'NOT_STARTED' || l.actualDepartureAt || l.actualArrivalAt) || await repo.hasHistory(id)) {
        throw new ConflictException('Chuyến đã có dữ liệu vận hành, không được duyệt hoặc trả lại kế hoạch.');
      }
      const service = new TripsService(repo), before = await service.detail(account, id);
      // Return must remain possible for empty/invalid plans; approval must validate every stored leg again.
      if (input.decision === 'APPROVED') await this.validateStoredPlan(repo, before, existing.length, orderId, true);
      await repo.reviewPlan(id, account.id, input);
      if (input.decision === 'APPROVED' && checkCrewReadiness(await repo.assignments(id)).complete) {
        const markedReady = await repo.markOrderReady(orderId);
        if (markedReady) {
          await repo.auditOrderReady(account.id, orderId, id, order.status);
          await repo.notifyOrderReady(orderId, id);
        }
      }
      const after = await service.detail(account, id);
      const reviewSnapshot = (detail: TripDetail) => JSON.stringify({ planStatus: detail.planStatus,
        orderStatus: detail.orderStatus, approvedBy: detail.approvedBy, approvedAt: detail.approvedAt, returnReason: detail.returnReason });
      const reason = input.decision === 'RETURNED' ? input.reason : null;
      await repo.auditReview(account.id, id, reviewSnapshot(before), reviewSnapshot(after), reason);
      await repo.notifyPlanCoordinator(id, trip.plannedBy, input.decision, reason);
      return after;
    });
  }
  async assignmentOptions(account: User, id: string) {
    await this.accessible(account, id);
    return { items: await this.repository.assignmentOptions() };
  }
  async assignments(account: User, id: string): Promise<TripAssignments> {
    await this.accessible(account, id);
    const rows = await this.repository.assignments(id);
    return { tripId: id, items: rows.map(row => ({ id: row.id, userId: row.userId, fullName: row.fullName,
      role: row.role, assignedBy: row.assignedBy, assignedAt: row.assignedAt.toISOString() })), crewReadiness: checkCrewReadiness(rows) };
  }
  async saveAssignments(account: User, rawId: string, body: unknown): Promise<TripAssignments> {
    if (account.role !== Role.COORDINATOR) throw new ForbiddenException('Chỉ Coordinator phụ trách được phân công.');
    const id = parse(tripIdSchema, rawId), input = parse(tripAssignmentsSchema, body);
    return this.repository.transaction(async repo => {
      const orderId = await repo.orderId(id);
      if (!orderId) throw new NotFoundException('Không tìm thấy chuyến.');
      const order = await repo.lockOrder(orderId), trip = await repo.lockTrip(id);
      if (!trip || trip.plannedBy !== account.id) throw new NotFoundException('Không tìm thấy chuyến.');
      if (!order || trip.orderId !== orderId) throw new ConflictException('Đơn của chuyến đã thay đổi.');
      if (!['APPROVED', 'PREPARING'].includes(order.status)) throw new ConflictException('Chỉ phân công khi Order APPROVED/PREPARING.');
      const legs = await repo.lockLegs(id);
      if (legs.some(l => l.status !== 'NOT_STARTED' || l.actualDepartureAt || l.actualArrivalAt) || await repo.hasHistory(id)) {
        throw new ConflictException('Chuyến đã có dữ liệu vận hành, không được đổi phân công.');
      }
      // Trip lock serializes replacements. Lock the union of old/new users before assignment rows.
      const before = await repo.assignments(id);
      const ids = [...new Set([...before.map(a => a.userId), ...input.assignments.map(a => a.userId)])]
        .sort((a, b) => a.length - b.length || a.localeCompare(b));
      const users = new Map<string, { role: string; accountStatus: string } | undefined>();
      for (const userId of ids) users.set(userId, await repo.lockCrewUser(userId));
      await repo.lockAssignments(id);
      input.assignments.forEach((a, index) => {
        const user = users.get(a.userId);
        if (!user || user.role !== 'DRIVER_ESCORT' || user.accountStatus !== 'ACTIVE') {
          throw new BadRequestException({ message: 'Nhân sự phân công không hợp lệ.', fields: { [`assignments.${index}.userId`]: 'Chọn tài khoản DRIVER_ESCORT đang ACTIVE.' } });
        }
      });
      const oldByUser = new Map(before.map(a => [a.userId, a]));
      const wanted = new Map(input.assignments.map(a => [a.userId, a.role]));
      const changes: { userId: string; role: string | null }[] = [];
      for (const old of before) if (!wanted.has(old.userId)) {
        await repo.deleteAssignment(old.id); changes.push({ userId: old.userId, role: null });
      }
      for (const assignment of input.assignments) {
        const old = oldByUser.get(assignment.userId);
        if (!old) await repo.insertAssignment(id, assignment.userId, assignment.role, account.id);
        else if (old.role !== assignment.role) await repo.updateAssignment(old.id, assignment.role, account.id);
        else continue;
        changes.push(assignment);
      }
      const after = await new TripsService(repo).assignments(account, id);
      if (changes.length) {
        // Snapshot identifiers and assignment facts, avoiding long names overflowing audit TEXT.
        const snapshot = (rows: { id: string; userId: string; role: string; assignedBy: string; assignedAt: Date | string }[]) => JSON.stringify(rows.map(a => ({ id: a.id, userId: a.userId, role: a.role, assignedBy: a.assignedBy, assignedAt: a.assignedAt })));
        await repo.auditCrew(account.id, id, snapshot(before), snapshot(after.items));
        for (const change of changes) await repo.notifyCrew(id, change.userId, change.role);
      }
      if (trip.planStatus === 'APPROVED' && after.crewReadiness.complete) {
        const markedReady = await repo.markOrderReady(orderId);
        if (markedReady) {
          await repo.auditOrderReady(account.id, orderId, id, order.status);
          await repo.notifyOrderReady(orderId, id);
        }
      }
      return after;
    });
  }
  async list(account: User, query: PaginationDto): Promise<TripList> {
    const { rows, total } = await this.repository.list(scope(account), query.limit, (query.page - 1) * query.limit);
    return { items: rows.map(summary), total, page: query.page, limit: query.limit };
  }
  private async accessible(account: User, id: string) {
    const row = await this.repository.find(scope(account), id);
    if (!row) throw new NotFoundException('Không tìm thấy chuyến.');
    return row;
  }
  async detail(account: User, id: string): Promise<TripDetail> {
    const row = await this.accessible(account, id);
    const legs = await this.repository.legs(id);
    return { ...summary(row), orderStatus: row.orderStatus, approvedBy: row.approvedBy ?? null,
      approvedAt: row.approvedAt?.toISOString() ?? null, returnReason: row.returnReason ?? null, legs: legs.map(leg => ({
      id: leg.id, seqNo: leg.seqNo, fromLocationId: leg.fromLocationId, fromLocationName: leg.fromLocationName,
      toLocationId: leg.toLocationId, toLocationName: leg.toLocationName, vehicleId: leg.vehicleId,
      vehicleCode: leg.vehicleCode, vehicleActive: leg.vehicleActive === null ? null : Boolean(leg.vehicleActive),
      plannedDepartureAt: leg.plannedDepartureAt.toISOString(), plannedArrivalAt: leg.plannedArrivalAt.toISOString(), status: leg.status,
    })) };
  }
  async planOptions(account: User, id: string): Promise<TripPlanOptions> {
    await this.accessible(account, id);
    const [locations, vehicles] = await Promise.all([this.repository.locations(), this.repository.vehicles()]);
    return {
      locations: locations.map(l => ({ id: l.id, name: l.name, locationType: l.locationType, country: l.country, timezone: l.timezone, address: l.address })),
      vehicles: vehicles.map(v => ({ id: v.id, plateOrCode: v.plateOrCode, vehicleType: v.vehicleType, capacityStalls: v.capacityStalls, isActive: true })),
    };
  }
}
