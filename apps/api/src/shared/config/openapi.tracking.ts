// Flow 4 - Tracking: chặng/mốc (Giai đoạn 1) và nhật ký ngựa, sự cố, cảnh báo, tệp (Giai đoạn 2) đã triển khai.
const ref = (name: string) => ({ $ref: '#/components/schemas/' + name });
const id = { type: 'string', pattern: '^[1-9]\\d{0,19}$', example: '301', description: 'ID BIGINT dưới dạng chuỗi.' };
const time = { type: 'string', format: 'date-time', pattern: 'Z$', example: '2026-10-20T01:00:00.000Z', description: 'ISO 8601 UTC, kết thúc bằng Z.' };
const object = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, required, properties });
const nullable = (schema: Record<string, unknown>) => ({ ...schema, nullable: true });
const legStatus = { type: 'string', enum: ['NOT_STARTED', 'MOVING', 'AT_STOP', 'COMPLETED'] };
const milestoneType = { type: 'string', enum: ['DEPARTED', 'ARRIVED_AT_STOP', 'CUSTOMS_CLEARED', 'DELIVERED'] };
const orderStatus = { type: 'string', enum: ['DRAFT', 'PENDING', 'NEED_INFO', 'REJECTED', 'APPROVED', 'PREPARING', 'READY', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'] };
const planStatus = { type: 'string', enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] };
const conditionStatus = { type: 'string', enum: ['STABLE', 'OFF_FEED', 'STRESSED', 'CLIMATE_CHANGE'] };
const incidentType = { type: 'string', enum: ['VEHICLE_BREAKDOWN', 'LONG_TRAFFIC_JAM', 'HORSE_MEDICAL'] };
const incidentStatus = { type: 'string', enum: ['NEW', 'ACKNOWLEDGED', 'CLOSED'] };
const locationType = { type: 'string', enum: ['BORDER', 'QUARANTINE_STATION', 'REST_STOP', 'AIRPORT', 'FUEL_STOP'], description: 'BORDER yêu cầu mốc CUSTOMS_CLEARED trước khi hoàn tất chặng.' };
const contact = (description: string, phone: string) => nullable({ ...object({ name: { type: 'string' }, phone: nullable({ type: 'string', description: phone }) }), description });
const routeMode = { type: 'string', enum: ['ROAD', 'AIR', 'STRAIGHT'], description: 'ROAD: đường thật (Mapbox Directions, cache); AIR: cung tròn lớn (chặng bay); STRAIGHT: đường thẳng ước lượng.' };
const lngLat = { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number' } };
const alertType = { type: 'string', enum: ['TRAFFIC', 'WEATHER', 'BORDER'] };

export const trackingSchemas = {
  TrackingMilestone: object({ id, legId: id, milestoneType, occurredAt: time, recordedBy: id, recordedByName: { type: 'string' } }),
  TrackingLeg: object({
    id, seqNo: { type: 'integer', minimum: 1 },
    fromLocationId: id, fromLocationName: { type: 'string' }, toLocationId: id, toLocationName: { type: 'string' }, toLocationType: locationType,
    vehicleId: nullable(id), vehicleCode: nullable({ type: 'string' }),
    plannedDepartureAt: time, plannedArrivalAt: time, status: legStatus,
    actualDepartureAt: nullable(time), actualArrivalAt: nullable(time),
    updatedAt: nullable(time), updatedByName: nullable({ type: 'string' }),
    milestones: { type: 'array', items: ref('TrackingMilestone') },
  }),
  TrackingHorse: object({ id, name: { type: 'string' }, passportNo: { type: 'string' }, orderStatus: { type: 'string', enum: ['NORMAL', 'FLAGGED', 'REMOVED'] } }),
  TrackingCrewMember: object({
    userId: id, name: { type: 'string' },
    phone: nullable({ type: 'string', description: 'null khi chưa khai báo, hoặc khi người gọi là Specialist.' }),
    role: { type: 'string', enum: ['DRIVER', 'ESCORT'] },
  }),
  TrackingVehicle: object({
    id, code: { type: 'string', description: 'vehicles.license_plate' },
    type: { type: 'string', enum: ['LIGHT', 'MEDIUM', 'HEAVY'] }, capacityStalls: { type: 'integer', minimum: 1 },
  }),
  DriverTripSummary: object({
    id, orderId: id, orderCode: { type: 'string' }, orderStatus, planStatus,
    plannedDepartureAt: nullable(time), plannedArrivalAt: nullable(time),
    crewRole: { type: 'string', enum: ['DRIVER', 'ESCORT'] }, legs: { type: 'array', items: ref('TrackingLeg') },
  }),
  TrackingTripDetail: object({
    id, orderId: id, orderCode: { type: 'string' }, orderStatus, planStatus,
    plannedDepartureAt: nullable(time), plannedArrivalAt: nullable(time),
    crewRole: { type: 'string', enum: ['DRIVER', 'ESCORT'], description: 'Chỉ có khi người gọi là Driver/Escort của chuyến.' },
    crew: { type: 'array', items: ref('TrackingCrewMember'), description: 'Driver/Escort được phân công; DRIVER trước ESCORT.' },
    customer: object({ name: { type: 'string' } }),
    recipient: contact('Người nhận ở điểm đến (orders.recipient_name/phone); null khi cả hai đều trống.', 'null khi đơn chưa có SĐT người nhận, hoặc khi người gọi là Specialist.'),
    coordinator: contact('Điều phối viên lập kế hoạch (trips.planned_by).', 'null khi chưa khai báo, hoặc khi người gọi là Specialist.'),
    emergencyHotline: nullable({ type: 'string', description: 'Số cứu hộ 24/7 (system_parameters.HOTLINE); null khi chưa cấu hình.' }),
    vehicles: { type: 'array', items: ref('TrackingVehicle'), description: 'Các xe khác nhau dùng trong chặng, theo thứ tự chặng đầu tiên dùng xe.' },
    horses: { type: 'array', items: ref('TrackingHorse') }, legs: { type: 'array', items: ref('TrackingLeg') },
  }, ['id', 'orderId', 'orderCode', 'orderStatus', 'planStatus', 'plannedDepartureAt', 'plannedArrivalAt', 'crew', 'customer', 'recipient', 'coordinator', 'emergencyHotline', 'vehicles', 'horses', 'legs']),

  MilestoneInput: object({ milestoneType, occurredAt: { ...time, description: 'Không ở tương lai (cho lệch đồng hồ 60 giây); nhập bù tối đa T phút (mặc định 120, cấu hình system_parameters.LEG_BACK); không sớm hơn mốc trước của chặng.' } }),
  MilestoneResult: object({ milestoneId: id, legId: id, milestoneType, legStatus, orderStatus }),
  CompleteLegInput: object({ occurredAt: time }),
  LegCompleteResult: object({ legId: id, status: { type: 'string', enum: ['COMPLETED'] } }),
  CorrectLegInput: object({
    status: legStatus,
    reason: { type: 'string', minLength: 1, maxLength: 255, description: 'Bắt buộc, trim.' },
    occurredAt: { ...time, description: 'Tuỳ chọn: giờ điền cho mốc/giờ thực tế còn thiếu; mặc định là hiện tại; không ở tương lai.' },
  }, ['status', 'reason']),
  LegCorrectResult: object({ legId: id, status: legStatus, reason: { type: 'string' }, orderStatus }),

  LogAttachment: object({
    id, originalName: { type: 'string' }, fileType: { type: 'string', enum: ['PDF', 'JPG', 'PNG'] }, sizeBytes: { type: 'integer', minimum: 1 }, uploadedAt: time,
    caption: nullable({ type: 'string', maxLength: 100, description: 'Nhãn ảnh (ví dụ "Lốp sau"); null với ảnh cũ.' }),
  }),
  HorseLogFields: object({
    horseId: id, conditionStatus,
    note: { type: 'string', maxLength: 1000 },
    loggedAt: { ...time, description: 'Không ở tương lai.' },
    correctsLogId: { ...id, description: 'Đính chính một bản ghi cũ: cùng chuyến, cùng ngựa. Nhật ký không có API sửa/xóa.' },
  }, ['horseId', 'conditionStatus', 'loggedAt']),
  HorseLog: object({
    id, horseId: id, horseName: { type: 'string' }, legId: id, conditionStatus,
    note: nullable({ type: 'string' }), loggedAt: time, createdBy: id, createdByName: { type: 'string' },
    correctsLogId: nullable(id), attachments: { type: 'array', items: ref('LogAttachment') },
  }),
  IncidentFields: object({
    incidentType, description: { type: 'string', minLength: 5, maxLength: 2000 },
    legId: { ...id, description: 'Tuỳ chọn; phải thuộc chuyến.' },
    horseId: { ...id, description: 'Bắt buộc với HORSE_MEDICAL; phải thuộc đơn của chuyến.' },
    severity: { type: 'string', enum: ['RED', 'ORANGE', 'YELLOW'], description: 'Bắt buộc. RED → urgency HIGH.' },
    subType: { type: 'string', maxLength: 40, description: 'Tuỳ chọn; phải thuộc INCIDENT_SUB_TYPES của incidentType (400 nếu sai loại).' },
    damageTarget: { type: 'string', enum: ['VEHICLE', 'HORSE', 'BOTH'], description: 'Bắt buộc.' },
    latitude: { type: 'number', minimum: -90, maximum: 90, description: 'Tuỳ chọn; phải gửi cùng longitude.' },
    longitude: { type: 'number', minimum: -180, maximum: 180, description: 'Tuỳ chọn; phải gửi cùng latitude.' },
    locationText: { type: 'string', maxLength: 255, description: 'Vị trí người dùng nhập tay.' },
    captions: { type: 'array', maxItems: 3, items: { type: 'string', maxLength: 100 }, description: 'Nhãn ảnh theo thứ tự `photos` (multipart: lặp field `captions`); số nhãn ≤ số ảnh.' },
  }, ['incidentType', 'description', 'severity', 'damageTarget']),
  Incident: object({
    id, tripId: id, legId: nullable(id), horseId: nullable(id), horseName: nullable({ type: 'string' }),
    incidentType, description: { type: 'string' }, urgency: { type: 'string', enum: ['NORMAL', 'HIGH'] },
    severity: nullable({ type: 'string', enum: ['RED', 'ORANGE', 'YELLOW'], description: 'Mức độ do tài xế chọn; null với sự cố cũ.' }),
    subType: nullable({ type: 'string', maxLength: 40, description: 'Mã loại con theo INCIDENT_SUB_TYPES (packages/shared).' }),
    damageTarget: nullable({ type: 'string', enum: ['VEHICLE', 'HORSE', 'BOTH'] }),
    latitude: nullable({ type: 'number', minimum: -90, maximum: 90 }),
    longitude: nullable({ type: 'number', minimum: -180, maximum: 180 }),
    locationText: nullable({ type: 'string', maxLength: 255 }),
    status: incidentStatus,
    reportedBy: id, reportedByName: { type: 'string' }, reportedAt: time, receivedBy: nullable(id),
    handlingNote: nullable({ type: 'string' }), closedAt: nullable(time), attachments: { type: 'array', items: ref('LogAttachment') },
  }),
  IncidentPatchInput: object({
    status: { type: 'string', enum: ['ACKNOWLEDGED', 'CLOSED'] },
    handlingNote: { type: 'string', maxLength: 2000, description: 'Bắt buộc khi CLOSED.' },
  }, ['status']),
  AlertInput: object({ alertType, content: { type: 'string', minLength: 5, maxLength: 500 } }),
  Alert: object({ id, tripId: id, alertType, content: { type: 'string' }, sentBy: id, sentByName: { type: 'string' }, sentAt: time }),

  TimelineMilestone: object({ milestoneType, occurredAt: time, recordedByName: { type: 'string' } }),
  TimelineLeg: object({
    seqNo: { type: 'integer', minimum: 1 }, fromLocationName: { type: 'string' }, toLocationName: { type: 'string' },
    plannedDepartureAt: time, plannedArrivalAt: time, status: legStatus,
    actualDepartureAt: nullable(time), actualArrivalAt: nullable(time),
    milestones: { type: 'array', items: ref('TimelineMilestone') },
    latestMilestone: nullable(milestoneType), latestMilestoneAt: nullable(time),
    lastUpdatedByName: nullable({ type: 'string' }), lastUpdatedAt: nullable(time),
    isOverdue: { type: 'boolean', description: 'Chặng chưa COMPLETED nhưng đã quá giờ đến dự kiến.' },
  }),
  OrderTimeline: object({
    orderId: id, orderCode: { type: 'string' }, orderStatus,
    plannedDepartureAt: nullable(time), plannedArrivalAt: nullable(time),
    lastUpdatedAt: nullable(time), lastUpdatedByName: nullable({ type: 'string' }),
    legs: { type: 'array', items: ref('TimelineLeg'), description: 'Rỗng cho đến khi kế hoạch chuyến được duyệt (Order READY/IN_TRANSIT/DELIVERED).' },
  }),
  TripTimelineLeg: object({
    id, seqNo: { type: 'integer', minimum: 1 },
    fromLocationId: id, fromLocationName: { type: 'string' }, toLocationId: id, toLocationName: { type: 'string' }, toLocationType: locationType,
    vehicleId: nullable(id), vehicleCode: nullable({ type: 'string' }),
    plannedDepartureAt: time, plannedArrivalAt: time, status: legStatus,
    actualDepartureAt: nullable(time), actualArrivalAt: nullable(time),
    updatedAt: nullable(time), updatedByName: nullable({ type: 'string' }),
    milestones: { type: 'array', items: ref('TrackingMilestone') }, isOverdue: { type: 'boolean' },
  }),
  TripTimeline: object({
    tripId: id, orderId: id, orderCode: { type: 'string' }, orderStatus, planStatus,
    plannedDepartureAt: nullable(time), plannedArrivalAt: nullable(time),
    lastUpdatedAt: nullable(time), lastUpdatedByName: nullable({ type: 'string' }),
    legs: { type: 'array', items: ref('TripTimelineLeg') },
    horseLogs: { type: 'array', items: ref('HorseLog') },
    incidents: { type: 'array', items: ref('Incident'), description: 'Luôn rỗng với Specialist.' },
    alerts: { type: 'array', items: ref('Alert') },
  }),
  ActiveTripItem: object({
    tripId: id, orderId: id, orderCode: { type: 'string' }, orderStatus, customerName: { type: 'string' },
    plannedDepartureAt: nullable(time), plannedArrivalAt: nullable(time),
    legCount: { type: 'integer', minimum: 0 }, completedLegs: { type: 'integer', minimum: 0 },
    currentLeg: nullable(object({ seqNo: { type: 'integer', minimum: 1 }, fromLocationName: { type: 'string' }, toLocationName: { type: 'string' }, status: legStatus })),
    openIncidents: { type: 'integer', minimum: 0 }, highUrgencyOpenIncidents: { type: 'integer', minimum: 0 },
    isOverdue: { type: 'boolean' }, lastUpdatedAt: nullable(time), lastUpdatedByName: nullable({ type: 'string' }),
  }),
  ActiveTrips: object({
    summary: object({ inTransit: { type: 'integer', minimum: 0 }, openIncidents: { type: 'integer', minimum: 0 }, overdueTrips: { type: 'integer', minimum: 0 } }),
    items: { type: 'array', items: ref('ActiveTripItem') },
  }),
  // Bản đồ chuyến + GPS (kế hoạch Bước 4 + 6)
  TripMapStop: object({
    locationId: id, name: { type: 'string' }, locationType,
    lat: nullable({ type: 'number', minimum: -90, maximum: 90 }), lng: nullable({ type: 'number', minimum: -180, maximum: 180 }),
  }),
  TripMapLeg: object({
    id, seqNo: { type: 'integer', minimum: 1 }, status: legStatus, fromLocationId: id, toLocationId: id, mode: routeMode,
    coordinates: nullable({ type: 'array', items: lngLat, description: '[[lng, lat], ...]; null khi thiếu tọa độ một đầu.' }),
    distanceKm: nullable({ type: 'number', minimum: 0 }),
    plannedDepartureAt: time, plannedArrivalAt: time, actualDepartureAt: nullable(time), actualArrivalAt: nullable(time), isOverdue: { type: 'boolean' },
  }),
  TripMapPosition: object({
    source: { type: 'string', enum: ['GPS', 'ESTIMATED'] }, lat: { type: 'number' }, lng: { type: 'number' }, asOf: time, legId: nullable(id),
    label: nullable({ type: 'string', description: 'ESTIMATED luôn có chữ "Ước tính theo kế hoạch, không phải GPS"; GPS STALE: "Mất tín hiệu GPS…".' }),
  }),
  TripLatestPosition: object({
    lat: { type: 'number' }, lng: { type: 'number' }, speedKmh: nullable({ type: 'number', minimum: 0 }),
    accuracyM: nullable({ type: 'integer', minimum: 0 }), headingDeg: nullable({ type: 'integer', minimum: 0, maximum: 359 }),
    recordedAt: time, legId: nullable(id), freshness: { type: 'string', enum: ['LIVE', 'STALE', 'OLD'], description: 'LIVE < 2 phút, STALE 2–10 phút, OLD > 10 phút.' },
  }),
  TripMap: object({
    tripId: id, orderCode: { type: 'string' }, orderStatus,
    stops: { type: 'array', items: ref('TripMapStop') }, legs: { type: 'array', items: ref('TripMapLeg') },
    totalKm: nullable({ type: 'number', minimum: 0, description: 'null khi có chặng thiếu tọa độ.' }),
    remainingKm: nullable({ type: 'number', minimum: 0, description: 'Tính từ `position`; null khi không xác định.' }),
    position: nullable({ ...ref('TripMapPosition') }),
    latestPosition: nullable({ ...ref('TripLatestPosition') }),
    speedLimitKmh: nullable({ type: 'number', minimum: 1, description: 'system_parameters.VMAX; null khi chưa cấu hình.' }),
    warnings: { type: 'array', items: { type: 'string' } },
  }),
  PositionPoint: object({
    latitude: { type: 'number', minimum: -90, maximum: 90 }, longitude: { type: 'number', minimum: -180, maximum: 180 },
    recordedAt: { ...time, description: 'Giờ trên thiết bị (UTC). Không ở tương lai (cho lệch 60 giây), không cũ hơn 24 giờ.' },
    accuracyM: { type: 'integer', minimum: 0 }, speedMps: { type: 'number', minimum: 0, maximum: 150 }, headingDeg: { type: 'number', minimum: 0, exclusiveMaximum: 360 },
  }, ['latitude', 'longitude', 'recordedAt']),
  PositionsInput: object({ points: { type: 'array', minItems: 1, maxItems: 20, items: ref('PositionPoint') } }),
  PositionsResult: object({
    legId: id, accepted: { type: 'integer', minimum: 0 },
    duplicates: { type: 'integer', minimum: 0, description: 'Điểm đã gửi trước đó (cùng người, cùng recordedAt): bỏ qua.' },
  }),
  TrackPoint: object({ lat: { type: 'number' }, lng: { type: 'number' }, speedKmh: nullable({ type: 'number', minimum: 0 }), recordedAt: time, legId: nullable(id) }),
};

export const trackingTag = { name: 'Flow 4 - Tracking' };

const requestIdHeader = { description: 'UUID do server cấp để tra log.', schema: { type: 'string', format: 'uuid' } };
const errorDescriptions: Record<number, string> = {
  400: 'Sai ID/body/query, trường không được phép hoặc thời điểm không hợp lệ.',
  401: 'Thiếu token, token sai/hết hạn.',
  403: 'Vai trò không được phép thực hiện thao tác này.',
  404: 'Không tìm thấy hoặc người gọi không thuộc phạm vi chuyến.',
  409: 'Trạng thái chặng/Order/sự cố không cho phép thao tác (sai thứ tự, trùng mốc, đã đóng...).',
  413: 'Request hoặc ảnh vượt giới hạn kích thước.',
  429: 'Vượt giới hạn tần suất request.',
  500: 'Lỗi nội bộ; thông báo an toàn, tra log bằng requestId.',
};
function errors(codes: number[]) {
  return Object.fromEntries(codes.map(code => [code, {
    description: errorDescriptions[code], headers: { 'X-Request-ID': requestIdHeader },
    content: { 'application/json': { schema: ref('Error') } },
  }]));
}
function ok(status: number, schema: Record<string, unknown>, example: unknown, description = 'Thành công.') {
  return { [status]: { description, headers: { 'X-Request-ID': requestIdHeader }, content: { 'application/json': { schema, example } } } };
}
const list = (name: string) => ({ type: 'array', items: ref(name) });
const param = (name: string, description: string) => ({ name, in: 'path', required: true, description, schema: id });
const common = { tags: [trackingTag.name], security: [{ bearer: [] }], 'x-implementation-status': 'implemented' };
const json = (schema: string, example: unknown) => ({ required: true, content: { 'application/json': { schema: ref(schema), example } } });
const photosField = { type: 'array', maxItems: 3, items: { type: 'string', format: 'binary' }, description: 'Ảnh JPG/PNG, tối đa 3 ảnh, mỗi ảnh ≤ 5 MB.' };
const multipart = (fields: string, example: unknown) => ({
  required: true,
  content: {
    'multipart/form-data': { schema: { allOf: [ref(fields), { type: 'object', properties: { photos: photosField } }] }, encoding: { photos: { contentType: 'image/jpeg, image/png' } } },
    'application/json': { schema: ref(fields), example },
  },
});

const t0 = '2026-10-20T01:00:00.000Z';
const t1 = '2026-10-20T03:00:00.000Z';
const leg1 = {
  id: '301', seqNo: 1, fromLocationId: '10', fromLocationName: 'Điểm A (mẫu)', toLocationId: '11', toLocationName: 'Điểm B (mẫu)', toLocationType: 'REST_STOP',
  vehicleId: '5', vehicleCode: 'XE-DEMO-01', plannedDepartureAt: t0, plannedArrivalAt: t1, status: 'MOVING',
  actualDepartureAt: t0, actualArrivalAt: null, updatedAt: t0, updatedByName: 'Tài xế mẫu',
  milestones: [{ id: '901', legId: '301', milestoneType: 'DEPARTED', occurredAt: t0, recordedBy: '7', recordedByName: 'Tài xế mẫu' }],
};
const attachment = { id: '501', originalName: 'ngua-1.jpg', fileType: 'JPG', sizeBytes: 182044, uploadedAt: t1, caption: 'Khoang ngựa' };
const horseLog = { id: '601', horseId: '21', horseName: 'Ngựa mẫu', legId: '301', conditionStatus: 'OFF_FEED', note: 'Bỏ ăn buổi sáng', loggedAt: t1, createdBy: '7', createdByName: 'Tài xế mẫu', correctsLogId: null, attachments: [attachment] };
const tripMap = {
  tripId: '200', orderCode: 'WDP-DEMO-100', orderStatus: 'IN_TRANSIT',
  stops: [
    { locationId: '10', name: 'Trạm kiểm dịch Củ Chi', locationType: 'QUARANTINE_STATION', lat: 10.9733, lng: 106.4933 },
    { locationId: '11', name: 'Cửa khẩu Mộc Bài', locationType: 'BORDER', lat: 11.076, lng: 106.158 },
  ],
  legs: [{
    id: '301', seqNo: 1, status: 'MOVING', fromLocationId: '10', toLocationId: '11', mode: 'ROAD',
    coordinates: [[106.4933, 10.9733], [106.35, 11.02], [106.158, 11.076]], distanceKm: 45.2,
    plannedDepartureAt: t0, plannedArrivalAt: t1, actualDepartureAt: t0, actualArrivalAt: null, isOverdue: false,
  }],
  totalKm: 45.2, remainingKm: 18.6,
  position: { source: 'GPS', lat: 11.02, lng: 106.35, asOf: t1, legId: '301', label: null },
  latestPosition: { lat: 11.02, lng: 106.35, speedKmh: 64.1, accuracyM: 12, headingDeg: 310, recordedAt: t1, legId: '301', freshness: 'LIVE' },
  speedLimitKmh: 80, warnings: [],
};
const incident = {
  id: '701', tripId: '200', legId: '301', horseId: '21', horseName: 'Ngựa mẫu', incidentType: 'HORSE_MEDICAL', description: 'Ngựa có dấu hiệu đau bụng',
  urgency: 'HIGH', severity: 'RED', subType: 'COLIC', damageTarget: 'HORSE', latitude: 18.3421, longitude: 105.9057, locationText: 'Km 742 QL1A, Hà Tĩnh',
  status: 'NEW', reportedBy: '7', reportedByName: 'Tài xế mẫu', reportedAt: t1, receivedBy: null, handlingNote: null, closedAt: null, attachments: [attachment],
};
const alert = { id: '801', tripId: '200', alertType: 'WEATHER', content: 'Mưa lớn trên tuyến, giảm tốc độ', sentBy: '4', sentByName: 'Điều phối mẫu', sentAt: t1 };

const orderTimeline = {
  orderId: '100', orderCode: 'WDP-DEMO-100', orderStatus: 'IN_TRANSIT', plannedDepartureAt: t0, plannedArrivalAt: t1, lastUpdatedAt: t0, lastUpdatedByName: 'Tài xế mẫu',
  legs: [{
    seqNo: 1, fromLocationName: 'Điểm A (mẫu)', toLocationName: 'Điểm B (mẫu)', plannedDepartureAt: t0, plannedArrivalAt: t1, status: 'MOVING',
    actualDepartureAt: t0, actualArrivalAt: null, milestones: [{ milestoneType: 'DEPARTED', occurredAt: t0, recordedByName: 'Tài xế mẫu' }],
    latestMilestone: 'DEPARTED', latestMilestoneAt: t0, lastUpdatedByName: 'Tài xế mẫu', lastUpdatedAt: t0, isOverdue: false,
  }],
};
const tripTimeline = {
  tripId: '200', orderId: '100', orderCode: 'WDP-DEMO-100', orderStatus: 'IN_TRANSIT', planStatus: 'APPROVED', plannedDepartureAt: t0, plannedArrivalAt: t1,
  lastUpdatedAt: t0, lastUpdatedByName: 'Tài xế mẫu', legs: [{ ...leg1, isOverdue: false }], horseLogs: [horseLog], incidents: [incident], alerts: [alert],
};
const activeItem = {
  tripId: '200', orderId: '100', orderCode: 'WDP-DEMO-100', orderStatus: 'IN_TRANSIT', customerName: 'Khách hàng mẫu', plannedDepartureAt: t0, plannedArrivalAt: t1,
  legCount: 2, completedLegs: 0, currentLeg: { seqNo: 1, fromLocationName: 'Điểm A (mẫu)', toLocationName: 'Điểm B (mẫu)', status: 'MOVING' },
  openIncidents: 1, highUrgencyOpenIncidents: 1, isOverdue: false, lastUpdatedAt: t0, lastUpdatedByName: 'Tài xế mẫu',
};

const tripId = param('tripId', 'ID chuyến (trips.id), không phải orderId.');
const legId = param('legId', 'ID chặng (legs.id).');

export const trackingPaths = {
  '/api/v1/tracking/driver/trips': { get: { ...common, operationId: 'getDriverTrips', summary: 'Driver/Escort: chuyến được phân công',
    description: 'Chỉ chuyến có Order READY/IN_TRANSIT/DELIVERED mà người gọi được phân công; kèm chặng và mốc.',
    responses: { ...ok(200, list('DriverTripSummary'), [{ id: '200', orderId: '100', orderCode: 'WDP-DEMO-100', orderStatus: 'IN_TRANSIT', planStatus: 'APPROVED', plannedDepartureAt: t0, plannedArrivalAt: t1, crewRole: 'DRIVER', legs: [leg1] }]), ...errors([401, 403, 429, 500]) } } },
  '/api/v1/tracking/trips/{id}': { get: { ...common, operationId: 'getTrackingTrip', summary: 'Chi tiết chuyến để theo dõi: chặng, mốc, danh sách ngựa', parameters: [param('id', 'ID chuyến (trips.id).')],
    description: 'Driver (được phân công), Coordinator (chuyến mình lập), Manager, Specialist (chỉ đọc, không thấy SĐT của crew/coordinator/người nhận). Customer và Admin nhận 403: Customer dùng timeline đơn (Giai đoạn 3).',
    responses: { ...ok(200, ref('TrackingTripDetail'), { id: '200', orderId: '100', orderCode: 'WDP-DEMO-100', orderStatus: 'IN_TRANSIT', planStatus: 'APPROVED', plannedDepartureAt: t0, plannedArrivalAt: t1, crewRole: 'DRIVER',
      crew: [{ userId: '6', name: 'Tài xế mẫu', phone: '0901000001', role: 'DRIVER' }, { userId: '10', name: 'Hộ tống mẫu', phone: '0901000002', role: 'ESCORT' }],
      customer: { name: 'Khách hàng mẫu' }, recipient: { name: 'Người nhận mẫu', phone: '+6560000000' }, coordinator: { name: 'Điều phối mẫu', phone: '0901000003' }, emergencyHotline: '1900 1080',
      vehicles: [{ id: '5', code: 'XE-DEMO-01', type: 'MEDIUM', capacityStalls: 4 }],
      horses: [{ id: '21', name: 'Ngựa mẫu', passportNo: 'PP-001', orderStatus: 'NORMAL' }], legs: [leg1] }), ...errors([400, 401, 403, 404, 429, 500]) } } },
  '/api/v1/tracking/legs/{legId}/milestones': { post: { ...common, operationId: 'recordMilestone', summary: 'Driver/Escort: ghi mốc của chặng', parameters: [legId],
    description: `Quy tắc: tuần tự theo luồng chặng (409 nếu nhảy cóc hoặc trùng mốc); \`occurredAt\` không ở tương lai, nhập bù tối đa T phút, không sớm hơn mốc trước (400).
- DEPARTED chặng 1: Trip phải APPROVED và Order READY; Order → IN_TRANSIT. Chặng k+1 cần chặng k COMPLETED.
- CUSTOMS_CLEARED chỉ khi điểm đến là BORDER (400 nếu không).
- DELIVERED chỉ ở chặng cuối (400 nếu không); cửa khẩu cần CUSTOMS_CLEARED trước; chặng → COMPLETED, Order → DELIVERED.
Ghi audit và thông báo IN_APP (Coordinator; Customer khi xuất phát, đến trạm, thông quan, giao xong) trong cùng transaction; lỗi rollback toàn bộ.`,
    requestBody: json('MilestoneInput', { milestoneType: 'DEPARTED', occurredAt: t0 }),
    responses: { ...ok(201, ref('MilestoneResult'), { milestoneId: '901', legId: '301', milestoneType: 'DEPARTED', legStatus: 'MOVING', orderStatus: 'IN_TRANSIT' }, 'Đã ghi mốc.'), ...errors([400, 401, 403, 404, 409, 413, 429, 500]) } } },
  '/api/v1/tracking/legs/{legId}/complete': { post: { ...common, operationId: 'completeIntermediateLeg', summary: 'Driver/Escort: hoàn thành chặng trung gian', parameters: [legId],
    description: 'Chặng phải AT_STOP (cửa khẩu cần CUSTOMS_CLEARED). **Không dùng cho chặng cuối** (400): chặng cuối hoàn tất bằng mốc DELIVERED. `occurredAt` theo cùng quy tắc thời gian, không sớm hơn giờ đến trạm.',
    requestBody: json('CompleteLegInput', { occurredAt: t1 }),
    responses: { ...ok(200, ref('LegCompleteResult'), { legId: '301', status: 'COMPLETED' }), ...errors([400, 401, 403, 404, 409, 413, 429, 500]) } } },
  '/api/v1/tracking/legs/{legId}/correct': { patch: { ...common, operationId: 'correctLeg', summary: 'Coordinator/Manager: hiệu chỉnh trạng thái chặng (bắt buộc lý do)', parameters: [legId],
    description: `Chỉ khi Trip APPROVED và Order READY/IN_TRANSIT/DELIVERED; Coordinator chỉ chặng của chuyến mình lập (403). Trạng thái đích phải khác hiện tại (400) và giữ thứ tự: chặng đã/đang chạy thì mọi chặng trước phải COMPLETED (409).
Hệ quả trong cùng transaction: xóa mốc không còn phù hợp, thêm mốc còn thiếu (người ghi là người hiệu chỉnh), điều chỉnh giờ xuất phát/đến thực tế, **đồng bộ Order** (tất cả chặng COMPLETED → DELIVERED; có chặng đã chạy → IN_TRANSIT; ngược lại READY), ghi audit giá trị cũ/mới kèm lý do và thông báo các bên liên quan.`,
    requestBody: json('CorrectLegInput', { status: 'AT_STOP', reason: 'Xe đã tới trạm nhưng tài xế quên báo' }),
    responses: { ...ok(200, ref('LegCorrectResult'), { legId: '301', status: 'AT_STOP', reason: 'Xe đã tới trạm nhưng tài xế quên báo', orderStatus: 'IN_TRANSIT' }), ...errors([400, 401, 403, 404, 409, 429, 500]) } } },

  '/api/v1/tracking/legs/{legId}/horse-logs': { post: { ...common, operationId: 'createHorseLog', summary: 'Driver/Escort: thêm nhật ký sức khỏe ngựa (kèm ảnh)', parameters: [legId],
    description: `Chỉ thêm mới, **không có API sửa/xóa** (BR-LOG-01); ghi nhầm thì tạo bản ghi mới với \`correctsLogId\` trỏ bản cũ (cùng chuyến, cùng ngựa).
Điều kiện: người gọi được phân công; Order IN_TRANSIT và chặng đã xuất phát (409); ngựa thuộc đơn (400). Ảnh tối đa 3, JPG/PNG ≤ 5 MB; lỗi thì không để lại tệp mồ côi.`,
    requestBody: multipart('HorseLogFields', { horseId: '21', conditionStatus: 'OFF_FEED', note: 'Bỏ ăn buổi sáng', loggedAt: t1 }),
    responses: { ...ok(201, ref('HorseLog'), horseLog, 'Đã tạo nhật ký.'), ...errors([400, 401, 403, 404, 409, 413, 429, 500]) } } },
  '/api/v1/tracking/trips/{tripId}/horse-logs': { get: { ...common, operationId: 'getTripHorseLogs', summary: 'Xem nhật ký ngựa của chuyến', parameters: [tripId],
    description: 'Driver (được phân công), Coordinator (chuyến mình), Manager, Specialist. Sắp theo thời điểm ghi tăng dần, kèm danh sách ảnh.',
    responses: { ...ok(200, list('HorseLog'), [horseLog]), ...errors([400, 401, 403, 404, 429, 500]) } } },
  '/api/v1/tracking/trips/{tripId}/incidents': {
    post: { ...common, operationId: 'createIncident', summary: 'Driver/Escort: báo sự cố khẩn cấp (kèm ảnh)', parameters: [tripId],
      description: `Order phải READY hoặc IN_TRANSIT (409). Bắt buộc \`severity\` và \`damageTarget\`. \`urgency=HIGH\` khi \`severity=RED\` hoặc \`HORSE_MEDICAL\` (bắt buộc \`horseId\`), còn lại NORMAL. \`subType\` phải thuộc loại sự cố; tọa độ gửi đủ cặp; \`captions\` gắn theo thứ tự ảnh. Thông báo IN_APP ngay cho Coordinator phụ trách và mọi Manager ACTIVE. **Sự cố không tự đổi lộ trình/chặng** (BR-INC-03). \`legId\`/\`horseId\` phải thuộc chuyến.`,
      requestBody: multipart('IncidentFields', { incidentType: 'HORSE_MEDICAL', description: 'Ngựa có dấu hiệu đau bụng', legId: '301', horseId: '21', severity: 'RED', subType: 'COLIC', damageTarget: 'HORSE', latitude: 18.3421, longitude: 105.9057, captions: ['Khoang ngựa'] }),
      responses: { ...ok(201, ref('Incident'), incident, 'Đã ghi nhận sự cố.'), ...errors([400, 401, 403, 404, 409, 413, 429, 500]) } },
    get: { ...common, operationId: 'getTripIncidents', summary: 'Xem sự cố của chuyến', parameters: [tripId],
      description: 'Driver (được phân công), Coordinator (chuyến mình), Manager. Specialist không được xem.',
      responses: { ...ok(200, list('Incident'), [incident]), ...errors([400, 401, 403, 404, 429, 500]) } } },
  '/api/v1/tracking/incidents/{id}': { patch: { ...common, operationId: 'updateIncident', summary: 'Coordinator: tiếp nhận hoặc đóng sự cố', parameters: [param('id', 'ID sự cố (incidents.id).')],
    description: 'Chỉ Coordinator phụ trách chuyến (khác phạm vi → 404). NEW → ACKNOWLEDGED → CLOSED một chiều; có thể đóng thẳng từ NEW. **Đóng bắt buộc `handlingNote`** (400). Sự cố đã đóng hoặc đã tiếp nhận mà tiếp nhận lại → 409. Thông báo cho người báo.',
    requestBody: json('IncidentPatchInput', { status: 'CLOSED', handlingNote: 'Đã đưa ngựa tới thú y gần nhất, tiếp tục hành trình sau 40 phút.' }),
    responses: { ...ok(200, ref('Incident'), { ...incident, status: 'CLOSED', receivedBy: '4', handlingNote: 'Đã đưa ngựa tới thú y gần nhất.', closedAt: t1 }), ...errors([400, 401, 403, 404, 409, 429, 500]) } } },
  '/api/v1/tracking/trips/{tripId}/alerts': {
    post: { ...common, operationId: 'createAlert', summary: 'Coordinator: phát cảnh báo thủ công', parameters: [tripId],
      description: 'Chỉ Coordinator phụ trách; Order phải READY hoặc IN_TRANSIT (409). Lưu người gửi/thời gian, thông báo IN_APP cho Driver/Escort được phân công và mọi Manager ACTIVE.',
      requestBody: json('AlertInput', { alertType: 'WEATHER', content: 'Mưa lớn trên tuyến, giảm tốc độ' }),
      responses: { ...ok(201, ref('Alert'), alert, 'Đã phát cảnh báo.'), ...errors([400, 401, 403, 404, 409, 429, 500]) } },
    get: { ...common, operationId: 'getTripAlerts', summary: 'Xem cảnh báo của chuyến', parameters: [tripId],
      description: 'Driver (được phân công), Coordinator (chuyến mình), Manager, Specialist.',
      responses: { ...ok(200, list('Alert'), [alert]), ...errors([400, 401, 403, 404, 429, 500]) } } },
  '/api/v1/tracking/attachments/{id}': { get: { ...common, operationId: 'downloadTrackingAttachment', summary: 'Tải ảnh đính kèm sau khi kiểm tra quyền theo chuyến', parameters: [param('id', 'ID tệp (attachments.id).')],
    description: 'Ảnh nhật ký ngựa: Driver/Coordinator/Manager/Specialist có quyền với chuyến. Ảnh sự cố: không gồm Specialist. Không có quyền → 404. Header `Cache-Control: private, no-store`.',
    responses: { 200: { description: 'Nội dung ảnh.', headers: { 'X-Request-ID': requestIdHeader }, content: { 'image/jpeg': { schema: { type: 'string', format: 'binary' } }, 'image/png': { schema: { type: 'string', format: 'binary' } } } }, ...errors([400, 401, 403, 404, 429, 500]) } } },
  '/api/v1/tracking/orders/{orderId}/timeline': { get: { ...common, operationId: 'getOrderTimeline', summary: 'Customer: timeline tiến độ đơn của mình', parameters: [param('orderId', 'ID đơn hàng (orders.id).')],
    description: 'Chỉ Customer là chủ đơn; đơn của người khác hoặc không tồn tại đều trả 404. `legs` rỗng khi kế hoạch chưa được duyệt. Mỗi chặng có mốc thực tế, `lastUpdatedAt` và `lastUpdatedByName` (cập nhật lần cuối lúc... bởi...) và cờ `isOverdue`.',
    responses: { ...ok(200, ref('OrderTimeline'), orderTimeline), ...errors([400, 401, 403, 404, 429, 500]) } } },
  '/api/v1/tracking/trips/{tripId}/timeline': { get: { ...common, operationId: 'getTripTimeline', summary: 'Timeline nội bộ của chuyến: chặng, mốc, nhật ký ngựa, sự cố, cảnh báo', parameters: [tripId],
    description: 'Driver (được phân công), Coordinator (chuyến mình lập), Manager, Specialist (chỉ đọc, `incidents` luôn rỗng). Kế hoạch và thực tế nằm cạnh nhau trên từng chặng.',
    responses: { ...ok(200, ref('TripTimeline'), tripTimeline), ...errors([400, 401, 403, 404, 429, 500]) } } },
  '/api/v1/tracking/operations/active-trips': { get: { ...common, operationId: 'getActiveTrips', summary: 'Dashboard vận hành: chuyến đang chạy hoặc còn sự cố chưa đóng',
    description: 'Manager và Specialist (chỉ đọc) xem tất cả; Coordinator chỉ chuyến mình lập. Gồm chuyến đã duyệt có Order IN_TRANSIT hoặc còn sự cố chưa đóng (tối đa 200 chuyến). Sắp xếp: sự cố khẩn cấp lên đầu, rồi chuyến trễ, rồi chuyến mới nhất. `isOverdue` chỉ tính cho chuyến IN_TRANSIT có chặng quá giờ đến dự kiến mà chưa hoàn thành.',
    responses: { ...ok(200, ref('ActiveTrips'), { summary: { inTransit: 1, openIncidents: 1, overdueTrips: 0 }, items: [activeItem] }), ...errors([401, 403, 429, 500]) } } },
  '/api/v1/tracking/trips/{tripId}/map': { get: { ...common, operationId: 'getTripMap', summary: 'Bản đồ chuyến: tuyến từng chặng, điểm dừng, km, vị trí xe', parameters: [tripId],
    description: `Driver (được phân công), Coordinator (chuyến mình lập), Manager, Specialist (thấy GPS như Manager, quyết định #4). Customer không gọi API này.
- Tuyến: mọi xe LIGHT/MEDIUM/HEAVY dùng ROAD từ cache \`location_routes\` (30 ngày) hoặc Mapbox Directions (timeout 5 giây). Không có token / lỗi / không có đường → STRAIGHT; không bao giờ trả 500 vì Mapbox.
- \`position\`: GPS khi điểm mới nhất < 10 phút và chặng hiện tại không phải chặng bay; ngược lại ước tính theo mốc (MOVING: theo thời gian, kẹp 0–0.95).
- Không reverse geocode, không lưu địa chỉ từ Mapbox. Giới hạn 60 request/phút/người dùng.`,
    responses: { ...ok(200, ref('TripMap'), tripMap), ...errors([400, 401, 403, 404, 429, 500]) } } },
  '/api/v1/tracking/trips/{tripId}/positions': {
    post: { ...common, operationId: 'recordPositions', summary: 'Driver/Escort: gửi lô vị trí GPS', parameters: [tripId],
      description: 'Chỉ người được phân công; Order IN_TRANSIT, có chặng MOVING/AT_STOP và không phải chặng bay (409). Lô 1–20 điểm; gửi lại cùng `recordedAt` không tạo bản ghi trùng (`duplicates`). Tự xóa sau TRACK_POSITION_RETENTION_DAYS. Giới hạn 30 request/phút/người dùng.',
      requestBody: json('PositionsInput', { points: [{ latitude: 10.9733, longitude: 106.4933, recordedAt: t1, accuracyM: 12, speedMps: 17.8, headingDeg: 310 }] }),
      responses: { ...ok(201, ref('PositionsResult'), { legId: '301', accepted: 1, duplicates: 0 }, 'Đã nhận vị trí.'), ...errors([400, 401, 403, 404, 409, 429, 500]) } },
    get: { ...common, operationId: 'getTrackPoints', summary: 'Vệt đường đã đi (tối đa 500 điểm mới nhất)', parameters: [tripId, { name: 'since', in: 'query', required: false, description: 'Chỉ lấy điểm sau thời điểm này (UTC ISO).', schema: time }],
      description: 'Cùng quyền với bản đồ chuyến. Sắp theo thời gian tăng dần.',
      responses: { ...ok(200, list('TrackPoint'), [{ lat: 10.9733, lng: 106.4933, speedKmh: 64.1, recordedAt: t1, legId: '301' }]), ...errors([400, 401, 403, 404, 429, 500]) } } },
};
