import { Role } from '@my-project/shared';
import { User } from '../users/users.model';
import { TrackingRepository } from './tracking.repository';
import {
  legIdSchema,
  buildMilestoneSchema,
  buildCompleteLegSchema,
  correctLegSchema,
  createHorseLogSchema,
  createIncidentSchema,
  patchIncidentSchema,
  createAlertSchema,
  positionsBatchSchema,
  trackQuerySchema,
} from './tracking.validation';
import { Upload, fileType, saveFile, removeFile, loadFile } from '../documents/file-storage';
import { parse } from '../../shared/utils/validation.util';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '../../shared/core/error.response';
import {
  LegStatus,
  MilestoneType,
  OrderStatus,
  PlanStatus,
  IncidentType,
  IncidentUrgency,
  IncidentStatus,
  IncidentSeverity,
  AlertType,
  IHorseLog,
  IIncident,
  IAlert,
  ILogAttachment,
  IOrderTimeline,
  ITimelineLeg,
  ITripTimeline,
  IActiveTrips,
  IActiveTripItem,
  IDriverTripSummary,
  ILegMilestone,
  ILegTracking,
  ITripMap,
  ITripPositionBatchResult,
  ITripTrackPoint,
} from '@my-project/shared';
import { TrackingTripDetail, LegDetailRow, MilestoneRow } from './tracking.dto';
import { buildTripMap, isLegOverdue, legEnds, toLatestPosition } from './trackmap.build';
import { Logger } from '../../shared/utils/logger.util';
import { socketService } from '../../shared/socket/socket.service';
import { RoutesProvider, type ResolvedRoute } from './trackmap.routes-provider';
import { modeForVehicle } from './trackmap.geo';

function mapLegWithMilestones(leg: LegDetailRow, milestones: MilestoneRow[]): ILegTracking {
  const legMilestones: ILegMilestone[] = milestones
    .filter(m => m.legId === leg.id)
    .map(m => ({
      id: m.id,
      legId: m.legId,
      milestoneType: m.milestoneType,
      occurredAt: m.occurredAt.toISOString(),
      recordedBy: m.recordedBy,
      recordedByName: m.recordedByName,
    }));

  return {
    id: leg.id,
    seqNo: leg.seqNo,
    fromLocationId: leg.fromLocationId,
    fromLocationName: leg.fromLocationName,
    toLocationId: leg.toLocationId,
    toLocationName: leg.toLocationName,
    toLocationType: leg.toLocationType,
    vehicleId: leg.vehicleId,
    vehicleCode: leg.vehicleCode,
    plannedDepartureAt: leg.plannedDepartureAt.toISOString(),
    plannedArrivalAt: leg.plannedArrivalAt.toISOString(),
    status: leg.status,
    actualDepartureAt: leg.actualDepartureAt ? leg.actualDepartureAt.toISOString() : null,
    actualArrivalAt: leg.actualArrivalAt ? leg.actualArrivalAt.toISOString() : null,
    updatedAt: leg.updatedAt ? leg.updatedAt.toISOString() : null,
    updatedByName: leg.updatedByName,
    milestones: legMilestones,
  };
}

type StoredFile = Awaited<ReturnType<typeof saveFile>>;

const INCIDENT_LABELS: Record<IncidentType, string> = {
  [IncidentType.VEHICLE_BREAKDOWN]: 'hỏng xe',
  [IncidentType.LONG_TRAFFIC_JAM]: 'kẹt xe kéo dài',
  [IncidentType.HORSE_MEDICAL]: 'y tế ngựa',
};
const ALERT_LABELS: Record<AlertType, string> = {
  [AlertType.TRAFFIC]: 'giao thông',
  [AlertType.WEATHER]: 'thời tiết',
  [AlertType.BORDER]: 'cửa khẩu',
};

/** Form multipart gửi ô trống dưới dạng chuỗi rỗng: coi như không gửi trường đó. */
function normalizeForm(body: unknown) {
  if (!body || typeof body !== 'object') return body;
  return Object.fromEntries(Object.entries(body).filter(([, value]) => value !== ''));
}

/** Ảnh hiện trường: chỉ JPG/PNG (kiểm tra magic bytes), tối đa 5MB mỗi ảnh. */
function assertPhotos(files: Upload[]) {
  for (const file of files) {
    if (fileType(file) === 'PDF') throw new BadRequestException('Ảnh đính kèm chỉ nhận JPG hoặc PNG.');
  }
}

function toAttachment(row: { id: string; originalName: string; fileType: 'PDF' | 'JPG' | 'PNG'; sizeBytes: number; uploadedAt: Date; caption?: string | null }): ILogAttachment {
  return {
    id: row.id,
    originalName: row.originalName,
    fileType: row.fileType,
    sizeBytes: Number(row.sizeBytes),
    uploadedAt: row.uploadedAt.toISOString(),
    caption: row.caption ?? null,
  };
}

const ACTIVE_TRIPS_LIMIT = 200;

/** Cập nhật gần nhất (FR-TRK-08): lấy theo chặng có `updated_at` mới nhất. */
function latestUpdate(legs: { updatedAt: Date | null; updatedByName: string | null }[]): { at: string | null; byName: string | null } {
  let latest: { updatedAt: Date; updatedByName: string | null } | null = null;
  for (const leg of legs) {
    if (leg.updatedAt && (!latest || leg.updatedAt > latest.updatedAt)) latest = { updatedAt: leg.updatedAt, updatedByName: leg.updatedByName };
  }
  return { at: latest ? latest.updatedAt.toISOString() : null, byName: latest ? latest.updatedByName : null };
}

function assertNotBefore(occurredAt: string, previous: Date | null | undefined, label: string) {
  if (previous && Date.parse(occurredAt) < previous.getTime()) {
    throw new BadRequestException(`Thời điểm không được sớm hơn mốc ${label} đã ghi nhận (${previous.toISOString()}).`);
  }
}

const LEG_STATUS_RANK: Record<LegStatus, number> = {
  [LegStatus.NOT_STARTED]: 0,
  [LegStatus.MOVING]: 1,
  [LegStatus.AT_STOP]: 2,
  [LegStatus.COMPLETED]: 3,
};

/** Mốc bắt buộc phải tồn tại để một chặng ở trạng thái `status` là nhất quán. */
function milestonesRequired(status: LegStatus, isBorder: boolean, isLast: boolean): MilestoneType[] {
  const rank = LEG_STATUS_RANK[status];
  const required: MilestoneType[] = [];
  if (rank >= 1) required.push(MilestoneType.DEPARTED);
  if (rank >= 2) required.push(MilestoneType.ARRIVED_AT_STOP);
  if (rank >= 3) {
    if (isBorder) required.push(MilestoneType.CUSTOMS_CLEARED);
    if (isLast) required.push(MilestoneType.DELIVERED);
  }
  return required;
}

const MAX_TRACK_POINTS = 500;
const RETENTION_INTERVAL_MS = 60 * 60_000;
const RETENTION_BATCH = 5_000;
const retentionLogger = new Logger('TrackPositions');
/** TRACK_POSITION_RETENTION_DAYS (đã kiểm 1..365 lúc khởi động); thiếu thì 30. */
function retentionDays() {
  const days = Number(process.env.TRACK_POSITION_RETENTION_DAYS);
  return Number.isInteger(days) && days >= 1 && days <= 365 ? days : 30;
}

