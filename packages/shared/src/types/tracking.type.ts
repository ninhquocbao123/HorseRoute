/**
 * Shared DTO interfaces for Flow 4 — Tracking & Journey Logging.
 * Used by both the API (apps/api) and the web client (apps/web).
 *
 * ID fields are always string (BIGINT UNSIGNED cast to CHAR in MySQL queries).
 * Datetime fields are always ISO 8601 UTC string (e.g. "2026-10-18T10:00:00.000Z").
 */

import {
  LegStatus,
  MilestoneType,
  HorseConditionStatus,
  HorseAppetite,
  HorseReportStatus,
  CareActivityType,
  IncidentType,
  IncidentUrgency,
  IncidentStatus,
  IncidentSeverity,
  DamageTarget,
  AlertType,
} from '../enums/tracking.enum';
import { CrewRole, OrderStatus, PlanStatus } from '../enums/order.enum';

// ─── Leg milestone (leg_milestones) ──────────────────────────────────────────

export interface ILegMilestone {
  id: string;
  legId: string;
  milestoneType: MilestoneType;
  occurredAt: string; // ISO UTC
  recordedBy: string; // userId
  recordedByName: string;
}

// ─── Leg with operational data (legs + leg_milestones) ───────────────────────

export interface ILegTracking {
  id: string;
  seqNo: number;
  fromLocationId: string;
  fromLocationName: string;
  toLocationId: string;
  toLocationName: string;
  /** locations.location_type của điểm đến; BORDER yêu cầu mốc CUSTOMS_CLEARED */
  toLocationType: string;
  vehicleId: string | null;
  vehicleCode: string | null;
  plannedDepartureAt: string;
  plannedArrivalAt: string;
  status: LegStatus;
  actualDepartureAt: string | null;
  actualArrivalAt: string | null;
  updatedAt: string | null;
  updatedByName: string | null;
  milestones: ILegMilestone[];
}

// ─── Horse log entry (horse_logs) ─────────────────────────────────────────────

export interface IHorseLog {
  id: string;
  horseId: string;
  horseName: string;
  legId: string;
  conditionStatus: HorseConditionStatus;
  note: string | null;
  loggedAt: string; // ISO UTC
  createdBy: string; // userId
  createdByName: string;
  /** Vai trò trong chuyến của người ghi (DRIVER/ESCORT); null nếu không còn được phân công. */
  createdByCrewRole: CrewRole | null;
  correctsLogId: string | null; // if this entry corrects an earlier one
  // Báo cáo sức khỏe (gap-analysis-escort.md). Nhật ký cũ: null / false.
  bodyTempC: number | null;
  heartRateBpm: number | null;
  appetite: HorseAppetite | null;
  /** Ghi chú gửi khách (tách khỏi `note` nội bộ) */
  customerNote: string | null;
  /** null = nhật ký cũ, không phải báo cáo */
  reportStatus: HorseReportStatus | null;
  sendToCustomer: boolean;
  sentAt: string | null;
  customerViewedAt: string | null;
  attachments: ILogAttachment[];
}

/** Ảnh của báo cáo sức khỏe khách xem được (tải qua GET /tracking/attachments/:id) */
export interface IHorseReportPhoto {
  id: string;
  caption: string | null;
  fileType: 'PDF' | 'JPG' | 'PNG';
}

/** Báo cáo sức khỏe ngựa đã gửi cho khách: GET /tracking/orders/:orderId/horse-reports (chỉ bản mới nhất của chuỗi đính chính) */
export interface IHorseReport {
  id: string;
  horseId: string;
  horseName: string;
  conditionStatus: HorseConditionStatus;
  bodyTempC: number | null;
  heartRateBpm: number | null;
  appetite: HorseAppetite | null;
  customerNote: string | null;
  photos: IHorseReportPhoto[];
  loggedAt: string;
  sentAt: string;
  /** null = khách chưa mở chi tiết */
  viewedAt: string | null;
  escortName: string;
}

