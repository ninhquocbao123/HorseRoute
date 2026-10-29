// Read, save, submit and review endpoints implemented.
const ref = (name: string) => ({ $ref: '#/components/schemas/' + name });
const id = { type: 'string', pattern: '^[1-9]\\d{0,19}$', example: '200', description: 'ID BIGINT dưới dạng chuỗi; không chuyển sang JavaScript Number.' };
const time = { type: 'string', format: 'date-time', pattern: 'Z$', example: '2026-10-20T01:00:00Z', description: 'ISO 8601 UTC, kết thúc bằng Z. Ngày giờ phải tồn tại thực tế.' };
const object = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, required, properties });

const summaryProperties = {
  id, orderId: id, orderCode: { type: 'string', example: 'WDP-DEMO-100' },
  planStatus: { type: 'string', enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] },
  plannedBy: { ...id, description: 'ID Coordinator được chọn khi duyệt đơn, ánh xạ trips.planned_by.' },
  plannedDepartureAt: { ...time, nullable: true }, plannedArrivalAt: { ...time, nullable: true },
};
const legInputProperties = {
  id: { ...id, description: 'Bắt buộc với chặng đã lưu; bỏ trường này với chặng mới. Không gửi null.' },
  fromLocationId: id, toLocationId: id, vehicleId: id,
  plannedDepartureAt: { ...time, pattern: '^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.000)?Z$', description: 'UTC đến giây, năm 1000–9999; cho phép .000Z. Ngày giờ phải tồn tại.' },
  plannedArrivalAt: { ...time, pattern: '^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.000)?Z$', description: 'UTC đến giây, năm 1000–9999; cho phép .000Z. Ngày giờ phải tồn tại.' },
};
const legOutputProperties = {
  id, seqNo: { type: 'integer', minimum: 1 },
  fromLocationId: id, fromLocationName: { type: 'string' },
  toLocationId: id, toLocationName: { type: 'string' },
  vehicleId: { ...id, nullable: true }, vehicleCode: { type: 'string', nullable: true },
  vehicleStatus: { type: 'string', enum: ['AVAILABLE','RESERVED','IN_TRANSIT'], nullable: true },
  plannedDepartureAt: time, plannedArrivalAt: time,
  status: { type: 'string', enum: ['NOT_STARTED', 'MOVING', 'AT_STOP', 'COMPLETED'] },
};