/** Cổng phát sự kiện realtime tới phòng riêng của người dùng; mặc định là socket dùng chung (no-op khi socket chưa gắn, như trong unit test). */
export interface TrackingRealtime {
  emitToUsers(userIds: string[], event: string, payload: unknown): void;
}
const realtimeLogger = new Logger('TrackingRealtime');

export class TrackingService {
  private readonly routes: RoutesProvider;
  private retentionTimer?: NodeJS.Timeout;
  private retentionRun?: Promise<number>;

  constructor(private readonly repository: TrackingRepository, routes?: RoutesProvider, private readonly realtime: TrackingRealtime = socketService) {
    this.routes = routes ?? new RoutesProvider(repository);
  }

  /** Chạy SAU khi transaction đã commit; lỗi socket/DB ở đây chỉ được log, không làm hỏng request. */
  private async publish(label: string, run: () => Promise<void>): Promise<void> {
    try {
      await run();
    } catch (error) {
      realtimeLogger.warn('realtime_emit_failed', { label, error: error instanceof Error ? error.message : String(error) });
    }
  }

  /** Đẩy `notification:new` cho từng người vừa nhận thông báo IN_APP của sự kiện chuyến. */
  private async emitNewNotifications(userIds: string[], eventType: string, tripId: string) {
    const rows = await this.repository.findLatestTripNotifications(userIds, eventType, tripId);
    for (const row of rows) {
      this.realtime.emitToUsers([row.recipientId], 'notification:new', { id: row.id, content: row.content, createdAt: row.createdAt.toISOString(), eventType });
    }
  }

  async getDriverTrips(account: User): Promise<IDriverTripSummary[]> {
    if (account.role !== Role.DRIVER_ESCORT) {
      throw new ForbiddenException('Chỉ tài xế / người hộ tống mới có danh sách chuyến được phân công.');
    }

    const tripRows = await this.repository.getDriverTrips(String(account.id));
    if (!tripRows.length) return [];

    const allLegs = await this.repository.getLegsForTrips(tripRows.map(t => t.id));
    const allMilestones = await this.repository.getLegMilestones(allLegs.map(l => l.id));
    const summaries: IDriverTripSummary[] = tripRows.map(trip => ({
      id: trip.id,
      orderId: trip.orderId,
      orderCode: trip.orderCode,
      orderStatus: trip.orderStatus,
      planStatus: trip.planStatus,
      plannedDepartureAt: trip.plannedDepartureAt ? trip.plannedDepartureAt.toISOString() : null,
      plannedArrivalAt: trip.plannedArrivalAt ? trip.plannedArrivalAt.toISOString() : null,
      crewRole: trip.crewRole,
      legs: allLegs.filter(l => l.tripId === trip.id).map(l => mapLegWithMilestones(l, allMilestones)),
    }));

    return summaries;
  }

  async getTripDetail(account: User, rawTripId: string): Promise<TrackingTripDetail> {
    if (account.role === Role.CUSTOMER || account.role === Role.ADMIN) {
      throw new ForbiddenException('Vai trò của bạn không được xem chi tiết nội bộ của chuyến đi. Khách hàng xem tiến độ qua timeline của đơn.');
    }
    const tripId = parse(legIdSchema, rawTripId);
    const trip = await this.repository.findTrip(tripId);
    if (!trip) {
      throw new NotFoundException('Không tìm thấy chuyến đi.');
    }

    // Role-based access control (BR-SEC-01, BR-SEC-02, BR-SEC-03)
    let userCrewRole: import('@my-project/shared').CrewRole | undefined;
    if (account.role === Role.DRIVER_ESCORT) {
      const assignment = await this.repository.getDriverAssignment(tripId, String(account.id));
      if (!assignment) {
        throw new NotFoundException('Không tìm thấy chuyến đi hoặc bạn không được phân công chuyến này.');
      }
      userCrewRole = assignment.role;
    } else if (account.role === Role.COORDINATOR) {
      if (trip.plannedBy !== String(account.id)) {
        throw new NotFoundException('Không tìm thấy chuyến đi.');
      }
    }

    const [legs, horses, crew, contacts, vehicles, emergencyHotline] = await Promise.all([
      this.repository.getTripLegs(tripId),
      this.repository.getTripHorses(trip.orderId),
      this.repository.getTripCrew(tripId),
      this.repository.getTripContacts(tripId),
      this.repository.getTripVehicles(tripId),
      this.repository.getEmergencyHotline(),
    ]);

    const legIds = legs.map(l => l.id);
    const milestones = await this.repository.getLegMilestones(legIds);
    // Specialist chỉ đọc chuyên môn: không thấy SĐT của tổ lái, điều phối viên và người nhận.
    const showPhone = account.role !== Role.SPECIALIST;
    const phone = (value: string | null | undefined) => (showPhone && value) || null;

    return {
      id: trip.id,
      orderId: trip.orderId,
      orderCode: trip.orderCode,
      orderStatus: trip.orderStatus,
      planStatus: trip.planStatus,
      plannedDepartureAt: trip.plannedDepartureAt ? trip.plannedDepartureAt.toISOString() : null,
      plannedArrivalAt: trip.plannedArrivalAt ? trip.plannedArrivalAt.toISOString() : null,
      crewRole: userCrewRole,
      crew: crew.map(c => ({ userId: c.userId, name: c.name, phone: phone(c.phone), role: c.role })),
      customer: { name: contacts?.customerName ?? '' },
      recipient: contacts?.recipientName || contacts?.recipientPhone
        ? { name: contacts.recipientName ?? '', phone: phone(contacts.recipientPhone) }
        : null,
      coordinator: contacts?.coordinatorName ? { name: contacts.coordinatorName, phone: phone(contacts.coordinatorPhone) } : null,
      vehicles: vehicles.map(v => ({ id: v.id, code: v.code, type: v.type, capacityStalls: Number(v.capacityStalls) })),
      emergencyHotline,
      horses,
      legs: legs.map(l => mapLegWithMilestones(l, milestones)),
    };
  }