/** Trường gửi lên khi hộ tống tạo / sửa báo cáo sức khỏe (multipart: ảnh ở field `photos`) */
export interface IHorseReportInput {
  horseId: string;
  conditionStatus: HorseConditionStatus;
  loggedAt: string;
  note?: string | null;
  customerNote?: string | null;
  bodyTempC?: number | null;
  heartRateBpm?: number | null;
  appetite?: HorseAppetite | null;
  /** Nhãn theo thứ tự ảnh */
  captions?: string[];
  reportStatus: HorseReportStatus;
  sendToCustomer?: boolean;
  correctsLogId?: string | null;
}

// ─── Care activity (horse_care_activities) ───────────────────────────────────

export interface ICareActivity {
  id: string;
  tripId: string;
  legId: string | null;
  /** null = cả đoàn (chỉ nghỉ chân) */
  horseId: string | null;
  horseName: string | null;
  activityType: CareActivityType;
  /** Khẩu phần (cho ăn) */
  feedDescription: string | null;
  /** Lượng nước, lít (uống nước) */
  amountLiters: number | null;
  /** Số phút (nghỉ chân) */
  durationMinutes: number | null;
  note: string | null;
  performedAt: string; // ISO UTC
  createdBy: string;
  createdByName: string;
  createdAt: string;
  correctsActivityId: string | null;
}

export interface ILogAttachment {
  id: string;
  originalName: string;
  fileType: 'PDF' | 'JPG' | 'PNG';
  sizeBytes: number;
  uploadedAt: string;
  /** Nhãn ảnh, ví dụ "Lốp sau"; null với ảnh cũ */
  caption: string | null;
}

// ─── Incident (incidents + attachments) ──────────────────────────────────────

export interface IIncident {
  id: string;
  tripId: string;
  legId: string | null;
  horseId: string | null;
  horseName: string | null;
  incidentType: IncidentType;
  description: string;
  urgency: IncidentUrgency;
  /** Các trường dưới đây null với sự cố báo trước khi có màn D2 */
  severity: IncidentSeverity | null;
  /** Mã trong INCIDENT_SUB_TYPES[incidentType] */
  subType: string | null;
  damageTarget: DamageTarget | null;
  latitude: number | null;
  longitude: number | null;
  locationText: string | null;
  status: IncidentStatus;
  reportedBy: string;
  reportedByName: string;
  reportedAt: string;
  receivedBy: string | null;
  handlingNote: string | null;
  closedAt: string | null;
  attachments: ILogAttachment[];
}

// ─── Alert (alerts) ───────────────────────────────────────────────────────────

export interface IAlert {
  id: string;
  tripId: string;
  alertType: AlertType;
  content: string;
  sentBy: string;
  sentByName: string;
  sentAt: string;
  /**
   * Thông báo IN_APP (`TRIP_ALERT`) tương ứng của CHÍNH người gọi, ghép MỘT-MỘT theo thứ tự (cùng chuyến + người nhận + nội dung: cảnh báo thứ k ↔ thông báo thứ k); null khi không có
   * (người gọi không nhận thông báo, hoặc cảnh báo cũ trước khi có thông báo). Toast chỉ hiện cho cảnh báo có thông báo chưa đọc.
   */
  notificationId: string | null;
  notificationRead: boolean | null;
}

// ─── Trip tracking summary (trips + legs for Driver view) ─────────────────────

export interface IDriverTripSummary {
  id: string;               // tripId
  orderId: string;
  orderCode: string;
  orderStatus: OrderStatus;
  planStatus: PlanStatus;
  plannedDepartureAt: string | null;
  plannedArrivalAt: string | null;
  crewRole: CrewRole;       // DRIVER or ESCORT (this user's role in the assignment)
  legs: ILegTracking[];
}

// ─── Trip detail (GET /tracking/trips/:id) ───────────────────────────────────

/** Tổng hợp hoạt động chăm sóc trong khoảng from/to (hoặc toàn bộ danh sách khi không có khoảng). */
export interface ICareSummary {
  waterLiters: number;
  /** Số lần cho ăn */
  meals: number;
  /** Số lần nghỉ chân */
  rests: number;
  restMinutes: number;
  /** Lần cho ăn gần nhất của từng ngựa (ISO UTC) trên toàn chuyến (không phụ thuộc from/to) */
  lastFeedAtByHorse: Record<string, string>;
}

