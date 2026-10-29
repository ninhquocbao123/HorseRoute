import { tripFleetSchema, TripFleetInput } from './trip-fleet.schema';
import { parse } from '../../shared/utils/validation.util';
import { isSameVietnamCalendarDate, legacyTripPlanSchema, tripIdSchema, tripPlanSchema, submitTripPlanSchema, LegacyTripPlanInput, reviewTripPlanSchema, tripAssignmentsSchema, routePlanWriteSchema, routePreviewSchema } from './trips.validation';
import { Role } from '@my-project/shared';
import { User } from '../users/users.model';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '../../shared/core/error.response';
import { PaginationDto } from '../../shared/utils/pagination.util';
import { TripDetail, TripList, TripPlanOptions, TripSummary, TripAssignments } from './trips.dto';
import { checkCrewReadiness } from './trips.crew';
import { TripsRepository, TripRow, TripScope } from './trips.repository';
import { routeInputKey, routePlanSchema, verifyRouteToken } from './trip-route-plan';
import { previewRoutes } from './trip-map-provider';

function scope(account: Pick<User, 'id' | 'role'>): TripScope {
  if (account.role === Role.COORDINATOR) return { coordinatorId: account.id };
  if (account.role === Role.MANAGER) return { manager: true };
  throw new ForbiddenException('Không đủ quyền');
}
// MySQL DataSource uses timezone Z. BIGINT columns are cast to CHAR in SQL before JS receives them.
function summary(row: Pick<TripRow, 'id' | 'orderId' | 'orderCode' | 'planStatus' | 'plannedBy' | 'plannedDepartureAt' | 'plannedArrivalAt'>): TripSummary {
  return { id: row.id, orderId: row.orderId, orderCode: row.orderCode, planStatus: row.planStatus,
    plannedBy: row.plannedBy, plannedDepartureAt: row.plannedDepartureAt?.toISOString() ?? null,
    plannedArrivalAt: row.plannedArrivalAt?.toISOString() ?? null };
}
function parseStoredRoutePlan(value: unknown) {
  if (value == null) return null;
  let decoded = value;
  if (typeof value === 'string') {
    try { decoded = JSON.parse(value); } catch { throw new ConflictException('Dữ liệu lộ trình đã lưu không đọc được.'); }
  }
  const result = routePlanSchema.safeParse(decoded);
  if (!result.success) throw new ConflictException('Dữ liệu lộ trình đã lưu không đúng phiên bản được hỗ trợ.');
  return result.data;
}
export class TripsService {
  constructor(private readonly repository: TripsRepository) {}
  async previewRoute(account: User, rawId: string, body: unknown) {
    if (account.role !== Role.COORDINATOR) throw new ForbiddenException('Chỉ Coordinator phụ trách được tính tuyến.');
    const id = parse(tripIdSchema, rawId), input = parse(routePreviewSchema, body);
    const row = await this.accessible(account, id);
    if (row.planStatus !== 'DRAFT' || !['APPROVED', 'PREPARING'].includes(row.orderStatus)) throw new ConflictException('Chỉ tính tuyến khi kế hoạch còn được sửa.');
    const legs = await this.repository.legs(id);
    if (legs.some(leg => leg.status !== 'NOT_STARTED')) throw new ConflictException('Chuyến đã vận hành, không được tính lại tuyến.');
    return { inputKey: routeInputKey(input.waypoints), routes: await previewRoutes(id, input.waypoints), attribution: 'Mapbox' };
  }
  async saveRoutePlan(account: User, rawId: string, body: unknown): Promise<TripDetail> {
    if (account.role !== Role.COORDINATOR) throw new ForbiddenException('Chỉ Coordinator phụ trách được lưu lộ trình.');
    const id = parse(tripIdSchema, rawId), input = parse(routePlanWriteSchema, body);
    if (input.routePlan.selectedRoute?.inputKey !== undefined && input.routePlan.selectedRoute.inputKey !== routeInputKey(input.routePlan.waypoints)) {
      throw new BadRequestException('Tuyến đã chọn không khớp các điểm hiện tại. Hãy tính lại tuyến.');
    }
    if (!input.routePlan.selectedRoute && input.verificationToken) throw new BadRequestException('Không gửi mã xác thực khi chưa chọn tuyến.');
    return this.repository.transaction(async repo => {
      const { trip } = await this.lockEditablePlan(repo, account, id);
      if (Number(trip.routePlanRevision) !== input.revision) throw new ConflictException('Lộ trình đã được cập nhật ở tab khác. Hãy tải lại trước khi lưu.');
      const before = parseStoredRoutePlan(trip.routePlan);
      if (input.routePlan.selectedRoute) {
        if (input.verificationToken) verifyRouteToken(input.verificationToken, id, input.routePlan.selectedRoute);
        else if (JSON.stringify(before?.selectedRoute) !== JSON.stringify(input.routePlan.selectedRoute)) {
          throw new BadRequestException('Thiếu mã xác thực tuyến. Hãy tính và chọn lại tuyến.');
        }
      }
      if (!await repo.writeRoutePlan(id, input.revision, input.routePlan)) throw new ConflictException('Lộ trình đã thay đổi. Hãy tải lại trước khi lưu.');
      // Mọi thay đổi route_plan đều buộc Coordinator xác nhận lại lịch tổng. Điều này ràng buộc
      // một leg đại diện với đúng revision lộ trình mà không cần thêm cột/bảng.
      await repo.clearRepresentativeSchedule(id);
      const compact = (plan: typeof before) => JSON.stringify(plan ? { version: plan.version, waypoints: plan.waypoints, selectedRoute: plan.selectedRoute && { distanceM: plan.selectedRoute.distanceM, durationS: plan.selectedRoute.durationS, provider: plan.selectedRoute.provider, calculatedAt: plan.selectedRoute.calculatedAt, inputKey: plan.selectedRoute.inputKey } } : null);
      await repo.auditRoutePlan(account.id, id, compact(before), compact(input.routePlan));
      return new TripsService(repo).detail(account, id);
    });
  }
  async savePlan(account: User, rawId: string, body: unknown): Promise<TripDetail> {
    if (account.role !== Role.COORDINATOR) throw new ForbiddenException('Chỉ Coordinator phụ trách được lưu kế hoạch.');
    const id = parse(tripIdSchema, rawId), input = parse(tripPlanSchema, body);
    return this.repository.transaction(async repo => {
      const { existing, orderId, trip } = await this.lockEditablePlan(repo, account, id);
      if (!('legs' in input)) {
        const routePlan = parseStoredRoutePlan(trip.routePlan);
        if (!routePlan?.selectedRoute) throw new ConflictException('Hãy tính, chọn và lưu tuyến đường trước khi lưu lịch.');
        if (Number(trip.routePlanRevision) !== input.routePlanRevision) {
          throw new ConflictException('Lộ trình đã thay đổi. Hãy tải lại và xác nhận lịch theo phiên bản mới.');
        }
        if ((await repo.fleet(id)).length) {
          await this.validateSavedFleet(repo,id,orderId,input.plannedDepartureAt,input.plannedArrivalAt);
        }
        const service = new TripsService(repo), before = await service.detail(account,id);
        await repo.writeRepresentativeLeg(id,account.id,existing,input.plannedDepartureAt,input.plannedArrivalAt);
        await repo.updatePlanTimes(id,input.plannedDepartureAt,input.plannedArrivalAt);
        const after = await service.detail(account,id);
        const snapshot = (detail: TripDetail) => JSON.stringify({ id:detail.id,routePlanRevision:detail.routePlanRevision,
          plannedDepartureAt:detail.plannedDepartureAt,plannedArrivalAt:detail.plannedArrivalAt,
          representativeLegId:detail.legs[0]?.id ?? null });
        await repo.audit(account.id,id,snapshot(before),snapshot(after));
        return after;
      }
      // Chuyến legacy chưa dùng route_plan vẫn được phép lưu theo cấu trúc legs cũ.
      if (trip.routePlan) throw new ConflictException('Chuyến dùng lộ trình mới chỉ nhận thời gian tổng và routePlanRevision.');
      const invalid = (field: string, message: string): never => {
        throw new BadRequestException({ message: 'Vui lòng kiểm tra kế hoạch.', fields: { [field]: message } });
      };
      if (input.legs.length < existing.length) invalid('legs', 'Phải gửi đầy đủ chặng cũ đúng thứ tự.');
      input.legs.forEach((leg, index) => {
        if (index < existing.length ? leg.id !== existing[index].id : leg.id !== undefined) {
          invalid(`legs.${index}.id`, 'Giữ đủ ID chặng cũ đúng thứ tự; chặng mới không có ID và chỉ thêm cuối.');
        }
      });
      await this.validateCatalog(repo, id, input);
      if ((await repo.fleet(id)).length) await this.validateSavedFleet(repo,id,orderId,input.legs[0].plannedDepartureAt,input.legs[input.legs.length-1].plannedArrivalAt);
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
    return { orderId, order, existing, trip };
  }
  private async validateCatalog(repo: TripsRepository, tripId: string, input: LegacyTripPlanInput, exclusiveVehicles = false) {
    const invalid = (field: string, message: string): never => {
      throw new BadRequestException({ message: 'Vui lòng kiểm tra kế hoạch.', fields: { [field]: message } });
    };
    // Lock catalogs in deterministic ID order, retaining their validity until commit.
    const sortIds = (ids: string[]) => [...new Set(ids)].sort((a, b) => a.length - b.length || a.localeCompare(b));
    const locations = new Map<string, boolean>(), vehicles = new Map<string, boolean>();
    for (const location of sortIds(input.legs.flatMap(l => [l.fromLocationId, l.toLocationId]))) locations.set(location, await repo.lockLocation(location));
    input.legs.forEach((leg, index) => {
      for (const field of ['fromLocationId', 'toLocationId'] as const) if (!locations.get(leg[field])) invalid(`legs.${index}.${field}`, 'Địa điểm không tồn tại.');
      if (leg.vehicleId) invalid(`legs.${index}.vehicleId`, 'Phân công xe qua API assignments; chặng dùng chung cho toàn đoàn.');
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
      await this.validateAssignedCrewSchedule(repo, id, detail.plannedDepartureAt, detail.plannedArrivalAt);
      await repo.submitPlan(id, orderId);
      await repo.auditSubmission(account.id, id, orderId, order.status);
      await repo.notifyPlanManagers(id);
      return service.detail(account, id);
    });
  }
  private async validateStoredPlan(repo: TripsRepository, detail: TripDetail, existingCount: number, orderId: string, approval: boolean) {
    if (detail.routePlan) {
      if (!detail.routePlan.selectedRoute) throw new ConflictException('Lộ trình chưa có tuyến đường đã chọn.');
      if (detail.routePlan.selectedRoute.inputKey !== routeInputKey(detail.routePlan.waypoints)) {
        throw new ConflictException('Tuyến đã chọn không còn khớp các điểm hành trình. Hãy tính và lưu lại tuyến.');
      }
      if (existingCount !== 1 || detail.legs.length !== 1) throw new ConflictException('Kế hoạch mới phải có đúng một chặng vận hành đại diện. Hãy lưu lại thời gian dự kiến.');
      const leg = detail.legs[0];
      if (!detail.plannedDepartureAt || !detail.plannedArrivalAt ||
        detail.plannedDepartureAt !== leg.plannedDepartureAt || detail.plannedArrivalAt !== leg.plannedArrivalAt ||
        Date.parse(leg.plannedArrivalAt) <= Date.parse(leg.plannedDepartureAt) ||
        isSameVietnamCalendarDate(leg.plannedDepartureAt, leg.plannedArrivalAt)) {
        throw new ConflictException('Thời gian dự kiến chưa hợp lệ hoặc chưa khớp chặng vận hành. Hãy lưu lại kế hoạch.');
      }
      if (approval) await repo.lockTransportHorses(orderId);
      await this.validateSavedFleet(repo,detail.id,orderId,detail.plannedDepartureAt,detail.plannedArrivalAt);
      return;
    }
    // A broken catalog JOIN must not silently omit stored legs during submission.
    if (detail.legs.length !== existingCount || !existingCount) {
      throw new ConflictException('Kế hoạch chưa có chặng hoặc thiếu dữ liệu địa điểm.');
    }
    const checked = legacyTripPlanSchema.safeParse({ legs: detail.legs.map(leg => ({
      id: leg.id, fromLocationId: leg.fromLocationId, toLocationId: leg.toLocationId,
      vehicleId: leg.vehicleId, plannedDepartureAt: leg.plannedDepartureAt, plannedArrivalAt: leg.plannedArrivalAt,
    })) });
    if (!checked.success) throw new ConflictException('Kế hoạch đã lưu chưa hợp lệ. Vui lòng sửa xe, tuyến và ngày giờ trước khi gửi.');
    const input = checked.data;
    if (detail.plannedDepartureAt !== detail.legs[0].plannedDepartureAt || detail.plannedArrivalAt !== detail.legs[detail.legs.length - 1].plannedArrivalAt) {
      throw new ConflictException('Thời gian Trip không khớp chặng đầu/cuối. Vui lòng lưu lại kế hoạch.');
    }
    try { await this.validateCatalog(repo, detail.id, input, approval); }
    catch (error) {
      if (error instanceof BadRequestException) throw new ConflictException(error.getResponse());
      throw error;
    }
    if (input.legs.some(leg => Date.parse(leg.plannedArrivalAt) <= Date.parse(leg.plannedDepartureAt))) {
      throw new ConflictException('Mỗi chặng gửi duyệt phải có giờ đến sau giờ đi.');
    }
    if (approval) await repo.lockTransportHorses(orderId);
    await this.validateSavedFleet(repo,detail.id,orderId,detail.plannedDepartureAt,detail.plannedArrivalAt);
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
      if (input.decision === 'APPROVED') {
        await this.validateStoredPlan(repo, before, existing.length, orderId, true);
        await this.validateAssignedCrewSchedule(repo, id, before.plannedDepartureAt, before.plannedArrivalAt);
      }
      await repo.reviewPlan(id, account.id, input);
      const after = await service.detail(account, id);
      const reviewSnapshot = (detail: TripDetail) => JSON.stringify({ planStatus: detail.planStatus,
        orderStatus: detail.orderStatus, approvedBy: detail.approvedBy, approvedAt: detail.approvedAt, returnReason: detail.returnReason });
      const reason = input.decision === 'RETURNED' ? input.reason : null;
      await repo.auditReview(account.id, id, reviewSnapshot(before), reviewSnapshot(after), reason);
      await repo.notifyPlanCoordinator(id, trip.plannedBy, input.decision, reason);
      return after;
    });
  }
  async readiness(account: User, rawId: string) {
    const id = parse(tripIdSchema, rawId);
    await this.accessible(account, id);
    return this.repository.transaction(async repo => {
      const orderId = await repo.orderId(id);
      if (!orderId) throw new NotFoundException('Không tìm thấy chuyến.');
      const order = await repo.lockOrder(orderId);
      const trip = await repo.lockTrip(id);
      const detail = await new TripsService(repo).detail(account, id);
      const blockers: { code: string; message: string }[] = [];
      try {
        if (!trip || trip.orderId !== orderId || !order) throw new ConflictException('Đơn của chuyến đã thay đổi.');
        if (!['PENDING_APPROVAL', 'APPROVED'].includes(trip.planStatus) || order.status !== 'PREPARING') {
          throw new ConflictException('Chỉ kiểm tra kế hoạch chờ duyệt hoặc đã duyệt của đơn đang chuẩn bị.');
        }
        const legs = await repo.lockLegs(id);
        if (legs.some(l => l.status !== 'NOT_STARTED' || l.actualDepartureAt || l.actualArrivalAt) || await repo.hasHistory(id)) {
          throw new ConflictException('Chuyến đã có dữ liệu vận hành.');
        }
        await this.validateStoredPlan(repo, detail, legs.length, orderId, true);
      } catch (error) {
        if (!(error instanceof BadRequestException || error instanceof ConflictException)) throw error;
        const response = error.getResponse();
        blockers.push({ code: 'PLAN_NOT_READY', message: typeof response === 'string' ? response : String(response.message || 'Kế hoạch chưa hợp lệ.') });
      }
      return { tripId: id, planStatus: detail.planStatus, orderStatus: detail.orderStatus,
        valid: blockers.length === 0, canStart: blockers.length === 0 && detail.planStatus === 'APPROVED' && detail.orderStatus === 'PREPARING', blockers };
    });
  }
  async releaseToDriver(account: User, rawId: string, body: unknown): Promise<TripDetail> {
    if (account.role !== Role.MANAGER) throw new ForbiddenException('Chỉ Manager được chuyển chuyến cho tài xế.');
    const id = parse(tripIdSchema, rawId);
    parse(submitTripPlanSchema, body);
    return this.repository.transaction(async repo => {
      const orderId = await repo.orderId(id);
      if (!orderId) throw new NotFoundException('Không tìm thấy chuyến.');
      const order = await repo.lockOrder(orderId), trip = await repo.lockTrip(id);
      if (!order || !trip || trip.orderId !== orderId || trip.planStatus !== 'APPROVED' || order.status !== 'PREPARING') {
        throw new ConflictException('Chỉ chuyển chuyến khi kế hoạch APPROVED và đơn PREPARING.');
      }
      const legs = await repo.lockLegs(id);
      if (legs.some(l => l.status !== 'NOT_STARTED' || l.actualDepartureAt || l.actualArrivalAt) || await repo.hasHistory(id)) {
        throw new ConflictException('Chuyến đã có dữ liệu vận hành.');
      }
      const service = new TripsService(repo), detail = await service.detail(account, id);
      await this.validateStoredPlan(repo, detail, legs.length, orderId, true);
      if (!await repo.markOrderReady(orderId)) throw new ConflictException('Trạng thái đơn đã thay đổi.');
      await repo.auditOrderReady(account.id, orderId, id, order.status);
      await repo.notifyOrderReady(orderId, id);
      return service.detail(account, id);
    });
  }
  private async validateAssignedCrewSchedule(repo: TripsRepository, tripId: string, departure: string | null, arrival: string | null) {
    let assignments = await repo.assignments(tripId);
    if (!assignments.length) return;
    const ids = [...new Set(assignments.map(row => row.userId))].sort((a, b) => a.length - b.length || a.localeCompare(b));
    for (const userId of ids) await repo.lockCrewUser(userId);
    assignments = await repo.assignments(tripId);
    if (!departure || !arrival) throw new ConflictException('Chuyến chưa có khung giờ hợp lệ để kiểm tra nhân sự.');
    for (const assignment of assignments) {
      if (assignment.accountRole !== 'DRIVER_ESCORT' || assignment.accountStatus !== 'ACTIVE' || !assignment.crewType || assignment.crewType !== assignment.role) {
        throw new ConflictException(`Phân công của ${assignment.fullName} không còn đủ điều kiện; hãy cập nhật nhân sự trước.`);
      }
      if (await repo.crewOverlaps(tripId, assignment.userId, departure, arrival)) throw new ConflictException('Nhân sự trùng lịch với chuyến đã được duyệt.');
    }
  }
  async assignmentOptions(account: User, id: string) {
    await this.accessible(account, id);
    return { items: await this.repository.assignmentOptions(id) };
  }
  async assignments(account: User, id: string): Promise<TripAssignments> {
    await this.accessible(account, id);
    const rows = await this.repository.assignments(id);
    const items = rows.map(row => ({ id: row.id, tripVehicleId: row.tripVehicleId, userId: row.userId, fullName: row.fullName,
      role: row.role, assignedBy: row.assignedBy, assignedAt: row.assignedAt.toISOString(), crewType: row.crewType, workStatus: row.workStatus }));
    const vehicles = (await this.repository.fleet(id)).map(v => ({...v,crew:items.filter(p => p.tripVehicleId===v.id)}));
    const readiness = checkCrewReadiness(rows);
    for (const vehicle of vehicles) for (const role of ['DRIVER','ESCORT']) {
      const count = vehicle.crew.filter(p => p.role===role).length;
      if (count<1 || count>2) readiness.blockers.push({code:'INELIGIBLE_CREW',message:`Xe ${vehicle.plateNumber}: cần 1–2 ${role==='DRIVER'?'tài xế':'lơ xe'}.`});
    }
    if (!vehicles.length || rows.some(p => !p.tripVehicleId)) readiness.blockers.push({code:'INELIGIBLE_CREW',message:'Chưa gắn đầy đủ xe và tổ nhân sự.'});
    readiness.complete = readiness.blockers.length===0;
    return {tripId:id,items,vehicles,crewReadiness:readiness};
  }
  private async validateFleet(repo: TripsRepository, id: string, orderId: string, input: TripFleetInput, departure: string | null, arrival: string | null) {
    const ordered = [...input.vehicles].sort((a,b) => a.vehicleId.length-b.vehicleId.length || a.vehicleId.localeCompare(b.vehicleId));
    for (const vehicle of ordered) {
      if (!await repo.lockAvailableVehicle(vehicle.vehicleId,id,true)) throw new ConflictException(`Xe ${vehicle.vehicleId} không khả dụng.`);
      if (await repo.vehicleStillOperating(id,vehicle.vehicleId)) throw new ConflictException(`Xe ${vehicle.vehicleId} đang vận hành ở chuyến khác.`);
      const capacity = await repo.vehicleCapacity(vehicle.vehicleId);
      if (capacity == null || vehicle.horseCount > capacity) throw new BadRequestException(`Xe ${vehicle.vehicleId}: số ngựa vượt sức chứa.`);
      if (departure && arrival && await repo.vehicleOverlaps(id,vehicle.vehicleId,departure,arrival)) throw new ConflictException(`Xe ${vehicle.vehicleId} trùng lịch.`);
    }
    const count = await repo.normalHorseCount(orderId);
    if (input.vehicles.reduce((n,v) => n+v.horseCount,0) !== count || !count) throw new BadRequestException('Tổng số ngựa bố trí phải bằng số ngựa NORMAL cần vận chuyển.');
    const people = input.vehicles.flatMap(v => v.crew).sort((a,b) => a.userId.length-b.userId.length || a.userId.localeCompare(b.userId));
    for (const person of people) {
      const user = await repo.lockCrewUser(person.userId);
      if (!user || user.role !== 'DRIVER_ESCORT' || user.accountStatus !== 'ACTIVE' || user.crewType !== person.role || user.workStatus !== 'AVAILABLE') throw new BadRequestException(`Nhân sự ${person.userId} không sẵn sàng hoặc không đúng chuyên môn.`);
      if (departure && arrival && await repo.crewOverlaps(id,person.userId,departure,arrival)) throw new ConflictException(`Nhân sự ${person.userId} trùng lịch.`);
    }
  }
  private async validateSavedFleet(repo: TripsRepository, id: string, orderId: string, departure: string | null, arrival: string | null) {
    const vehicles = await repo.fleet(id), rows = await repo.assignments(id);
    const input = parse(tripFleetSchema, { vehicles: vehicles.map(v => ({ vehicleId:v.vehicleId,horseCount:v.horseCount,
      crew:rows.filter(p => p.tripVehicleId===v.id).map(p => ({userId:p.userId,role:p.role})) })) });
    if (rows.some(p => !p.tripVehicleId)) throw new ConflictException('Phân công cũ chưa được gắn xe; hãy cập nhật tổ nhân sự.');
    await this.validateFleet(repo,id,orderId,input,departure,arrival);
  }
  async saveAssignments(account: User, rawId: string, body: unknown): Promise<TripAssignments> {
    if (account.role !== Role.COORDINATOR) throw new ForbiddenException('Chỉ Coordinator phụ trách được phân công.');
    const id = parse(tripIdSchema, rawId), input = parse(tripFleetSchema, body);
    return this.repository.transaction(async repo => {
      const {orderId, trip} = await this.lockEditablePlan(repo,account,id);
      const before = await new TripsService(repo).assignments(account,id);
      const window = await repo.tripWindow(id);
      // A draft may lack a schedule; submit/approval require and recheck the complete window.
      await this.validateFleet(repo,id,orderId,input,window?.departure.toISOString() ?? null,window?.arrival.toISOString() ?? null);
      await repo.lockAssignments(id);
      await repo.replaceFleet(id,account.id,input);
      const after = await new TripsService(repo).assignments(account,id);
      const compact = (value: TripAssignments) => JSON.stringify(value.vehicles?.map(v => ({vehicleId:v.vehicleId,horseCount:v.horseCount,crew:v.crew.map(p => ({userId:p.userId,role:p.role}))})));
      await repo.auditCrew(account.id,id,compact(before),compact(after));
      const wanted = new Map(input.vehicles.flatMap(v => v.crew).map(p => [p.userId,p.role]));
      for (const person of before.items) if (!wanted.has(person.userId)) await repo.notifyCrew(id,person.userId,null);
      for (const [userId,role] of wanted) await repo.notifyCrew(id,userId,role);
      return after;
    });
  }
  async list(account: User, query: PaginationDto): Promise<TripList> {
    const { rows, total } = await this.repository.list(scope(account), query.limit, (query.page - 1) * query.limit);
    return { items: rows.map(row => ({ ...summary(row), tripId: row.id, orderStatus: row.orderStatus,
      desiredDepartureDate: row.desiredDepartureDate ?? null,
      requestedPickupTime: row.requestedPickupTime?.trim() || null,
      horseCount: Number(row.horseCount ?? 0) })), total, page: query.page, limit: query.limit };
  }
  private async accessible(account: User, id: string) {
    const row = await this.repository.find(scope(account), id);
    if (!row) throw new NotFoundException('Không tìm thấy chuyến.');
    return row;
  }
  async detail(account: User, id: string): Promise<TripDetail> {
    const row = await this.accessible(account, id);
    const legs = await this.repository.legs(id);
    const routePlan = parseStoredRoutePlan(row.routePlan);
    const origin = routePlan?.waypoints[0];
    const destination = routePlan?.waypoints.at(-1);
    return { ...summary(row), orderStatus: row.orderStatus, approvedBy: row.approvedBy ?? null,
      approvedAt: row.approvedAt?.toISOString() ?? null, returnReason: row.returnReason ?? null,
      originAddress: row.originAddress, destinationAddress: row.destinationAddress,
      routePlan, routePlanRevision: Number(row.routePlanRevision), legs: legs.map(leg => ({
      id: leg.id, seqNo: leg.seqNo, fromLocationId: leg.fromLocationId ?? origin?.id ?? '', fromLocationName: leg.fromLocationName ?? origin?.label ?? row.originAddress,
      toLocationId: leg.toLocationId ?? destination?.id ?? '', toLocationName: leg.toLocationName ?? destination?.label ?? row.destinationAddress, vehicleId: leg.vehicleId,
      vehicleCode: leg.vehicleCode, vehicleStatus: leg.vehicleStatus,
      plannedDepartureAt: leg.plannedDepartureAt.toISOString(), plannedArrivalAt: leg.plannedArrivalAt.toISOString(), status: leg.status,
    })) };
  }
  async planOptions(account: User, id: string): Promise<TripPlanOptions> {
    const trip = await this.accessible(account, id);
    const [locations, vehicles, currentVehicles, requiredHorseCount] = await Promise.all([
      this.repository.locations(), this.repository.vehicles(), this.repository.tripVehicleIds(id),
      this.repository.normalHorseCount(trip.orderId),
    ]);
    return {
      requiredHorseCount,
      locations: locations.map(l => ({ id: l.id, name: l.name, locationType: l.locationType, country: l.country, timezone: l.timezone, address: l.address,
        latitude: l.latitude === null ? null : Number(l.latitude), longitude: l.longitude === null ? null : Number(l.longitude) })),
      vehicles: vehicles.map(v => {
        const blockingReasons = v.status === 'AVAILABLE' || currentVehicles.has(v.id) ? [] : [{ code: `VEHICLE_${v.status}`, message: v.status === 'RESERVED' ? 'Xe đang được giữ cho kế hoạch khác.' : 'Xe đang vận chuyển.' }];
        return { ...v, selectable: blockingReasons.length ? false : null, scheduleEvaluation: 'NOT_EVALUATED' as const, blockingReasons };
      }),
    };
  }
}