  async recordMilestone(account: User, rawLegId: string, body: unknown): Promise<{
    milestoneId: string;
    legId: string;
    milestoneType: MilestoneType;
    legStatus: LegStatus;
    orderStatus: OrderStatus;
  }> {
    if (account.role !== Role.DRIVER_ESCORT) {
      throw new ForbiddenException('Chỉ tài xế / người hộ tống được phân công mới có quyền ghi nhận mốc hành trình.');
    }

    const legId = parse(legIdSchema, rawLegId);
    const input = parse(buildMilestoneSchema(await this.repository.getMaxRetroactiveMinutes()), body);

    return this.repository.transaction(async repo => {
      const leg = await repo.lockLegForUpdate(legId);
      if (!leg) {
        throw new NotFoundException('Không tìm thấy chặng.');
      }

      // Check assignment (BR-LEG-02)
      const assignment = await repo.getDriverAssignment(leg.tripId, String(account.id));
      if (!assignment) {
        throw new ForbiddenException('Bạn không được phân công chuyến này.');
      }

      // Check duplicate milestone
      const duplicate = await repo.hasMilestone(legId, input.milestoneType);
      if (duplicate) {
        throw new ConflictException(`Mốc '${input.milestoneType}' đã được ghi nhận trước đó cho chặng này.`);
      }

      const allLegs = await repo.lockAllTripLegs(leg.tripId);
      const isFirstLeg = leg.seqNo === 1;
      const isLastLeg = leg.seqNo === allLegs.length;

      let nextLegStatus: LegStatus = leg.status;
      let nextOrderStatus: OrderStatus = leg.orderStatus;

      // Milestone state transition validation (BR-LEG-01)
      switch (input.milestoneType) {
        case MilestoneType.DEPARTED: {
          if (leg.status !== LegStatus.NOT_STARTED) {
            throw new ConflictException(`Chặng phải ở trạng thái Chưa bắt đầu (NOT_STARTED) để xuất phát. Hiện tại: ${leg.status}`);
          }

          if (leg.planStatus !== PlanStatus.APPROVED) {
            throw new ConflictException(`Kế hoạch chuyến phải được duyệt (APPROVED) trước khi xuất phát. Hiện tại: ${leg.planStatus}`);
          }

          if (isFirstLeg) {
            if (leg.orderStatus !== OrderStatus.READY) {
              throw new ConflictException(`Đơn hàng phải ở trạng thái Sẵn sàng (READY) để xuất phát. Hiện tại: ${leg.orderStatus}`);
            }
            const blockers = await repo.getDepartureBlockers(leg.tripId, leg.orderId);
            if (blockers.length) {
              // Error bodies no longer carry `blockers` (removed with manual READY); every reason is in the message.
              throw new ConflictException('Chuyến chưa đủ điều kiện xuất phát: ' + blockers.map(b => b.message).join(' '));
            }
            nextOrderStatus = OrderStatus.IN_TRANSIT;
            await repo.updateOrderStatus(leg.orderId, OrderStatus.IN_TRANSIT);
            await repo.audit(
              String(account.id),
              'ORDER',
              leg.orderId,
              'STATUS_CHANGE',
              JSON.stringify({ status: leg.orderStatus }),
              JSON.stringify({ status: OrderStatus.IN_TRANSIT }),
              'Chặng đầu tiên xuất phát'
            );
          } else {
            // Check previous leg is completed
            const prevLeg = allLegs.find(l => l.seqNo === leg.seqNo - 1);
            if (!prevLeg || prevLeg.status !== LegStatus.COMPLETED) {
              throw new ConflictException(`Chặng trước (Chặng ${leg.seqNo - 1}) chưa hoàn thành (COMPLETED).`);
            }
          }

          nextLegStatus = LegStatus.MOVING;
          await repo.updateLegDeparture(legId, input.occurredAt, String(account.id));
          break;
        }

        case MilestoneType.ARRIVED_AT_STOP: {
          if (leg.status !== LegStatus.MOVING) {
            throw new ConflictException(`Chặng phải ở trạng thái Đang di chuyển (MOVING) để ghi nhận đến trạm. Hiện tại: ${leg.status}`);
          }

          assertNotBefore(input.occurredAt, leg.actualDepartureAt, 'xuất phát');
          nextLegStatus = LegStatus.AT_STOP;
          await repo.updateLegArrival(legId, input.occurredAt, String(account.id));
          break;
        }

        case MilestoneType.CUSTOMS_CLEARED: {
          if (leg.status !== LegStatus.AT_STOP) {
            throw new ConflictException(`Chặng phải ở trạng thái Đã đến điểm dừng (AT_STOP) để ghi nhận thông quan. Hiện tại: ${leg.status}`);
          }
          if (leg.toLocationType !== 'BORDER') {
            throw new BadRequestException('Mốc Đã thông quan (CUSTOMS_CLEARED) chỉ áp dụng cho điểm dừng loại cửa khẩu (BORDER).');
          }
          assertNotBefore(input.occurredAt, leg.actualArrivalAt, 'đến trạm dừng');
          // Trạng thái chặng vẫn là AT_STOP nhưng vẫn phải ghi người/giờ cập nhật (FR-TRK-08).
          await repo.touchLeg(legId, String(account.id));
          break;
        }

        case MilestoneType.DELIVERED: {
          if (!isLastLeg) {
            throw new BadRequestException('Mốc Đã giao (DELIVERED) chỉ được ghi nhận ở chặng cuối cùng của chuyến.');
          }
          if (leg.status !== LegStatus.AT_STOP) {
            throw new ConflictException(`Chặng cuối phải ở trạng thái Đã đến điểm dừng (AT_STOP) để hoàn tất bàn giao. Hiện tại: ${leg.status}`);
          }

          // If border stop, check customs clearance milestone first
          if (leg.toLocationType === 'BORDER') {
            const customsCleared = await repo.hasMilestone(legId, MilestoneType.CUSTOMS_CLEARED);
            if (!customsCleared) {
              throw new ConflictException('Cửa khẩu biên giới bắt buộc phải có mốc Đã thông quan (CUSTOMS_CLEARED) trước khi hoàn tất.');
            }
          }

          assertNotBefore(input.occurredAt, leg.actualArrivalAt, 'đến trạm dừng');
          nextLegStatus = LegStatus.COMPLETED;
          nextOrderStatus = OrderStatus.DELIVERED;

          await repo.updateLegStatus(legId, LegStatus.COMPLETED, String(account.id));
          await repo.updateOrderStatus(leg.orderId, OrderStatus.DELIVERED);
          await repo.audit(
            String(account.id),
            'ORDER',
            leg.orderId,
            'STATUS_CHANGE',
            JSON.stringify({ status: leg.orderStatus }),
            JSON.stringify({ status: OrderStatus.DELIVERED }),
            'Hoàn thành chặng cuối và bàn giao toàn bộ ngựa'
          );
          break;
        }
      }

      // Record milestone
      const milestoneId = await repo.insertMilestone(
        legId,
        input.milestoneType,
        input.occurredAt,
        String(account.id)
      );

      // Audit log on leg
      await repo.audit(
        String(account.id),
        'LEG',
        legId,
        'RECORD_MILESTONE',
        JSON.stringify({ status: leg.status }),
        JSON.stringify({ status: nextLegStatus, milestone: input.milestoneType, occurredAt: input.occurredAt }),
        null
      );

      // In-app notifications
      const milestoneLabels: Record<MilestoneType, string> = {
        [MilestoneType.DEPARTED]: 'Xuất phát',
        [MilestoneType.ARRIVED_AT_STOP]: 'Đã đến trạm dừng',
        [MilestoneType.CUSTOMS_CLEARED]: 'Đã thông quan',
        [MilestoneType.DELIVERED]: 'Đã giao ngựa an toàn',
      };
      await repo.notify(
        leg.plannedBy,
        'LEG_MILESTONE_UPDATED',
        `Chuyến ${leg.tripId}, Chặng ${leg.seqNo}: Tài xế đã ghi nhận mốc ${milestoneLabels[input.milestoneType]}.`,
        'TRIP',
        leg.tripId
      );

      if (input.milestoneType === MilestoneType.ARRIVED_AT_STOP || input.milestoneType === MilestoneType.CUSTOMS_CLEARED) {
        await repo.notify(
          leg.customerId,
          'ORDER_LEG_PROGRESS',
          `Đơn hàng ${leg.orderCode}, chặng ${leg.seqNo}: ${milestoneLabels[input.milestoneType]}.`,
          'ORDER',
          leg.orderId
        );
      }

      if (nextOrderStatus === OrderStatus.IN_TRANSIT && isFirstLeg && input.milestoneType === MilestoneType.DEPARTED) {
        await repo.notify(
          leg.customerId,
          'ORDER_IN_TRANSIT',
          `Đơn hàng ${leg.orderCode} đã bắt đầu khởi hành. Bạn có thể theo dõi tiến độ trên hệ thống.`,
          'ORDER',
          leg.orderId
        );
      } else if (nextOrderStatus === OrderStatus.DELIVERED && isLastLeg && input.milestoneType === MilestoneType.DELIVERED) {
        await repo.notify(
          leg.customerId,
          'ORDER_DELIVERED',
          `Đơn hàng ${leg.orderCode} đã hoàn tất và giao ngựa an toàn tới điểm đích.`,
          'ORDER',
          leg.orderId
        );
      }

      return {
        milestoneId,
        legId,
        milestoneType: input.milestoneType,
        legStatus: nextLegStatus,
        orderStatus: nextOrderStatus,
      };
    });
  }