export interface ICareActivityList {
  /** Mới nhất trước; bản gốc đã bị đính chính được ẩn (chỉ trả bản mới nhất) */
  activities: ICareActivity[];
  summary: ICareSummary;
}

export interface ICareActivityCreateInput {
  activityType: CareActivityType;
  /** Bắt buộc với FEED/WATER; null = cả đoàn (chỉ REST) */
  horseId?: string | null;
  feedDescription?: string | null; // FEED, 1–200 ký tự
  amountLiters?: number | null; // WATER, 0.1–200 (1 chữ số thập phân)
  durationMinutes?: number | null; // REST, 1–720
  note?: string | null; // tối đa 255
  performedAt: string; // ISO UTC
  /** Đính chính một bản ghi: cùng chuyến, cùng ngựa, cùng loại */
  correctsActivityId?: string | null;
}

export interface ITripHorse {
  id: string;
  name: string;
  passportNo: string;
  orderStatus: string;
  breed: string | null;
  /** yyyy-MM-dd */
  birthDate: string | null;
}

/** `phone` là null khi người dùng chưa khai báo, hoặc khi người gọi là Specialist (ẩn SĐT nội bộ). */
export interface ITripCrewMember {
  userId: string;
  name: string;
  phone: string | null;
  role: CrewRole;
}

export interface ITripContact {
  name: string;
  phone: string | null;
}

export interface ITripVehicle {
  id: string;
  /** vehicles.plate_or_code */
  code: string;
  /** vehicles.vehicle_type: TRUCK | AIRCRAFT_HOLD | CRATE */
  type: string;
  capacityStalls: number;
}

export interface IDriverTripDetail {
  id: string;               // tripId
  orderId: string;
  orderCode: string;
  orderStatus: OrderStatus;
  planStatus: PlanStatus;
  plannedDepartureAt: string | null;
  plannedArrivalAt: string | null;
  /** Chỉ có khi người gọi là Driver/Escort được phân công */
  crewRole?: CrewRole;
  /** Tài xế trước, hộ tống sau */
  crew: ITripCrewMember[];
  customer: { name: string };
  /** null khi đơn chưa có cả tên lẫn SĐT người nhận */
  recipient: ITripContact | null;
  /** Người lập kế hoạch chuyến (trips.planned_by) */
  coordinator: ITripContact | null;
  /** Số cứu hộ 24/7 (system_parameters.HOTLINE); null khi chưa cấu hình */
  emergencyHotline: string | null;
  /** Các xe khác nhau dùng trong các chặng, theo thứ tự chặng đầu tiên dùng xe */
  vehicles: ITripVehicle[];
  horses: ITripHorse[];
  legs: ILegTracking[];
}

// ─── Timeline (Customer-facing and internal) ──────────────────────────────────

export interface ITimelineMilestone {
  milestoneType: MilestoneType;
  occurredAt: string;
  recordedByName: string;
}

/** Một chặng như Customer nhìn thấy: chỉ tiến độ, không có dữ liệu nội bộ. */
export interface ITimelineLeg {
  seqNo: number;
  fromLocationName: string;
  toLocationName: string;
  plannedDepartureAt: string;
  plannedArrivalAt: string;
  status: LegStatus;
  actualDepartureAt: string | null;
  actualArrivalAt: string | null;
  milestones: ITimelineMilestone[];
  /** Most recent milestone reached, if any */
  latestMilestone: MilestoneType | null;
  latestMilestoneAt: string | null;
  /** Người và thời điểm cập nhật gần nhất của chặng (FR-TRK-08) */
  lastUpdatedByName: string | null;
  lastUpdatedAt: string | null;
  /** Chặng chưa COMPLETED nhưng đã quá giờ đến dự kiến */
  isOverdue: boolean;
}

export interface IOrderTimeline {
  orderId: string;
  orderCode: string;
  orderStatus: OrderStatus;
  plannedDepartureAt: string | null;
  plannedArrivalAt: string | null;
  /** Cập nhật gần nhất của cả hành trình; null khi chưa có cập nhật nào */
  lastUpdatedAt: string | null;
  lastUpdatedByName: string | null;
  /** Rỗng cho đến khi kế hoạch chuyến được duyệt */
  legs: ITimelineLeg[];
}