const reviewProperties = {
  orderStatus: { type: 'string', enum: ['DRAFT','PENDING','NEED_INFO','REJECTED','APPROVED','PREPARING','READY','IN_TRANSIT','DELIVERED','CANCELLED'] },
  approvedBy: { ...id, nullable: true }, approvedAt: { ...time, nullable: true },
  returnReason: { type: 'string', nullable: true, maxLength: 255 },
};
export const tripSchemas = {
  RouteWaypoint: object({ id: { type: 'string', maxLength: 64 }, kind: { type: 'string', enum: ['ORIGIN','REST_STOP','DESTINATION'] }, label: { type: 'string', maxLength: 255 }, latitude: { type: 'number', minimum: -90, maximum: 90 }, longitude: { type: 'number', minimum: -180, maximum: 180 }, note: { type: 'string', maxLength: 500 } }),
  SelectedRoute: object({ geometry: object({ type: { type: 'string', enum: ['LineString'] }, coordinates: { type: 'array', minItems: 2, maxItems: 5000, items: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number' } } } }), distanceM: { type: 'number', exclusiveMinimum: 0 }, durationS: { type: 'number', exclusiveMinimum: 0 }, provider: { type: 'string', enum: ['mapbox'] }, calculatedAt: time, inputKey: { type: 'string', pattern: '^[a-f0-9]{64}$' } }),
  RoutePlan: object({ version: { type: 'integer', enum: [1] }, waypoints: { type: 'array', minItems: 2, maxItems: 12, items: ref('RouteWaypoint') }, selectedRoute: { ...ref('SelectedRoute'), nullable: true } }),
  RoutePlanWrite: object({ revision: { type: 'integer', minimum: 0 }, routePlan: ref('RoutePlan'), verificationToken: { type: 'string', nullable: true, maxLength: 400 } }),
  RoutePreviewInput: object({ waypoints: { type: 'array', minItems: 2, maxItems: 12, items: ref('RouteWaypoint') } }),
  RouteCandidate: object({ geometry: object({ type: { type: 'string', enum: ['LineString'] }, coordinates: { type: 'array', minItems: 2, maxItems: 5000, items: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number' } } } }), distanceM: { type: 'number', exclusiveMinimum: 0 }, durationS: { type: 'number', exclusiveMinimum: 0 }, provider: { type: 'string', enum: ['mapbox'] }, calculatedAt: time, inputKey: { type: 'string', pattern: '^[a-f0-9]{64}$' }, verificationToken: { type: 'string' } }),
  RoutePreviewResult: object({ inputKey: { type: 'string', pattern: '^[a-f0-9]{64}$' }, routes: { type: 'array', maxItems: 3, items: ref('RouteCandidate') }, attribution: { type: 'string', enum: ['Mapbox'] } }),
  MapSearchResult: object({ id: { type: 'string' }, label: { type: 'string' }, latitude: { type: 'number' }, longitude: { type: 'number' } }),
  MapSearchResults: object({ items: { type: 'array', maxItems: 5, items: ref('MapSearchResult') }, attribution: { type: 'string', enum: ['Mapbox'] } }),
  CrewOption: object({ id, fullName: { type: 'string' }, crewType: { type: 'string', enum: ['DRIVER','ESCORT'], nullable: true }, workStatus: { type: 'string', enum: ['AVAILABLE','IN_TRIP'], nullable: true }, selectable: { type: 'boolean', nullable: true }, scheduleEvaluation: { type: 'string', enum: ['NOT_EVALUATED'] }, blockingReasons: { type: 'array', items: object({ code: { type: 'string' }, message: { type: 'string' } }) } }),
  AssignmentOptions: object({ items: { type: 'array', items: ref('CrewOption') } }),
  TripAssignment: object({ id, userId: id, fullName: { type: 'string' }, role: { type: 'string', enum: ['DRIVER','ESCORT'] }, assignedBy: id, assignedAt: time, crewType: { type: 'string', enum: ['DRIVER','ESCORT'], nullable: true }, workStatus: { type: 'string', enum: ['AVAILABLE','IN_TRIP'], nullable: true } }),
  CrewBlocker: object({ code: { type: 'string', enum: ['MISSING_DRIVER','MISSING_ESCORT','INELIGIBLE_CREW'] }, message: { type: 'string' }, userId: id }, ['code','message']),
  CrewReadiness: object({ complete: { type: 'boolean' }, blockers: { type: 'array', items: ref('CrewBlocker') } }),
  TripFleetVehicle: object({id,vehicleId:id,plateNumber:{type:'string'},capacityStalls:{type:'integer'},horseCount:{type:'integer',nullable:true},crew:{type:'array',items:ref('TripAssignment')}}),
  TripAssignments: object({ vehicles:{type:'array',items:ref('TripFleetVehicle')}, tripId: id, items: { type: 'array', items: ref('TripAssignment') }, crewReadiness: ref('CrewReadiness') }),
  TripAssignmentsInput: object({ vehicles: { type: 'array', minItems: 1, maxItems: 50, items: object({ vehicleId: id, horseCount: {type:'integer',minimum:1}, crew: {type:'array',minItems:2,maxItems:4,items:object({userId:id,role:{type:'string',enum:['DRIVER','ESCORT']}})} }), description: 'Danh sách đầy đủ xe xuyên suốt chuyến. Mỗi xe 1–2 DRIVER và 1–2 ESCORT; một người chỉ thuộc một xe, một vai trò.' } }),
  ReviewTripPlanInput: { ...object({ decision: { type: 'string', enum: ['APPROVED','RETURNED'] }, reason: { type: 'string', minLength: 1, maxLength: 255, description: 'Bắt buộc khi RETURNED, trim; APPROVED không nhận reason.' } }, ['decision']),
    oneOf: [object({ decision: { type: 'string', enum: ['APPROVED'] } }), object({ decision: { type: 'string', enum: ['RETURNED'] }, reason: { type: 'string', minLength: 1, maxLength: 255 } })] },
  SubmitTripPlanInput: object({}),
  TripSummary: object(summaryProperties),
  TripListItem: object({ ...summaryProperties, tripId: { ...id, description: 'ID chuyến dùng để mở kế hoạch; id cũ vẫn là ID chuyến.' },
    orderStatus: reviewProperties.orderStatus,
    desiredDepartureDate: { type: 'string', format: 'date', nullable: true },
    requestedPickupTime: { type: 'string', nullable: true, description: 'Giờ đón khách yêu cầu trong booking_details; không tự chuyển múi giờ.' },
    horseCount: { type: 'integer', minimum: 0, description: 'Số ngựa của đơn, không tính REMOVED.' } }),
  TripLeg: object(legOutputProperties),
  TripDetail: object({ ...summaryProperties, ...reviewProperties, originAddress: { type: 'string' }, destinationAddress: { type: 'string' }, routePlan: { ...ref('RoutePlan'), nullable: true }, routePlanRevision: { type: 'integer', minimum: 0 }, legs: { type: 'array', items: ref('TripLeg'), description: 'Sắp theo seqNo tăng dần; chuyến chưa có kế hoạch trả [].' } }),
  TripList: object({ items: { type: 'array', items: ref('TripListItem') }, total: { type: 'integer', minimum: 0 }, page: { type: 'integer', minimum: 1 }, limit: { type: 'integer', minimum: 1, maximum: 100 } }),
  TripPlanLegInput: object(legInputProperties, Object.keys(legInputProperties).filter(key => key !== 'id')),
  LegacyTripPlanInput: object({ legs: { type: 'array', minItems: 1, maxItems: 50, items: ref('TripPlanLegInput'), description: 'Chỉ dùng cho chuyến legacy chưa có route_plan.' } }),
  TripPlanInput: object({ plannedDepartureAt: time, plannedArrivalAt: time, routePlanRevision: {type:'integer',minimum:0,description:'Revision route_plan đang hiển thị; chống lưu lịch vào lộ trình đã đổi.'} }),
  TripLocationOption: object({ id, name: { type: 'string' }, locationType: { type: 'string', enum: ['BORDER', 'QUARANTINE_STATION', 'REST_STOP', 'AIRPORT', 'FUEL_STOP'] }, country: { type: 'string', pattern: '^[A-Z]{2}$' }, timezone: { type: 'string', example: 'Asia/Ho_Chi_Minh' }, address: { type: 'string', nullable: true },
    latitude: { type: 'number', minimum: -90, maximum: 90, nullable: true, description: 'WGS84; null khi chưa ghim trên bản đồ. Không ảnh hưởng việc lưu kế hoạch.' },
    longitude: { type: 'number', minimum: -180, maximum: 180, nullable: true, description: 'WGS84; null cùng lúc với latitude.' } }),
  TripVehicleOption: object({ id, plateOrCode: { type: 'string' }, vehicleType: { type: 'string', enum: ['LIGHT', 'MEDIUM', 'HEAVY'] }, capacityStalls: { type: 'integer', minimum: 1 }, status: { type: 'string', enum: ['AVAILABLE','RESERVED','IN_TRANSIT'] }, selectable: { type: 'boolean', nullable: true }, scheduleEvaluation: { type: 'string', enum: ['NOT_EVALUATED'] }, blockingReasons: { type: 'array', items: object({ code: { type: 'string' }, message: { type: 'string' } }) } }),
  TripPlanOptions: object({ requiredHorseCount: { type: 'integer', minimum: 0, description: 'Số ngựa NORMAL phải bố trí đủ trên các xe.' }, locations: { type: 'array', items: ref('TripLocationOption') }, vehicles: { type: 'array', items: ref('TripVehicleOption') } }),
};

const firstLeg = { fromLocationId: '10', toLocationId: '11', vehicleId: '5', plannedDepartureAt: '2026-10-20T01:00:00Z', plannedArrivalAt: '2026-10-20T03:00:00Z' };
const secondLeg = { fromLocationId: '11', toLocationId: '12', vehicleId: '5', plannedDepartureAt: '2026-10-20T04:00:00Z', plannedArrivalAt: '2026-10-20T06:00:00Z' };
const summary = { id: '200', orderId: '100', orderCode: 'WDP-DEMO-100', planStatus: 'DRAFT', plannedBy: '4', plannedDepartureAt: firstLeg.plannedDepartureAt, plannedArrivalAt: secondLeg.plannedArrivalAt };
const reviewFields = { orderStatus: 'PREPARING', approvedBy: null, approvedAt: null, returnReason: null };
const detail = { ...summary, ...reviewFields, originAddress: 'Hà Nội', destinationAddress: 'TP. Hồ Chí Minh', routePlan: null, routePlanRevision: 0, legs: [
  { ...firstLeg, id: '301', seqNo: 1, fromLocationName: 'Điểm A (mẫu)', toLocationName: 'Điểm B (mẫu)', vehicleCode: 'XE-DEMO-01', vehicleStatus: 'AVAILABLE', status: 'NOT_STARTED' },
  { ...secondLeg, id: '302', seqNo: 2, fromLocationName: 'Điểm B (mẫu)', toLocationName: 'Điểm C (mẫu)', vehicleCode: 'XE-DEMO-01', vehicleStatus: 'AVAILABLE', status: 'NOT_STARTED' },
] };
const emptyDetail = { ...summary, ...reviewFields, originAddress: 'Hà Nội', destinationAddress: 'TP. Hồ Chí Minh', routePlan: null, routePlanRevision: 0, plannedDepartureAt: null, plannedArrivalAt: null, legs: [] };
const optionsExample = {
  requiredHorseCount: 4,
  locations: ['10', '11', '12'].map((value, index) => ({ id: value, name: `Điểm ${['A', 'B', 'C'][index]} (mẫu)`, locationType: 'REST_STOP', country: 'VN', timezone: 'Asia/Ho_Chi_Minh', address: null,
    latitude: [10.6380, 11.0760, null][index], longitude: [106.4700, 106.1580, null][index] })),
  vehicles: [{ id: '5', plateOrCode: 'XE-DEMO-01', vehicleType: 'MEDIUM', capacityStalls: 4, status: 'AVAILABLE', selectable: null, scheduleEvaluation: 'NOT_EVALUATED', blockingReasons: [] }],
};

export const tripsTag = {
  name: 'Flow 3 - Trips',
  description: `**Ba API GET, PUT lưu kế hoạch, POST submit-plan và POST review-plan cùng các API phân công đã triển khai.** Phần A của kế hoạch mở rộng đã được người dùng đồng ý; thời gian đệm và thời lượng tối thiểu chưa có con số chốt. Ví dụ dùng ID giả lập; khi Execute phải dùng ID thật.

### Mục tiêu và phạm vi
Tiến làm API/UI lập kế hoạch nháp. Bảo chuẩn bị dữ liệu và tích hợp. Long dùng dữ liệu chặng để xây tracking.
Flow 1 đã tạo Trip DRAFT khi Manager duyệt đơn; **không tạo Trip thứ hai cho cùng Order**.

### Quy ước bàn giao
- ID là chuỗi số; trường JSON camelCase; timestamp UTC có Z, không trả datetime thiếu timezone.
- Form bản đầu đề xuất ghi rõ Asia/Ho_Chi_Minh; đây không phải timezone của mọi điểm quốc tế. 08:00 UTC+7 tương ứng 01:00Z.
- Coordinator chỉ đọc/sửa Trip có planned_by bằng ID tài khoản server. Manager đọc toàn bộ và duyệt/trả lại kế hoạch, không sửa chặng. Các vai trò khác không được gọi API Trips; Long làm API tracking riêng có kiểm tra quyền.
- Chỉ lưu khi Trip DRAFT và Order APPROVED/PREPARING; chặn nếu có chặng đã chạy hoặc lịch sử vận hành.
- Giữ ID/thứ tự chặng cũ, chỉ thêm cuối. seqNo do server suy ra. Không xóa rồi tạo lại.
- Ghi tất cả thay đổi và audit trong một transaction; rollback khi lỗi. Thứ tự khóa đề xuất: Order → Trip → chặng.
- Transaction không thay thế kiểm tra phiên bản: bản lưu sau có thể ghi đè bản trước. Nếu mất response khi thêm chặng, đọc lại chi tiết trước khi gửi lại; chưa có idempotency token cho lưu kế hoạch.

### Các đề xuất cụ thể cần bạn/Bảo/Long duyệt
1. Tối đa 50 chặng mỗi request (giới hạn kỹ thuật, không phải quy định vận tải).
2. Chọn xe AVAILABLE cho mỗi chặng; TripLeg.vehicleStatus giữ nguyên trạng thái danh mục hiện tại.
3. plan-options trả toàn bộ danh mục nhỏ của môi trường phát triển, không phân trang/cắt ngầm trong v0.1.
4. Giữ giới hạn chỉ thêm/sửa tại chỗ; chưa xóa/đảo chặng, chưa chống stale edit.

### Chưa nằm trong contract này
Phân công Driver bằng UI, khởi hành, thông quan, kiểm tra đầy đủ trùng lịch/sức chứa, CRUD danh mục. **Lưu nháp thành công không chứng minh đủ điều kiện khởi hành.**

### Xác nhận
Chưa có xác nhận của Bảo/Long. Sau khi review, ghi quyết định vào Phần 1 của docs/ke-hoach-tien-flow3.md hoặc PR. Swagger không theo dõi trạng thái hoàn thành công việc.
`,
};

const requestIdHeader = { description: 'UUID do server cấp để tra log; không phải khóa chống gửi trùng.', schema: { type: 'string', format: 'uuid' } };
function response(schema: string, examples: Record<string, unknown>) {
  return { description: 'Dữ liệu trả về theo schema. Xem trạng thái triển khai của từng operation.', headers: { 'X-Request-ID': requestIdHeader }, content: { 'application/json': { schema: ref(schema), examples } } };
}
function errors(path: string, codes: number[]) {
  const descriptions: Record<number, string> = {
    400: 'Sai ID, query/body, trường không được phép, xe/địa điểm không hợp lệ hoặc cấu trúc chặng sai.',
    401: 'Thiếu token, token sai/hết hạn.',
    403: 'Vai trò không được phép hoặc tài khoản bị khóa; Manager không được PUT kế hoạch.',
    404: 'Trip không tồn tại hoặc Coordinator không phụ trách Trip này.',
    409: 'Trạng thái Trip/Order không cho sửa hoặc chặng đã vận hành/có lịch sử.',
    413: 'Request vượt giới hạn body JSON của ứng dụng (hiện 1 MB).',
    429: 'Vượt giới hạn tần suất request.',
    500: 'Lỗi nội bộ; thông báo an toàn, tra log bằng requestId.',
    503: 'Nhà cung cấp bản đồ chưa cấu hình, quá thời gian hoặc tạm thời không khả dụng.',
  };
  return Object.fromEntries(codes.map(code => [code, { description: descriptions[code], headers: { 'X-Request-ID': requestIdHeader }, content: { 'application/json': { schema: ref('Error'), example: { statusCode: code, message: descriptions[code], ...(code === 400 && path.endsWith('/plan') ? { fields: { 'legs.1.plannedDepartureAt': 'Giờ đi phải từ giờ đến chặng trước trở đi.' } } : {}), path: path.replace('{id}', '200'), requestId: '3eab0ee0-73a0-4c7b-9971-a468c52b096b', timestamp: '2026-10-17T02:00:00Z' } } } } ]));
}
const pathId = { name: 'id', in: 'path', required: true, description: 'ID Trip đã được Flow 1 tạo, không phải orderId.', schema: id };
const common = { tags: [tripsTag.name], security: [{ bearer: [] }], 'x-implementation-status': 'implemented', 'x-contract-status': 'proposed' };
const readCommon = { ...common, 'x-implementation-status': 'implemented' };
const readNotice = '**ĐÃ TRIỂN KHAI API ĐỌC.** Dùng token thật và ID có trong database. Ví dụ chỉ minh họa. ID tối đa 18446744073709551615; page và offset phải là số nguyên an toàn JavaScript.';
const detailPath = '/api/v1/trips/{id}';
const optionsPath = detailPath + '/plan-options';
const planPath = detailPath + '/plan';

const crewExample = { vehicles: [], tripId: '200', items: [
  { id: '401', userId: '7', fullName: 'Tài xế mẫu', role: 'DRIVER', assignedBy: '4', assignedAt: '2026-10-17T08:00:00.000Z', crewType: 'DRIVER', workStatus: 'AVAILABLE' },
  { id: '402', userId: '8', fullName: 'Người hộ tống mẫu', role: 'ESCORT', assignedBy: '4', assignedAt: '2026-10-17T08:00:00.000Z', crewType: 'ESCORT', workStatus: 'AVAILABLE' },
], crewReadiness: { complete: true, blockers: [] } };
const crewEmpty = { vehicles: [], tripId: '200', items: [], crewReadiness: { complete: false, blockers: [
  { code: 'MISSING_DRIVER', message: 'Chưa có tài xế hợp lệ.' }, { code: 'MISSING_ESCORT', message: 'Chưa có người hộ tống hợp lệ.' },
] } };
export const tripPaths = {
  '/api/v1/maps/search': { get: {
    ...readCommon, operationId: 'searchMapAddresses', summary: '[Đã triển khai] Coordinator tìm địa chỉ qua backend',
    description: 'Chỉ gọi khi nhấn Tìm/Enter. Query q dài 3–200 ký tự; tối đa 30 request/phút/tài khoản. Mapbox permanent=true vì tọa độ được lưu trong route_plan; không tự chọn kết quả.',
    parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 3, maxLength: 200 } }],
    responses: { 200: response('MapSearchResults', { found: { value: { items: [{ id: 'address.example', label: 'Hà Nội, Việt Nam', latitude: 21.0285, longitude: 105.8542 }], attribution: 'Mapbox' } } }), ...errors('/api/v1/maps/search', [400,401,403,429,503,500]) },
  } },
  '/api/v1/trips/{id}/route-preview': { post: {
    ...readCommon, operationId: 'previewTripRoute', summary: '[Đã triển khai] Tính phương án tuyến chưa lưu', parameters: [pathId],
    description: 'Coordinator phụ trách, kế hoạch DRAFT. Mapbox Directions chạy sau backend. Response tối đa 3 phương án kèm token ký 15 phút gắn với tripId, inputKey và toàn bộ tuyến; không ghi database.',
    requestBody: { required: true, content: { 'application/json': { schema: ref('RoutePreviewInput'), examples: { direct: { value: { waypoints: [{ id: 'origin', kind: 'ORIGIN', label: 'Hà Nội', latitude: 21.0285, longitude: 105.8542, note: '' }, { id: 'destination', kind: 'DESTINATION', label: 'TP. Hồ Chí Minh', latitude: 10.7769, longitude: 106.7009, note: '' }] } } } } } },
    responses: { 200: response('RoutePreviewResult', { routes: { value: { inputKey: 'a'.repeat(64), routes: [], attribution: 'Mapbox' } } }), ...errors('/api/v1/trips/{id}/route-preview', [400,401,403,404,409,413,429,503,500]) },
  } },
  '/api/v1/trips/{id}/route-plan': { put: {
    ...readCommon, operationId: 'saveTripRoutePlan', summary: '[Đã triển khai] Thay thế toàn bộ route_plan', parameters: [pathId],
    description: 'Coordinator phụ trách, Trip DRAFT và Order APPROVED/PREPARING, chưa vận hành. revision chống mất cập nhật. Tuyến mới cần token preview hợp lệ; sửa ghi chú có thể giữ nguyên tuyến đã lưu. Không sửa Orders, locations, legs, xe hay nhân sự.',
    requestBody: { required: true, content: { 'application/json': { schema: ref('RoutePlanWrite'), examples: { draft: { value: { revision: 0, routePlan: { version: 1, waypoints: [{ id: 'origin', kind: 'ORIGIN', label: 'Hà Nội', latitude: 21.0285, longitude: 105.8542, note: '' }, { id: 'destination', kind: 'DESTINATION', label: 'TP. Hồ Chí Minh', latitude: 10.7769, longitude: 106.7009, note: '' }], selectedRoute: null }, verificationToken: null } } } } } },
    responses: { 200: response('TripDetail', { saved: { value: detail } }), ...errors('/api/v1/trips/{id}/route-plan', [400,401,403,404,409,413,429,503,500]) },
  } },
  '/api/v1/trips/{id}/assignment-options': { get: {
    ...readCommon, 'x-contract-status': 'accepted', operationId: 'getTripAssignmentOptions', summary: '[Đã triển khai] Nhân sự để phân công', parameters: [pathId],
    description: 'Manager hoặc Coordinator phụ trách. Kiểm tra quyền Trip trước khi trả các tài khoản DRIVER_ESCORT đang ACTIVE. items gồm id chuỗi, fullName; sắp fullName rồi id. Không khẳng định người đang rảnh lịch. Không phân trang trong bản đầu.',
    responses: { 200: response('AssignmentOptions', { available: { value: { items: [{ id: '7', fullName: 'Tài xế mẫu', crewType: 'DRIVER', workStatus: 'AVAILABLE', selectable: null, scheduleEvaluation: 'NOT_EVALUATED', blockingReasons: [] }, { id: '8', fullName: 'Người hộ tống mẫu', crewType: 'ESCORT', workStatus: 'AVAILABLE', selectable: null, scheduleEvaluation: 'NOT_EVALUATED', blockingReasons: [] }] } }, empty: { value: { items: [] } } }), ...errors('/api/v1/trips/{id}/assignment-options', [400,401,403,404,429,500]) },
  } },
  '/api/v1/trips/{id}/assignments': {
    get: { ...readCommon, 'x-contract-status': 'accepted', operationId: 'getTripAssignments', summary: '[Đã triển khai] Xem phân công Driver/Escort', parameters: [pathId],
      description: 'Manager hoặc Coordinator phụ trách. items sắp theo userId rồi ID phân công. crewReadiness chỉ kiểm tra nhân sự: thiếu DRIVER/ESCORT hợp lệ hoặc tài khoản không còn ACTIVE/DRIVER_ESCORT. complete=true KHÔNG có nghĩa Order đủ điều kiện READY. Nhân sự bị khóa vẫn hiện trong danh sách cũ, kèm blocker.',
      responses: { 200: response('TripAssignments', { assigned: { value: crewExample }, empty: { value: crewEmpty } }), ...errors('/api/v1/trips/{id}/assignments', [400,401,403,404,429,500]) },
    },
    put: { ...readCommon, 'x-contract-status': 'accepted', operationId: 'saveTripAssignments', summary: '[Đã triển khai] Coordinator lưu phân công', parameters: [pathId],
      description: 'Thay thế toàn bộ xe và tổ nhân sự trong transaction. Chỉ Coordinator phụ trách, Trip DRAFT, Order APPROVED/PREPARING và chưa vận hành. Tổng số ngựa bố trí phải bằng số ngựa NORMAL; mỗi xe đủ sức chứa. Kiểm tra trạng thái và lịch nếu đã có giờ; lưu nháp chưa giữ chỗ. Gửi duyệt và duyệt kiểm tra lại lịch. Chặng là hành trình chung, không ghi xe qua API plan.',
      requestBody: { required: true, content: { 'application/json': { schema: ref('TripAssignmentsInput'), examples: { fleet: { value: { vehicles: [{ vehicleId: '5', horseCount: 4, crew: [{ userId: '7', role: 'DRIVER' }, { userId: '8', role: 'ESCORT' }] }] } } } } } },
      responses: { 200: response('TripAssignments', { saved: { value: crewExample } }), ...errors('/api/v1/trips/{id}/assignments', [400,401,403,404,409,429,500]) },
    },
  },
  '/api/v1/trips/{id}/review-plan': { post: {
    ...readCommon, 'x-contract-status': 'accepted', operationId: 'reviewTripPlan',
    summary: '[Đã triển khai] Manager duyệt hoặc trả lại kế hoạch', parameters: [pathId],
    description: `Chỉ Manager. Trip phải PENDING_APPROVAL, Order APPROVED/PREPARING và chưa có dữ liệu vận hành.
APPROVED: kiểm tra lại chặng, tuyến, giờ, trạng thái xe và sức chứa ngựa NORMAL; khóa xe theo ID tăng dần rồi kiểm tra lịch đã duyệt dưới READ COMMITTED. Hai kế hoạch trùng xe/trùng giờ không được cùng duyệt.
Khoảng lịch [đi, đến), giờ đến > giờ đi. Chưa có số phút đệm/tối thiểu được chốt. Xe đang MOVING/AT_STOP hoặc đã xuất phát chưa ghi nhận đến ở Order IN_TRANSIT khác bị chặn cho tới khi xác nhận kết thúc vận hành; không suy ra xe đã rảnh từ giờ đến dự kiến.
Ghi approvedBy từ tài khoản hiện tại, approvedAt UTC server; xóa returnReason.
RETURNED: bắt buộc reason sau trim, 1–255 ký tự; Trip về DRAFT, xóa approvedBy/approvedAt, lưu lý do. Có thể trả lại kế hoạch rỗng/sai để Coordinator sửa.
Cả hai quyết định giữ nguyên ID chặng, ghi audit REVIEW_PLAN + thông báo IN_APP cho Coordinator cùng transaction. Nếu duyệt APPROVED khi đã đủ DRIVER/ESCORT hợp lệ, Order PREPARING tự động chuyển READY cùng audit/thông báo. Lỗi rollback toàn bộ. Duyệt lần nữa hoặc sửa Trip đã duyệt trả 409.`,
    requestBody: { required: true, content: { 'application/json': { schema: ref('ReviewTripPlanInput'), examples: {
      approve: { value: { decision: 'APPROVED' } }, returned: { value: { decision: 'RETURNED', reason: 'Điều chỉnh xe và thời gian chặng thứ hai.' } },
    } } } },
    responses: { 200: response('TripDetail', {
      approved: { value: { ...detail, planStatus: 'APPROVED', approvedBy: '2', approvedAt: '2026-10-17T08:00:00.000Z' } },
      returned: { value: { ...detail, planStatus: 'DRAFT', returnReason: 'Điều chỉnh xe và thời gian chặng thứ hai.' } },
    }), ...errors('/api/v1/trips/{id}/review-plan', [400,401,403,404,409,429,500]),
      409: { description: 'Sai trạng thái, có vận hành hoặc kế hoạch/xe/sức chứa/lịch không hợp lệ. Không ghi thay đổi.', content: { 'application/json': { schema: ref('Error') } } },
    },
  } },
  '/api/v1/trips/{id}/submit-plan': { post: {
    ...readCommon, 'x-contract-status': 'accepted', operationId: 'submitTripPlan',
    summary: '[Đã triển khai] Coordinator gửi kế hoạch chờ duyệt', parameters: [pathId],
    description: `Chỉ Coordinator phụ trách. Gửi body {}. Backend đọc kế hoạch đã lưu; không nhận lại chặng trong request này.
Trip phải DRAFT, Order APPROVED/PREPARING, chưa có vận hành. Kiểm tra chặng, điểm nối, trạng thái xe, giờ UTC và thời gian Trip khớp chặng đầu/cuối.
Kiểm tra sơ bộ: có ngựa NORMAL, mỗi ngựa một stall và đi mọi chặng; xe đủ sức chứa; lịch không giao nhau với Trip APPROVED của Order APPROVED/PREPARING/READY/IN_TRANSIT.
Kiểm tra lịch dùng khoảng [giờ đi, giờ đến), chưa áp dụng thời gian đệm hoặc tối thiểu số phút do chưa chốt con số; chặng gửi/duyệt bắt buộc có giờ đến > giờ đi. Đây chưa phải giữ chỗ xe; Manager duyệt phải kiểm tra lại.
Trong cùng transaction: Trip → PENDING_APPROVAL, Order APPROVED → PREPARING (PREPARING giữ nguyên), xóa approvedBy/approvedAt/returnReason cũ, ghi audit SUBMIT_PLAN và thông báo IN_APP cho Manager ACTIVE.
Gửi lần nữa trả 409; PUT sửa chặng sau gửi cũng trả 409. Response TripDetail có orderStatus và thông tin duyệt/trả lại.
Không tự duyệt, phân công hoặc chuyển READY.`,
    requestBody: { required: true, content: { 'application/json': { schema: ref('SubmitTripPlanInput'), examples: { submit: { value: {} } } } } },
    responses: { 200: response('TripDetail', { submitted: { value: { ...detail, planStatus: 'PENDING_APPROVAL' } } }),
      ...errors('/api/v1/trips/{id}/submit-plan', [400, 401, 403, 404, 409, 429, 500]),
      409: { description: 'Trip/Order không cho gửi; chặng, danh mục, sức chứa hoặc lịch xe chưa hợp lệ. Không thay đổi dữ liệu. Tra requestId trong lỗi.', content: { 'application/json': { schema: ref('Error') } } },
    },
  } },
  '/api/v1/trips': { get: {
    ...readCommon, operationId: 'listTrips', summary: '[Đã triển khai] Danh sách chuyến theo quyền',
    description: `${readNotice}\n\nManager xem tất cả; Coordinator chỉ xem chuyến mình phụ trách. items và total phải cùng phạm vi quyền. Sắp theo trips.id giảm dần. Trang vượt dữ liệu trả items rỗng, total vẫn đúng.`,
    parameters: [{ name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } }],
    responses: { 200: response('TripList', { withTrips: { summary: 'Có chuyến', value: { items: [{ ...summary, tripId: summary.id, orderStatus: 'PREPARING', desiredDepartureDate: '2026-10-20', requestedPickupTime: '08:00', horseCount: 2 }], total: 1, page: 1, limit: 20 } }, empty: { summary: 'Chưa có chuyến', value: { items: [], total: 0, page: 1, limit: 20 } } }), ...errors('/api/v1/trips', [400, 401, 403, 429, 500]) },
  } },
  [detailPath]: { get: {
    ...readCommon, operationId: 'getTrip', summary: '[Đã triển khai] Chi tiết chuyến và chặng', parameters: [pathId],
    description: `${readNotice}\n\nManager hoặc Coordinator phụ trách được xem. Chặng theo seqNo tăng dần, gồm tên điểm, mã xe và trạng thái xe. Chuyến mới trả legs: [], các thời gian tổng thể null. vehicleId/vehicleCode/vehicleStatus có thể null; không tự bỏ chặng khỏi response.`,
    responses: { 200: response('TripDetail', { planned: { summary: 'Đã lưu 2 chặng nháp', value: detail }, noLegs: { summary: 'Trip vừa được tạo', value: emptyDetail }, reservedVehicle: { summary: 'Xe cũ hiện RESERVED nhưng vẫn được hiển thị', value: { ...detail, legs: detail.legs.map(leg => ({ ...leg, vehicleStatus: 'RESERVED' })) } } }), ...errors(detailPath, [400, 401, 403, 404, 429, 500]) },
  } },
  [optionsPath]: { get: {
    ...readCommon, operationId: 'getTripPlanOptions', summary: '[Đã triển khai] Địa điểm và xe để lập kế hoạch', parameters: [pathId],
    description: `${readNotice}\n\nKiểm tra quyền đọc Trip trước khi trả danh mục. Trả toàn bộ xe theo plateOrCode rồi id, gồm trạng thái thật và blocker. selectable=null/NOT_EVALUATED nghĩa là chưa đánh giá lịch nháp; server kiểm tra khi ghi.`,
    responses: { 200: response('TripPlanOptions', { available: { summary: 'Danh mục thử', value: optionsExample }, empty: { summary: 'Chưa chuẩn bị danh mục', value: { requiredHorseCount: 0, locations: [], vehicles: [] } } }), ...errors(optionsPath, [400, 401, 403, 404, 429, 500]) },
  } },
  [planPath]: { put: {
    ...readCommon, operationId: 'saveTripDraftPlan', summary: '[Đã triển khai] Coordinator lưu kế hoạch nháp', parameters: [pathId],
    description: `**ĐÃ TRIỂN KHAI API LƯU KẾ HOẠCH.** Dùng token Coordinator phụ trách và ID thật.

### Quyền và trạng thái
Chỉ Coordinator phụ trách. Manager không được sửa. Trip phải DRAFT, Order APPROVED/PREPARING. Kiểm tra lại trong transaction; chặn chặng khác NOT_STARTED hoặc có lịch sử vận hành (milestones, nhật ký/sự cố liên quan).

### Dữ liệu và validation
- Chuyến mới gửi giờ đi, giờ đến và routePlanRevision. Server yêu cầu route_plan có tuyến Mapbox đã chọn và tạo đúng một leg đại diện với các FK địa điểm/xe bằng NULL.
- Giờ đến phải sau giờ đi. routePlanRevision phải đúng revision hiện tại; thay đổi lộ trình sẽ làm mất hiệu lực lịch cũ.
- Payload legs cũ chỉ còn dùng cho chuyến legacy chưa có route_plan.

### Kết quả và giới hạn
Giữ ID chặng cũ, server sinh ID chặng mới và seqNo. Trip lấy thời gian chặng đầu/cuối; trạng thái vẫn DRAFT. Lưu chặng, Trip và audit cùng transaction; không thay đổi hồ sơ, phân công, lịch sử hoặc trạng thái Order. Response là chi tiết đã lưu để frontend cập nhật ID trước lần lưu tiếp theo.
Không có kiểm tra phiên bản/idempotency trong v0.1: nếu mất response sau khi thêm chặng, GET lại chi tiết trước khi retry. Bản ghi sau có thể ghi đè bản trước khi cùng sửa. Chưa chứng nhận đủ điều kiện vận chuyển.
`,
    requestBody: { required: true, content: { 'application/json': { schema: ref('TripPlanInput'), examples: {
      routePlanSchedule: { summary: 'Lưu lịch cho route_plan hiện tại', value: { plannedDepartureAt:'2026-10-30T00:00:00Z',plannedArrivalAt:'2026-11-08T06:00:00Z',routePlanRevision:3 } },
    } } } },
    responses: { 200: response('TripDetail', { firstSave: { summary: 'Sau lưu lần đầu', value: detail }, editExisting: { summary: 'Sau sửa giờ chặng 302', value: { ...detail, plannedArrivalAt: '2026-10-20T07:00:00Z', legs: [detail.legs[0], { ...detail.legs[1], plannedArrivalAt: '2026-10-20T07:00:00Z' }] } } }), ...errors(planPath, [400, 401, 403, 404, 409, 413, 429, 500]) },
  } },
};