  async completeIntermediateLeg(account: User, rawLegId: string, body: unknown): Promise<{ legId: string; status: LegStatus }> {
    if (account.role !== Role.DRIVER_ESCORT) {
      throw new ForbiddenException('Chỉ tài xế / người hộ tống được phân công mới có quyền hoàn thành chặng.');
    }

    const legId = parse(legIdSchema, rawLegId);
    const input = parse(buildCompleteLegSchema(await this.repository.getMaxRetroactiveMinutes()), body);

    return this.repository.transaction(async repo => {
      const leg = await repo.lockLegForUpdate(legId);
      if (!leg) throw new NotFoundException('Không tìm thấy chặng.');

      const assignment = await repo.getDriverAssignment(leg.tripId, String(account.id));
      if (!assignment) throw new ForbiddenException('Bạn không được phân công chuyến này.');

      const allLegs = await repo.lockAllTripLegs(leg.tripId);
      if (leg.seqNo === allLegs.length) {
        throw new BadRequestException('Chặng cuối cùng phải được hoàn tất bằng mốc Đã giao (DELIVERED), không dùng hoàn thành chặng trung gian.');
      }

      if (leg.status !== LegStatus.AT_STOP) {
        throw new ConflictException(`Chặng phải ở trạng thái Đã đến điểm dừng (AT_STOP) để hoàn thành. Hiện tại: ${leg.status}`);
      }
      assertNotBefore(input.occurredAt, leg.actualArrivalAt, 'đến trạm dừng');

      if (leg.toLocationType === 'BORDER') {
        const customsCleared = await repo.hasMilestone(legId, MilestoneType.CUSTOMS_CLEARED);
        if (!customsCleared) {
          throw new ConflictException('Cửa khẩu biên giới bắt buộc phải có mốc Đã thông quan trước khi hoàn thành chặng.');
        }
      }

      await repo.updateLegStatus(legId, LegStatus.COMPLETED, String(account.id));
      await repo.audit(
        String(account.id),
        'LEG',
        legId,
        'COMPLETE_LEG',
        JSON.stringify({ status: leg.status }),
        JSON.stringify({ status: LegStatus.COMPLETED, occurredAt: input.occurredAt }),
        'Hoàn thành chặng trung gian'
      );
      await repo.notify(leg.plannedBy, 'LEG_COMPLETED', `Chuyến ${leg.tripId}, Chặng ${leg.seqNo} đã hoàn thành.`, 'TRIP', leg.tripId);
      await repo.notify(leg.customerId, 'ORDER_LEG_PROGRESS', `Đơn hàng ${leg.orderCode}, chặng ${leg.seqNo} đã hoàn thành.`, 'ORDER', leg.orderId);

      return { legId, status: LegStatus.COMPLETED };
    });
  }

  async correctLeg(account: User, rawLegId: string, body: unknown): Promise<{ legId: string; status: LegStatus; reason: string; orderStatus: OrderStatus }> {
    if (account.role !== Role.COORDINATOR && account.role !== Role.MANAGER) {
      throw new ForbiddenException('Chỉ Điều phối viên hoặc Quản lý mới có quyền hiệu chỉnh trạng thái chặng.');
    }

    const legId = parse(legIdSchema, rawLegId);
    const input = parse(correctLegSchema, body);

    return this.repository.transaction(async repo => {
      const leg = await repo.lockLegForUpdate(legId);
      if (!leg) throw new NotFoundException('Không tìm thấy chặng.');

      if (account.role === Role.COORDINATOR && leg.plannedBy !== String(account.id)) {
        throw new ForbiddenException('Bạn chỉ được hiệu chỉnh chặng của chuyến do mình quản lý.');
      }
      const correctableOrder = [OrderStatus.READY, OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED];
      if (!correctableOrder.includes(leg.orderStatus) || leg.planStatus !== PlanStatus.APPROVED) {
        throw new ConflictException(`Không thể hiệu chỉnh chặng khi đơn ở trạng thái ${leg.orderStatus} / kế hoạch ${leg.planStatus}.`);
      }
      if (leg.status === input.status) {
        throw new BadRequestException(`Chặng đã ở trạng thái ${input.status}.`);
      }

      // Trạng thái mới của toàn bộ chuyến phải nhất quán: chặng đã/đang chạy thì mọi chặng trước phải COMPLETED.
      const allLegs = await repo.lockAllTripLegs(leg.tripId);
      const nextStatuses = allLegs.map(l => (l.id === legId ? input.status : l.status));
      nextStatuses.forEach((status, index) => {
        if (status !== LegStatus.NOT_STARTED && nextStatuses.slice(0, index).some(prev => prev !== LegStatus.COMPLETED)) {
          throw new ConflictException(`Trạng thái mới làm sai thứ tự chặng: Chặng ${index + 1} là ${status} nhưng có chặng trước chưa hoàn thành.`);
        }
      });

      const isLast = leg.seqNo === allLegs.length;
      const isBorder = leg.toLocationType === 'BORDER';
      const required = milestonesRequired(input.status, isBorder, isLast);
      const keep = new Set<MilestoneType>(required);
      if (input.status === LegStatus.AT_STOP && isBorder) keep.add(MilestoneType.CUSTOMS_CLEARED);

      const existing = await repo.getLegMilestoneRecords(legId);
      const removed = existing.filter(m => !keep.has(m.milestoneType));
      const existingTypes = new Set(existing.map(m => m.milestoneType));
      const added = required.filter(type => !existingTypes.has(type));

      const at = input.occurredAt ? new Date(input.occurredAt) : new Date();
      const rank = LEG_STATUS_RANK[input.status];
      const departure = rank >= 1 ? (leg.actualDepartureAt ?? at) : null;
      let arrival = rank >= 2 ? (leg.actualArrivalAt ?? at) : null;
      if (arrival && departure && arrival < departure) arrival = departure;

      const actorId = String(account.id);
      await repo.deleteMilestones(removed.map(m => m.id));
      for (const type of added) {
        await repo.insertMilestone(legId, type, at.toISOString(), actorId);
      }
      await repo.updateLegCorrection(legId, input.status, departure, arrival, actorId);

      const nextOrderStatus = nextStatuses.every(status => status === LegStatus.COMPLETED)
        ? OrderStatus.DELIVERED
        : nextStatuses.some(status => status !== LegStatus.NOT_STARTED)
          ? OrderStatus.IN_TRANSIT
          : OrderStatus.READY;
      if (nextOrderStatus !== leg.orderStatus) {
        await repo.updateOrderStatus(leg.orderId, nextOrderStatus);
        await repo.audit(
          actorId,
          'ORDER',
          leg.orderId,
          'STATUS_CHANGE',
          JSON.stringify({ status: leg.orderStatus }),
          JSON.stringify({ status: nextOrderStatus }),
          `Đồng bộ do hiệu chỉnh chặng ${leg.seqNo}: ${input.reason}`.slice(0, 255)
        );
      }

      await repo.audit(
        actorId,
        'LEG',
        legId,
        'CORRECT_LEG_STATUS',
        JSON.stringify({
          status: leg.status,
          actualDepartureAt: leg.actualDepartureAt,
          actualArrivalAt: leg.actualArrivalAt,
          removedMilestones: removed.map(m => ({ type: m.milestoneType, occurredAt: m.occurredAt })),
        }),
        JSON.stringify({
          status: input.status,
          actualDepartureAt: departure,
          actualArrivalAt: arrival,
          addedMilestones: added,
        }),
        input.reason
      );

      await repo.notifyStakeholders(
        leg.tripId,
        leg.orderId,
        'LEG_CORRECTED',
        `Chuyến ${leg.tripId}, Chặng ${leg.seqNo} được hiệu chỉnh: ${leg.status} → ${input.status}. Lý do: ${input.reason}`
      );

      return { legId, status: input.status, reason: input.reason, orderStatus: nextOrderStatus };
    });
  }