export interface ITripTimelineLeg extends ILegTracking {
  isOverdue: boolean;
}

export interface ITripTimeline {
  tripId: string;
  orderId: string;
  orderCode: string;
  orderStatus: OrderStatus;
  planStatus: PlanStatus;
  plannedDepartureAt: string | null;
  plannedArrivalAt: string | null;
  lastUpdatedAt: string | null;
  lastUpdatedByName: string | null;
  legs: ITripTimelineLeg[];
  horseLogs: IHorseLog[];
  /** Rỗng với Specialist (không được xem sự cố) */
  incidents: IIncident[];
  alerts: IAlert[];
}

// ─── Operations dashboard (Manager / Coordinator) ─────────────────────────────

export interface IActiveTripItem {
  tripId: string;
  orderId: string;
  orderCode: string;
  orderStatus: OrderStatus;
  customerName: string;
  plannedDepartureAt: string | null;
  plannedArrivalAt: string | null;
  legCount: number;
  completedLegs: number;
  /** Chặng đang chạy (hoặc chặng kế tiếp nếu chưa chặng nào chạy); null khi mọi chặng đã COMPLETED */
  currentLeg: { seqNo: number; fromLocationName: string; toLocationName: string; status: LegStatus } | null;
  openIncidents: number;
  highUrgencyOpenIncidents: number;
  isOverdue: boolean;
  lastUpdatedAt: string | null;
  lastUpdatedByName: string | null;
}

export interface IActiveTrips {
  summary: {
    /** Số chuyến có Order IN_TRANSIT */
    inTransit: number;
    /** Tổng sự cố chưa đóng */
    openIncidents: number;
    /** Số chuyến IN_TRANSIT có chặng quá giờ đến dự kiến mà chưa hoàn thành */
    overdueTrips: number;
  };
  items: IActiveTripItem[];
}

// ─── Milestone write request (from Driver) ────────────────────────────────────

export interface IMilestoneCreateInput {
  milestoneType: MilestoneType;
  occurredAt: string; // ISO UTC, must not be in the future
}

// ─── Horse log write request (from Driver) ────────────────────────────────────

export interface IHorseLogCreateInput {
  horseId: string;
  conditionStatus: HorseConditionStatus;
  note?: string;
  loggedAt: string; // ISO UTC
  correctsLogId?: string; // if correcting a previous entry
}

// ─── Incident write request (from Driver) ─────────────────────────────────────

export interface IIncidentCreateInput {
  incidentType: IncidentType;
  description: string;
  legId?: string;
  horseId?: string;
  severity: IncidentSeverity;
  /** Mã trong INCIDENT_SUB_TYPES[incidentType] */
  subType?: string;
  damageTarget: DamageTarget;
  /** Gửi cả hai hoặc không gửi */
  latitude?: number;
  longitude?: number;
  locationText?: string;
  /** Nhãn ảnh, cùng thứ tự với `photos` (multipart: lặp field `captions`) */
  captions?: string[];
}

// ─── Incident patch request (from Coordinator) ───────────────────────────────

export interface IIncidentPatchInput {
  status: IncidentStatus.ACKNOWLEDGED | IncidentStatus.CLOSED;
  handlingNote?: string; // required when closing (CLOSED)
}

// ─── Leg correction request (from Coordinator) ───────────────────────────────

export interface ILegCorrectInput {
  /** New target status — must be a valid operational status */
  status: LegStatus;
  /** Mandatory justification for the correction (1–255 chars) */
  reason: string;
  /** Thời điểm dùng để điền mốc/giờ thực tế còn thiếu khi hiệu chỉnh (mặc định: hiện tại) */
  occurredAt?: string;
}

export interface ILegCompleteInput {
  /** Thời điểm hoàn tất chặng trung gian (ISO UTC) */
  occurredAt: string;
}

// ─── Alert write request (from Coordinator) ──────────────────────────────────

export interface IAlertCreateInput {
  alertType: AlertType;
  content: string; // 1–500 chars
}