  // ─── Giai đoạn 2: nhật ký ngựa, sự cố, cảnh báo, ảnh đính kèm ─────────────────

  /** Kiểm tra vai trò rồi quyền theo chuyến; người ngoài phạm vi nhận 404 để không lộ sự tồn tại. */
  private async authorizeTrip(repo: TrackingRepository, account: User, tripId: string, allowed: Role[]) {
    if (!allowed.includes(account.role)) {
      throw new ForbiddenException('Vai trò của bạn không có quyền thực hiện thao tác này.');
    }
    const trip = await repo.findTrip(tripId);
    if (!trip) throw new NotFoundException('Không tìm thấy chuyến đi.');
    if (account.role === Role.DRIVER_ESCORT) {
      if (!(await repo.getDriverAssignment(tripId, String(account.id)))) {
        throw new NotFoundException('Không tìm thấy chuyến đi hoặc bạn không được phân công chuyến này.');
      }
    } else if (account.role === Role.COORDINATOR && trip.plannedBy !== String(account.id)) {
      throw new NotFoundException('Không tìm thấy chuyến đi.');
    }
    return trip;
  }

  async createHorseLog(account: User, rawLegId: string, body: unknown, files: Upload[] = []): Promise<IHorseLog> {
    if (account.role !== Role.DRIVER_ESCORT) {
      throw new ForbiddenException('Chỉ tài xế / người hộ tống được phân công mới được ghi nhật ký ngựa.');
    }
    const legId = parse(legIdSchema, rawLegId);
    const input = parse(createHorseLogSchema, normalizeForm(body));
    assertPhotos(files);

    const saved: StoredFile[] = [];
    try {
      for (const file of files) saved.push(await saveFile(file));
      return await this.repository.transaction(async repo => {
        const leg = await repo.lockLegForUpdate(legId);
        if (!leg) throw new NotFoundException('Không tìm thấy chặng.');
        if (!(await repo.getDriverAssignment(leg.tripId, String(account.id)))) {
          throw new ForbiddenException('Bạn không được phân công chuyến này.');
        }
        if (leg.orderStatus !== OrderStatus.IN_TRANSIT || leg.status === LegStatus.NOT_STARTED) {
          throw new ConflictException('Chỉ ghi nhật ký ngựa khi chuyến đang vận chuyển và chặng đã xuất phát.');
        }
        if (!(await repo.checkHorseBelongsToOrder(input.horseId, leg.orderId))) {
          throw new BadRequestException('Ngựa không thuộc đơn hàng của chuyến này.');
        }
        if (input.correctsLogId) {
          const original = await repo.findHorseLog(input.correctsLogId);
          if (!original || original.tripId !== leg.tripId || original.horseId !== input.horseId) {
            throw new BadRequestException('Bản ghi được đính chính phải thuộc cùng chuyến và cùng con ngựa.');
          }
        }

        const logId = await repo.insertHorseLog(
          input.horseId, legId, input.conditionStatus, input.note ?? null, input.loggedAt, String(account.id), input.correctsLogId ?? null
        );
        for (const file of saved) {
          await repo.insertAttachmentRecord(file.name, file.type, file.size, file.key, String(account.id), logId, null);
        }
        await repo.audit(
          String(account.id), 'HORSE_LOG', logId, 'CREATE_HORSE_LOG', null,
          JSON.stringify({ horseId: input.horseId, legId, conditionStatus: input.conditionStatus, correctsLogId: input.correctsLogId ?? null, photos: saved.length })
        );

        const logs = await this.loadHorseLogs(repo, leg.tripId);
        return logs.find(log => log.id === logId)!;
      });
    } catch (error) {
      await Promise.all(saved.map(file => removeFile(file.key)));
      throw error;
    }
  }

  async getTripHorseLogs(account: User, rawTripId: string): Promise<IHorseLog[]> {
    const tripId = parse(legIdSchema, rawTripId);
    await this.authorizeTrip(this.repository, account, tripId, [Role.MANAGER, Role.COORDINATOR, Role.SPECIALIST, Role.DRIVER_ESCORT]);
    return this.loadHorseLogs(this.repository, tripId);
  }

  async createIncident(account: User, rawTripId: string, body: unknown, files: Upload[] = []): Promise<IIncident> {
    if (account.role !== Role.DRIVER_ESCORT) {
      throw new ForbiddenException('Chỉ tài xế / người hộ tống được phân công mới được báo sự cố.');
    }
    const tripId = parse(legIdSchema, rawTripId);
    const input = parse(createIncidentSchema, normalizeForm(body));
    assertPhotos(files);
    if (input.captions.length > files.length) {
      throw new BadRequestException('Số nhãn ảnh không được nhiều hơn số ảnh.');
    }

    const saved: StoredFile[] = [];
    try {
      for (const file of files) saved.push(await saveFile(file));
      return await this.repository.transaction(async repo => {
        const trip = await this.authorizeTrip(repo, account, tripId, [Role.DRIVER_ESCORT]);
        // 5.4: cho báo sự cố cả lúc chuẩn bị khởi hành (chất ngựa lên xe, trước giờ chạy).
        if (trip.orderStatus !== OrderStatus.READY && trip.orderStatus !== OrderStatus.IN_TRANSIT) {
          throw new ConflictException('Chỉ báo sự cố khi chuyến sẵn sàng khởi hành (READY) hoặc đang vận chuyển (IN_TRANSIT).');
        }
        if (input.legId && !(await repo.legBelongsToTrip(input.legId, tripId))) {
          throw new BadRequestException('Chặng không thuộc chuyến này.');
        }
        if (input.horseId && !(await repo.checkHorseBelongsToOrder(input.horseId, trip.orderId))) {
          throw new BadRequestException('Ngựa không thuộc đơn hàng của chuyến này.');
        }

        // 5.1: mức đỏ hoặc y tế ngựa là khẩn cấp cao; không tự đổi lộ trình/chặng (BR-INC-03).
        const urgency = input.severity === IncidentSeverity.RED || input.incidentType === IncidentType.HORSE_MEDICAL
          ? IncidentUrgency.HIGH : IncidentUrgency.NORMAL;
        const subType = input.subType || null;
        const incidentId = await repo.insertIncident({
          tripId, legId: input.legId ?? null, horseId: input.horseId ?? null, incidentType: input.incidentType, description: input.description,
          urgency, severity: input.severity, subType, damageTarget: input.damageTarget,
          latitude: input.latitude ?? null, longitude: input.longitude ?? null, locationText: input.locationText || null,
          reportedBy: String(account.id), reportedAt: new Date().toISOString(),
        });
        for (const [index, file] of saved.entries()) {
          await repo.insertAttachmentRecord(file.name, file.type, file.size, file.key, String(account.id), null, incidentId, input.captions[index] || null);
        }
        await repo.audit(
          String(account.id), 'INCIDENT', incidentId, 'REPORT_INCIDENT', null,
          JSON.stringify({
            tripId, legId: input.legId ?? null, horseId: input.horseId ?? null, incidentType: input.incidentType, urgency,
            severity: input.severity, subType, damageTarget: input.damageTarget,
          })
        );
        await repo.notifyManagersAndCoordinators(
          tripId,
          'INCIDENT_REPORTED',
          `${urgency === IncidentUrgency.HIGH ? '[KHẨN] ' : ''}Chuyến ${tripId} (đơn ${trip.orderCode}): sự cố ${INCIDENT_LABELS[input.incidentType]}.`
        );

        const incidents = await this.loadIncidents(repo, tripId);
        return incidents.find(incident => incident.id === incidentId)!;
      });
    } catch (error) {
      await Promise.all(saved.map(file => removeFile(file.key)));
      throw error;
    }
  }

  async getTripIncidents(account: User, rawTripId: string): Promise<IIncident[]> {
    const tripId = parse(legIdSchema, rawTripId);
    await this.authorizeTrip(this.repository, account, tripId, [Role.MANAGER, Role.COORDINATOR, Role.DRIVER_ESCORT]);
    return this.loadIncidents(this.repository, tripId);
  }

  async updateIncident(account: User, rawIncidentId: string, body: unknown): Promise<IIncident> {
    if (account.role !== Role.COORDINATOR) {
      throw new ForbiddenException('Chỉ Điều phối viên phụ trách mới được tiếp nhận hoặc đóng sự cố.');
    }
    const incidentId = parse(legIdSchema, rawIncidentId);
    const input = parse(patchIncidentSchema, body);

    const result = await this.repository.transaction(async repo => {
      const incident = await repo.findIncident(incidentId);
      if (!incident || incident.plannedBy !== String(account.id)) {
        throw new NotFoundException('Không tìm thấy sự cố.');
      }
      if (incident.status === IncidentStatus.CLOSED) {
        throw new ConflictException('Sự cố đã đóng, không thể cập nhật.');
      }
      if (input.status === IncidentStatus.ACKNOWLEDGED && incident.status !== IncidentStatus.NEW) {
        throw new ConflictException('Sự cố đã được tiếp nhận.');
      }

      await repo.updateIncidentStatus(incidentId, input.status, String(account.id), input.handlingNote ?? null);
      await repo.audit(
        String(account.id), 'INCIDENT', incidentId, 'UPDATE_INCIDENT',
        JSON.stringify({ status: incident.status }),
        JSON.stringify({ status: input.status, handlingNote: input.handlingNote ?? null })
      );
      await repo.notify(
        incident.reportedBy,
        input.status === IncidentStatus.CLOSED ? 'INCIDENT_CLOSED' : 'INCIDENT_ACKNOWLEDGED',
        input.status === IncidentStatus.CLOSED
          ? `Sự cố #${incidentId} đã được đóng. Hướng xử lý: ${input.handlingNote}`
          : `Điều phối viên đã tiếp nhận sự cố #${incidentId}.`,
        'TRIP',
        incident.tripId
      );

      const incidents = await this.loadIncidents(repo, incident.tripId);
      return { saved: incidents.find(item => item.id === incidentId)!, reportedBy: incident.reportedBy, tripId: incident.tripId };
    });
    await this.publish('incident_updated', async () => {
      this.realtime.emitToUsers([result.reportedBy], 'tracking:incident_updated', {
        incidentId, tripId: result.tripId, status: result.saved.status, handlingNote: result.saved.handlingNote ?? null,
      });
      await this.emitNewNotifications([result.reportedBy], input.status === IncidentStatus.CLOSED ? 'INCIDENT_CLOSED' : 'INCIDENT_ACKNOWLEDGED', result.tripId);
    });
    return result.saved;
  }

  async createAlert(account: User, rawTripId: string, body: unknown): Promise<IAlert> {
    if (account.role !== Role.COORDINATOR) {
      throw new ForbiddenException('Chỉ Điều phối viên phụ trách mới được phát cảnh báo.');
    }
    const tripId = parse(legIdSchema, rawTripId);
    const input = parse(createAlertSchema, body);

    const saved = await this.repository.transaction(async repo => {
      const trip = await this.authorizeTrip(repo, account, tripId, [Role.COORDINATOR]);
      if (trip.orderStatus !== OrderStatus.READY && trip.orderStatus !== OrderStatus.IN_TRANSIT) {
        throw new ConflictException('Chỉ phát cảnh báo cho chuyến đang chuẩn bị xuất phát hoặc đang vận chuyển.');
      }

      const alertId = await repo.insertAlert(tripId, input.alertType, input.content, String(account.id), new Date().toISOString());
      await repo.audit(
        String(account.id), 'ALERT', alertId, 'SEND_ALERT', null,
        JSON.stringify({ tripId, alertType: input.alertType })
      );
      await repo.notifyCrewAndManagers(tripId, 'TRIP_ALERT', `Cảnh báo ${ALERT_LABELS[input.alertType]} chuyến ${tripId} (đơn ${trip.orderCode}): ${input.content}`, true);

      const alerts = await this.loadAlerts(repo, tripId);
      return alerts.find(alert => alert.id === alertId)!;
    });
    await this.publish('alert', async () => {
      const crew = await this.repository.getTripCrewIds(tripId);
      this.realtime.emitToUsers(crew, 'tracking:alert', {
        alertId: saved.id, tripId, alertType: saved.alertType, content: saved.content, sentByName: saved.sentByName, sentAt: saved.sentAt,
      });
      await this.emitNewNotifications(crew, 'TRIP_ALERT', tripId);
    });
    return saved;
  }

  async getTripAlerts(account: User, rawTripId: string): Promise<IAlert[]> {
    const tripId = parse(legIdSchema, rawTripId);
    await this.authorizeTrip(this.repository, account, tripId, [Role.MANAGER, Role.COORDINATOR, Role.SPECIALIST, Role.DRIVER_ESCORT]);
    return this.loadAlerts(this.repository, tripId);
  }

  async getAttachmentFile(account: User, rawId: string): Promise<{ buffer: Buffer; originalName: string; fileType: 'PDF' | 'JPG' | 'PNG' }> {
    const id = parse(legIdSchema, rawId);
    const attachment = await this.repository.findAttachment(id);
    if (!attachment) throw new NotFoundException('Không tìm thấy tệp đính kèm.');
    // Ảnh nhật ký ngựa: cả Specialist được xem; ảnh sự cố chỉ Manager/Coordinator/Driver.
    const allowed = attachment.incidentId
      ? [Role.MANAGER, Role.COORDINATOR, Role.DRIVER_ESCORT]
      : [Role.MANAGER, Role.COORDINATOR, Role.SPECIALIST, Role.DRIVER_ESCORT];
    try {
      await this.authorizeTrip(this.repository, account, attachment.tripId, allowed);
    } catch (error) {
      if (error instanceof ForbiddenException) throw new NotFoundException('Không tìm thấy tệp đính kèm.');
      throw error;
    }
    return { buffer: await loadFile(attachment.storagePath), originalName: attachment.originalName, fileType: attachment.fileType };
  }

  // ─── Giai đoạn 3: timeline và dashboard vận hành ──────────────────────────────

  /** Customer xem tiến độ đơn của mình. Đơn của người khác trả 404 như đơn không tồn tại (BR-SEC-01). */
  async getOrderTimeline(account: User, rawOrderId: string): Promise<IOrderTimeline> {
    if (account.role !== Role.CUSTOMER) {
      throw new ForbiddenException('Chỉ khách hàng mới xem timeline theo đơn hàng của mình.');
    }
    const orderId = parse(legIdSchema, rawOrderId);
    const header = await this.repository.findOrderForTimeline(orderId);
    if (!header || header.customerId !== String(account.id)) {
      throw new NotFoundException('Không tìm thấy đơn hàng.');
    }

    // Kế hoạch nháp/chờ duyệt chưa phải thông tin vận chuyển cam kết với khách.
    const visible = header.tripId !== null && header.planStatus === PlanStatus.APPROVED
      && [OrderStatus.READY, OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED].includes(header.orderStatus);
    const legRows = visible ? await this.repository.getTripLegs(header.tripId!) : [];
    const milestones = await this.repository.getLegMilestones(legRows.map(l => l.id));
    const now = Date.now();

    const legs: ITimelineLeg[] = legRows.map(leg => {
      const own = milestones.filter(m => m.legId === leg.id);
      const latest = own[own.length - 1];
      return {
        seqNo: leg.seqNo,
        fromLocationName: leg.fromLocationName,
        toLocationName: leg.toLocationName,
        plannedDepartureAt: leg.plannedDepartureAt.toISOString(),
        plannedArrivalAt: leg.plannedArrivalAt.toISOString(),
        status: leg.status,
        actualDepartureAt: leg.actualDepartureAt ? leg.actualDepartureAt.toISOString() : null,
        actualArrivalAt: leg.actualArrivalAt ? leg.actualArrivalAt.toISOString() : null,
        milestones: own.map(m => ({ milestoneType: m.milestoneType, occurredAt: m.occurredAt.toISOString(), recordedByName: m.recordedByName })),
        latestMilestone: latest ? latest.milestoneType : null,
        latestMilestoneAt: latest ? latest.occurredAt.toISOString() : null,
        lastUpdatedByName: leg.updatedByName,
        lastUpdatedAt: leg.updatedAt ? leg.updatedAt.toISOString() : null,
        isOverdue: isLegOverdue(leg, now),
      };
    });
    const last = latestUpdate(legRows);

    return {
      orderId: header.orderId,
      orderCode: header.orderCode,
      orderStatus: header.orderStatus,
      plannedDepartureAt: visible && header.plannedDepartureAt ? header.plannedDepartureAt.toISOString() : null,
      plannedArrivalAt: visible && header.plannedArrivalAt ? header.plannedArrivalAt.toISOString() : null,
      lastUpdatedAt: last.at,
      lastUpdatedByName: last.byName,
      legs,
    };
  }

  /** Timeline nội bộ: chặng (kế hoạch vs thực tế), nhật ký ngựa, sự cố và cảnh báo của một chuyến. */
  async getTripTimeline(account: User, rawTripId: string): Promise<ITripTimeline> {
    const tripId = parse(legIdSchema, rawTripId);
    const trip = await this.authorizeTrip(this.repository, account, tripId, [Role.DRIVER_ESCORT, Role.COORDINATOR, Role.MANAGER, Role.SPECIALIST]);

    const legRows = await this.repository.getTripLegs(tripId);
    const milestones = await this.repository.getLegMilestones(legRows.map(l => l.id));
    const now = Date.now();
    const last = latestUpdate(legRows);

    return {
      tripId: trip.id,
      orderId: trip.orderId,
      orderCode: trip.orderCode,
      orderStatus: trip.orderStatus,
      planStatus: trip.planStatus,
      plannedDepartureAt: trip.plannedDepartureAt ? trip.plannedDepartureAt.toISOString() : null,
      plannedArrivalAt: trip.plannedArrivalAt ? trip.plannedArrivalAt.toISOString() : null,
      lastUpdatedAt: last.at,
      lastUpdatedByName: last.byName,
      legs: legRows.map(leg => ({ ...mapLegWithMilestones(leg, milestones), isOverdue: isLegOverdue(leg, now) })),
      horseLogs: await this.loadHorseLogs(this.repository, tripId),
      incidents: account.role === Role.SPECIALIST ? [] : await this.loadIncidents(this.repository, tripId),
      alerts: await this.loadAlerts(this.repository, tripId),
    };
  }

  /** Dashboard vận hành: chuyến đang chạy hoặc còn sự cố chưa đóng. Manager và Specialist (chỉ đọc) xem tất cả, Coordinator chỉ chuyến mình lập. */
  async getActiveTrips(account: User): Promise<IActiveTrips> {
    if (account.role !== Role.MANAGER && account.role !== Role.COORDINATOR && account.role !== Role.SPECIALIST) {
      throw new ForbiddenException('Chỉ Quản lý, Điều phối viên hoặc Chuyên viên hồ sơ mới xem dashboard vận hành.');
    }
    const trips = await this.repository.getActiveTrips(account.role === Role.COORDINATOR ? String(account.id) : null, ACTIVE_TRIPS_LIMIT);
    const tripIds = trips.map(t => t.tripId);
    const [legRows, incidentCounts] = await Promise.all([
      this.repository.getLegsForTrips(tripIds),
      this.repository.getOpenIncidentCounts(tripIds),
    ]);
    const now = Date.now();

    const items: IActiveTripItem[] = trips.map(trip => {
      const legs = legRows.filter(l => l.tripId === trip.tripId);
      const counts = incidentCounts.find(c => c.tripId === trip.tripId);
      const current = legs.find(l => l.status === LegStatus.MOVING || l.status === LegStatus.AT_STOP)
        ?? legs.find(l => l.status !== LegStatus.COMPLETED);
      const last = latestUpdate(legs);
      return {
        tripId: trip.tripId,
        orderId: trip.orderId,
        orderCode: trip.orderCode,
        orderStatus: trip.orderStatus,
        customerName: trip.customerName,
        plannedDepartureAt: trip.plannedDepartureAt ? trip.plannedDepartureAt.toISOString() : null,
        plannedArrivalAt: trip.plannedArrivalAt ? trip.plannedArrivalAt.toISOString() : null,
        legCount: legs.length,
        completedLegs: legs.filter(l => l.status === LegStatus.COMPLETED).length,
        currentLeg: current
          ? { seqNo: current.seqNo, fromLocationName: current.fromLocationName, toLocationName: current.toLocationName, status: current.status }
          : null,
        openIncidents: counts?.open ?? 0,
        highUrgencyOpenIncidents: counts?.high ?? 0,
        isOverdue: trip.orderStatus === OrderStatus.IN_TRANSIT && legs.some(l => isLegOverdue(l, now)),
        lastUpdatedAt: last.at,
        lastUpdatedByName: last.byName,
      };
    });

    // Khẩn cấp lên đầu, rồi chuyến trễ, rồi chuyến mới nhất.
    items.sort((a, b) =>
      b.highUrgencyOpenIncidents - a.highUrgencyOpenIncidents
      || Number(b.isOverdue) - Number(a.isOverdue)
      || Number(b.tripId) - Number(a.tripId)
    );

    return {
      summary: {
        inTransit: items.filter(i => i.orderStatus === OrderStatus.IN_TRANSIT).length,
        openIncidents: items.reduce((sum, i) => sum + i.openIncidents, 0),
        overdueTrips: items.filter(i => i.isOverdue).length,
      },
      items,
    };
  }

  private async loadHorseLogs(repo: TrackingRepository, tripId: string): Promise<IHorseLog[]> {
    const rows = await repo.getTripHorseLogs(tripId);
    const attachments = await repo.getHorseLogAttachments(rows.map(row => row.id));
    return rows.map(row => ({
      id: row.id,
      horseId: row.horseId,
      horseName: row.horseName,
      legId: row.legId,
      conditionStatus: row.conditionStatus,
      note: row.note,
      loggedAt: row.loggedAt.toISOString(),
      createdBy: row.createdBy,
      createdByName: row.createdByName,
      correctsLogId: row.correctsLogId,
      attachments: attachments.filter(a => a.horseLogId === row.id).map(toAttachment),
    }));
  }

  private async loadIncidents(repo: TrackingRepository, tripId: string): Promise<IIncident[]> {
    const rows = await repo.getTripIncidents(tripId);
    const attachments = await repo.getIncidentAttachments(rows.map(row => row.id));
    return rows.map(row => ({
      ...row,
      // Rows written before the D2 fields existed (and test doubles) may lack them entirely.
      severity: row.severity ?? null,
      subType: row.subType ?? null,
      damageTarget: row.damageTarget ?? null,
      latitude: row.latitude ?? null,
      longitude: row.longitude ?? null,
      locationText: row.locationText ?? null,
      reportedAt: row.reportedAt.toISOString(),
      closedAt: row.closedAt ? row.closedAt.toISOString() : null,
      attachments: attachments.filter(a => a.incidentId === row.id).map(toAttachment),
    }));
  }

  private async loadAlerts(repo: TrackingRepository, tripId: string): Promise<IAlert[]> {
    const rows = await repo.getTripAlerts(tripId);
    return rows.map(row => ({ ...row, sentAt: row.sentAt.toISOString() }));
  }

  // ─── Bản đồ chuyến + GPS (kế hoạch Bước 4 + 6) ──────────────────────────────

  /**
   * Bản đồ một chuyến: Driver/Escort được phân công, Coordinator chuyến mình lập, Manager, Specialist (quyết định #4:
   * Specialist và Manager xem GPS mọi chuyến). Customer không gọi API này. Không trả sự cố, nên Specialist không bị lọc thêm.
   */
  async getTripMap(account: User, rawTripId: string): Promise<ITripMap> {
    const tripId = parse(legIdSchema, rawTripId);
    const trip = await this.authorizeTrip(this.repository, account, tripId, [Role.DRIVER_ESCORT, Role.COORDINATOR, Role.MANAGER, Role.SPECIALIST]);
    const [legs, latest, speedLimitKmh] = await Promise.all([
      this.repository.getTripMapLegs(tripId),
      this.repository.getLatestPosition(tripId),
      this.repository.getSpeedLimitKmh(),
    ]);
    const routes = new Map<string, ResolvedRoute | null>();
    await Promise.all(legs.map(async leg => {
      const { from, to } = legEnds(leg);
      routes.set(leg.id, from && to ? await this.routes.route(leg.fromId, leg.toId, from, to, modeForVehicle(leg.vehicleType)) : null);
    }));
    return buildTripMap({ trip: { id: trip.id, orderCode: trip.orderCode, orderStatus: trip.orderStatus }, legs, routes, latest, speedLimitKmh, now: Date.now() });
  }

  /**
   * Nhận lô vị trí từ Driver/Escort được phân công. Chỉ khi đơn IN_TRANSIT, có chặng đang MOVING/AT_STOP và chặng đó
   * không phải chặng bay (409). Gửi lại cùng `recordedAt` không tạo bản ghi trùng (INSERT IGNORE theo khóa duy nhất).
   */
  async recordPositions(account: User, rawTripId: string, body: unknown): Promise<ITripPositionBatchResult> {
    if (account.role !== Role.DRIVER_ESCORT) {
      throw new ForbiddenException('Chỉ tài xế / người hộ tống được phân công mới gửi vị trí.');
    }
    const tripId = parse(legIdSchema, rawTripId);
    const input = parse(positionsBatchSchema, body);
    const trip = await this.authorizeTrip(this.repository, account, tripId, [Role.DRIVER_ESCORT]);
    if (trip.orderStatus !== OrderStatus.IN_TRANSIT) {
      throw new ConflictException('Chỉ nhận vị trí khi chuyến đang vận chuyển (IN_TRANSIT).');
    }
    const legs = await this.repository.getTripMapLegs(tripId);
    const leg = legs.find(item => item.status === LegStatus.MOVING || item.status === LegStatus.AT_STOP);
    if (!leg) throw new ConflictException('Chưa có chặng nào đang chạy để gắn vị trí.');
    if (modeForVehicle(leg.vehicleType) === 'AIR') {
      throw new ConflictException('Chặng bay không nhận GPS; vị trí được ước tính theo kế hoạch.');
    }
    const accepted = await this.repository.insertPositions(tripId, leg.id, String(account.id), input.points.map(point => ({
      latitude: point.latitude,
      longitude: point.longitude,
      accuracyM: point.accuracyM ?? null,
      speedMps: point.speedMps ?? null,
      headingDeg: point.headingDeg ?? null,
      recordedAt: new Date(point.recordedAt),
    })));
    return { legId: leg.id, accepted, duplicates: input.points.length - accepted };
  }

  /** Vệt đường đã đi (tối đa 500 điểm mới nhất sau `since`). Cùng quyền với bản đồ chuyến. */
  async getTrackPoints(account: User, rawTripId: string, query: unknown): Promise<ITripTrackPoint[]> {
    const tripId = parse(legIdSchema, rawTripId);
    const { since } = parse(trackQuerySchema, query);
    await this.authorizeTrip(this.repository, account, tripId, [Role.DRIVER_ESCORT, Role.COORDINATOR, Role.MANAGER, Role.SPECIALIST]);
    const rows = await this.repository.getTrackPoints(tripId, since ? new Date(since) : null, MAX_TRACK_POINTS);
    return rows.map(row => {
      const point = toLatestPosition(row, Date.now())!;
      return { lat: point.lat, lng: point.lng, speedKmh: point.speedKmh, recordedAt: point.recordedAt, legId: point.legId };
    });
  }

  /** Xóa vị trí cũ hơn TRACK_POSITION_RETENTION_DAYS (dữ liệu cá nhân); chạy mỗi giờ, không chạy chồng. */
  startPositionRetentionJob() {
    if (this.retentionTimer) return;
    this.retentionTimer = setInterval(() => void this.purgeOldPositions(), RETENTION_INTERVAL_MS);
    this.retentionTimer.unref();
    void this.purgeOldPositions();
  }

  async stopPositionRetentionJob() {
    if (this.retentionTimer) clearInterval(this.retentionTimer);
    this.retentionTimer = undefined;
    await this.retentionRun;
  }

  purgeOldPositions(): Promise<number> {
    if (this.retentionRun) return this.retentionRun;
    this.retentionRun = this.runRetention().finally(() => { this.retentionRun = undefined; });
    return this.retentionRun;
  }

  private async runRetention(): Promise<number> {
    let removed = 0;
    try {
      // Xóa theo lô để không khóa bảng lâu; giới hạn số lô mỗi lần chạy.
      for (let i = 0; i < 20; i++) {
        const batch = await this.repository.deletePositionsOlderThan(retentionDays(), RETENTION_BATCH);
        removed += batch;
        if (batch < RETENTION_BATCH) break;
      }
      if (removed) retentionLogger.info('positions_purged', { removed, days: retentionDays() });
    } catch (error) {
      retentionLogger.error('positions_purge_failed', { message: error instanceof Error ? error.message : String(error) });
    }
    return removed;
  }
}
