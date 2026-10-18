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
  vehicleActive: { type: 'boolean', nullable: true, description: 'Trạng thái active hiện tại của xe; null khi chặng không có xe. Dùng hiển thị xe cũ đã ngừng hoạt động.' },
  plannedDepartureAt: time, plannedArrivalAt: time,
  status: { type: 'string', enum: ['NOT_STARTED', 'MOVING', 'AT_STOP', 'COMPLETED'] },
};

const reviewProperties = {
  orderStatus: { type: 'string', enum: ['DRAFT','PENDING','NEED_INFO','REJECTED','APPROVED','PREPARING','READY','IN_TRANSIT','DELIVERED','CANCELLED'] },
  approvedBy: { ...id, nullable: true }, approvedAt: { ...time, nullable: true },
  returnReason: { type: 'string', nullable: true, maxLength: 255 },
};
export const tripSchemas = {
  ReadinessBlocker: object({ code: { type: 'string' }, message: { type: 'string' }, horseId: id, documentId: id, dossierId: id, legId: id, userId: id }, ['code','message']),
  TripReadiness: object({ tripId: id, orderId: id, orderStatus: { type: 'string' }, planStatus: { type: 'string' }, eligibleForReady: { type: 'boolean' }, blockers: { type: 'array', items: ref('ReadinessBlocker') } }),
  MarkReadyResult: object({ orderId: id, tripId: id, orderStatus: { type: 'string', enum: ['READY'] }, planStatus: { type: 'string', enum: ['APPROVED'] } }),

  CrewOption: object({ id, fullName: { type: 'string' } }),
  AssignmentOptions: object({ items: { type: 'array', items: ref('CrewOption') } }),
  TripAssignment: object({ id, userId: id, fullName: { type: 'string' }, role: { type: 'string', enum: ['DRIVER','ESCORT'] }, assignedBy: id, assignedAt: time }),
  CrewBlocker: object({ code: { type: 'string', enum: ['MISSING_DRIVER','MISSING_ESCORT','INELIGIBLE_CREW'] }, message: { type: 'string' }, userId: id }, ['code','message']),
  CrewReadiness: object({ complete: { type: 'boolean' }, blockers: { type: 'array', items: ref('CrewBlocker') } }),
  TripAssignments: object({ tripId: id, items: { type: 'array', items: ref('TripAssignment') }, crewReadiness: ref('CrewReadiness') }),
  TripAssignmentsInput: object({ assignments: { type: 'array', minItems: 2, maxItems: 100, items: object({ userId: id, role: { type: 'string', enum: ['DRIVER','ESCORT'] } }), description: 'Danh sách đầy đủ, ít nhất một DRIVER và một ESCORT khác người. Không trùng userId. Giới hạn kỹ thuật 100 người/request.' } }),
  ReviewTripPlanInput: { ...object({ decision: { type: 'string', enum: ['APPROVED','RETURNED'] }, reason: { type: 'string', minLength: 1, maxLength: 255, description: 'Bắt buộc khi RETURNED, trim; APPROVED không nhận reason.' } }, ['decision']),
    oneOf: [object({ decision: { type: 'string', enum: ['APPROVED'] } }), object({ decision: { type: 'string', enum: ['RETURNED'] }, reason: { type: 'string', minLength: 1, maxLength: 255 } })] },
  SubmitTripPlanInput: object({}),
  TripSummary: object(summaryProperties),
  TripLeg: object(legOutputProperties),
  TripDetail: object({ ...summaryProperties, ...reviewProperties, legs: { type: 'array', items: ref('TripLeg'), description: 'Sắp theo seqNo tăng dần; chuyến chưa có kế hoạch trả [].' } }),
  TripList: object({ items: { type: 'array', items: ref('TripSummary') }, total: { type: 'integer', minimum: 0 }, page: { type: 'integer', minimum: 1 }, limit: { type: 'integer', minimum: 1, maximum: 100 } }),
  TripPlanLegInput: object(legInputProperties, Object.keys(legInputProperties).filter(key => key !== 'id')),
  TripPlanInput: object({ legs: { type: 'array', minItems: 1, maxItems: 50, items: ref('TripPlanLegInput'), description: 'Đề xuất giới hạn kỹ thuật 50 chặng/request, chờ xác nhận. Gửi đủ các chặng cũ đúng thứ tự, sau đó mới đến chặng mới. Không hỗ trợ xóa/đảo thứ tự.' } }),
  TripLocationOption: object({ id, name: { type: 'string' }, locationType: { type: 'string', enum: ['BORDER', 'QUARANTINE_STATION', 'REST_STOP', 'AIRPORT', 'FUEL_STOP'] }, country: { type: 'string', pattern: '^[A-Z]{2}$' }, timezone: { type: 'string', example: 'Asia/Ho_Chi_Minh' }, address: { type: 'string', nullable: true } }),
  TripVehicleOption: object({ id, plateOrCode: { type: 'string' }, vehicleType: { type: 'string', enum: ['TRUCK', 'AIRCRAFT_HOLD', 'CRATE'] }, capacityStalls: { type: 'integer', minimum: 1 }, isActive: { type: 'boolean', enum: [true] } }),
  TripPlanOptions: object({ locations: { type: 'array', items: ref('TripLocationOption') }, vehicles: { type: 'array', items: ref('TripVehicleOption') } }),
};

const firstLeg = { fromLocationId: '10', toLocationId: '11', vehicleId: '5', plannedDepartureAt: '2026-10-20T01:00:00Z', plannedArrivalAt: '2026-10-20T03:00:00Z' };
const secondLeg = { fromLocationId: '11', toLocationId: '12', vehicleId: '5', plannedDepartureAt: '2026-10-20T04:00:00Z', plannedArrivalAt: '2026-10-20T06:00:00Z' };
const summary = { id: '200', orderId: '100', orderCode: 'WDP-DEMO-100', planStatus: 'DRAFT', plannedBy: '4', plannedDepartureAt: firstLeg.plannedDepartureAt, plannedArrivalAt: secondLeg.plannedArrivalAt };
const reviewFields = { orderStatus: 'PREPARING', approvedBy: null, approvedAt: null, returnReason: null };
const detail = { ...summary, ...reviewFields, legs: [
  { ...firstLeg, id: '301', seqNo: 1, fromLocationName: 'Điểm A (mẫu)', toLocationName: 'Điểm B (mẫu)', vehicleCode: 'XE-DEMO-01', vehicleActive: true, status: 'NOT_STARTED' },
  { ...secondLeg, id: '302', seqNo: 2, fromLocationName: 'Điểm B (mẫu)', toLocationName: 'Điểm C (mẫu)', vehicleCode: 'XE-DEMO-01', vehicleActive: true, status: 'NOT_STARTED' },
] };
const emptyDetail = { ...summary, ...reviewFields, plannedDepartureAt: null, plannedArrivalAt: null, legs: [] };
const optionsExample = {
  locations: ['10', '11', '12'].map((value, index) => ({ id: value, name: `Điểm ${['A', 'B', 'C'][index]} (mẫu)`, locationType: 'REST_STOP', country: 'VN', timezone: 'Asia/Ho_Chi_Minh', address: null })),
  vehicles: [{ id: '5', plateOrCode: 'XE-DEMO-01', vehicleType: 'TRUCK', capacityStalls: 4, isActive: true }],
};

export const tripsTag = {
  name: 'Flow 3 - Trips',
  description: `**Ba API GET, PUT lưu kế hoạch, POST submit-plan và POST review-plan và các API phân công, GET readiness, POST mark-ready đã triển khai.** Phần A của kế hoạch mở rộng đã được người dùng đồng ý; thời gian đệm và thời lượng tối thiểu chưa có con số chốt. Ví dụ dùng ID giả lập; khi Execute phải dùng ID thật.

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
2. Chọn xe active cho mỗi chặng khi lưu; TripLeg.vehicleActive cho biết xe cũ đã inactive, null khi không có xe.
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
    409: path.endsWith('/mark-ready') ? 'Chưa đủ điều kiện READY hoặc đã READY; xem blockers để biết lý do.' : 'Trạng thái Trip/Order không cho sửa hoặc chặng đã vận hành/có lịch sử.',
    413: 'Request vượt giới hạn body JSON của ứng dụng (hiện 1 MB).',
    429: 'Vượt giới hạn tần suất request.',
    500: 'Lỗi nội bộ; thông báo an toàn, tra log bằng requestId.',
  };
  return Object.fromEntries(codes.map(code => [code, { description: descriptions[code], headers: { 'X-Request-ID': requestIdHeader }, content: { 'application/json': { schema: ref('Error'), example: { statusCode: code, message: descriptions[code], ...(code === 409 && path.endsWith('/mark-ready') ? { blockers: [{ code: 'MISSING_ESCORT', message: 'Chưa có người hộ tống hợp lệ.' }] } : {}), ...(code === 400 && path.endsWith('/plan') ? { fields: { 'legs.1.plannedDepartureAt': 'Giờ đi phải từ giờ đến chặng trước trở đi.' } } : {}), path: path.replace('{id}', '200'), requestId: '3eab0ee0-73a0-4c7b-9971-a468c52b096b', timestamp: '2026-10-17T02:00:00Z' } } } } ]));
}
const pathId = { name: 'id', in: 'path', required: true, description: 'ID Trip đã được Flow 1 tạo, không phải orderId.', schema: id };
const common = { tags: [tripsTag.name], security: [{ bearer: [] }], 'x-implementation-status': 'implemented', 'x-contract-status': 'proposed' };
const readCommon = { ...common, 'x-implementation-status': 'implemented' };
const readNotice = '**ĐÃ TRIỂN KHAI API ĐỌC.** Dùng token thật và ID có trong database. Ví dụ chỉ minh họa. ID tối đa 18446744073709551615; page và offset phải là số nguyên an toàn JavaScript.';
const detailPath = '/api/v1/trips/{id}';
const optionsPath = detailPath + '/plan-options';
const planPath = detailPath + '/plan';

const crewExample = { tripId: '200', items: [
  { id: '401', userId: '7', fullName: 'Tài xế mẫu', role: 'DRIVER', assignedBy: '4', assignedAt: '2026-10-17T08:00:00.000Z' },
  { id: '402', userId: '8', fullName: 'Người hộ tống mẫu', role: 'ESCORT', assignedBy: '4', assignedAt: '2026-10-17T08:00:00.000Z' },
], crewReadiness: { complete: true, blockers: [] } };
const crewEmpty = { tripId: '200', items: [], crewReadiness: { complete: false, blockers: [
  { code: 'MISSING_DRIVER', message: 'Chưa có tài xế hợp lệ.' }, { code: 'MISSING_ESCORT', message: 'Chưa có người hộ tống hợp lệ.' },
] } };
export const tripPaths = {
  '/api/v1/trips/{id}/readiness': { get: { ...common, summary: 'Kiểm tra điều kiện chuyển READY (chỉ đọc)',
    description: 'Coordinator phụ trách hoặc Manager. Không body. Trả tất cả blockers tìm được: kế hoạch, ngựa, xe, nhân sự, giấy tờ, hồ sơ và file thật. Không expire giấy tờ/đổi trạng thái. Đơn cũ thiếu requirements_snapshot trả REQUIREMENTS_UNVERIFIED. READY không đủ điều kiện chuyển lần nữa. Không chứng nhận điều kiện vĩnh viễn; Flow 4 phải kiểm tra lại trước khởi hành. Lịch xe dùng [đi,đến), chưa có buffer Phần E.',
    parameters: [pathId], responses: { 200: response('TripReadiness', { blocked: { value: { tripId: '200', orderId: '100', orderStatus: 'PREPARING', planStatus: 'APPROVED', eligibleForReady: false, blockers: [{ code: 'MISSING_ESCORT', message: 'Chưa có người hộ tống hợp lệ.' }] } } }), ...errors('/api/v1/trips/{id}/readiness', [400,401,403,404,429,500]) } } },
  '/api/v1/orders/{id}/mark-ready': { post: { ...common, summary: 'Manager chuyển đơn đủ điều kiện sang READY',
    description: 'Chỉ Manager. ID là orderId. Body strict {}. Đọc lại điều kiện dưới khóa Order → Trip → legs → tài nguyên. 409 kèm blockers nếu không đạt hoặc đã READY; không đổi dữ liệu. Thành công giữ Trip APPROVED, audit MARK_READY + thông báo IN_APP cùng transaction. File được xác minh theo key bất biến trước transaction; không thể chống xóa ngoài kho file sau xác minh. Flow 4 bắt buộc kiểm tra lại trước khởi hành; không tự hạ READY khi điều kiện mất hiệu lực.',
    parameters: [{ ...pathId, description: 'ID Order, không phải Trip.' }],
    requestBody: { required: true, content: { 'application/json': { schema: ref('SubmitTripPlanInput'), example: {} } } },
    responses: { 200: response('MarkReadyResult', { ready: { value: { orderId: '100', tripId: '200', orderStatus: 'READY', planStatus: 'APPROVED' } } }), ...errors('/api/v1/orders/{id}/mark-ready', [400,401,403,404,409,413,429,500]) } } },

  '/api/v1/trips/{id}/assignment-options': { get: {
    ...readCommon, 'x-contract-status': 'accepted', operationId: 'getTripAssignmentOptions', summary: '[Đã triển khai] Nhân sự để phân công', parameters: [pathId],
    description: 'Manager hoặc Coordinator phụ trách. Kiểm tra quyền Trip trước khi trả các tài khoản DRIVER_ESCORT đang ACTIVE. items gồm id chuỗi, fullName; sắp fullName rồi id. Không khẳng định người đang rảnh lịch. Không phân trang trong bản đầu.',
    responses: { 200: response('AssignmentOptions', { available: { value: { items: [{ id: '7', fullName: 'Tài xế mẫu' }, { id: '8', fullName: 'Người hộ tống mẫu' }] } }, empty: { value: { items: [] } } }), ...errors('/api/v1/trips/{id}/assignment-options', [400,401,403,404,429,500]) },
  } },
  '/api/v1/trips/{id}/assignments': {
    get: { ...readCommon, 'x-contract-status': 'accepted', operationId: 'getTripAssignments', summary: '[Đã triển khai] Xem phân công Driver/Escort', parameters: [pathId],
      description: 'Manager hoặc Coordinator phụ trách. items sắp theo userId rồi ID phân công. crewReadiness chỉ kiểm tra nhân sự: thiếu DRIVER/ESCORT hợp lệ hoặc tài khoản không còn ACTIVE/DRIVER_ESCORT. complete=true KHÔNG có nghĩa Order đủ điều kiện READY. Nhân sự bị khóa vẫn hiện trong danh sách cũ, kèm blocker.',
      responses: { 200: response('TripAssignments', { assigned: { value: crewExample }, empty: { value: crewEmpty } }), ...errors('/api/v1/trips/{id}/assignments', [400,401,403,404,429,500]) },
    },
    put: { ...readCommon, 'x-contract-status': 'accepted', operationId: 'saveTripAssignments', summary: '[Đã triển khai] Coordinator lưu phân công', parameters: [pathId],
      description: `Chỉ Coordinator phụ trách. Order APPROVED/PREPARING, chưa có vận hành/lịch sử; không hạn chế planStatus của Trip vì không sửa chặng.
Gửi danh sách đầy đủ 2–100 người. Ít nhất một DRIVER, một ESCORT khác người; userId duy nhất, tài khoản DRIVER_ESCORT ACTIVE. Không nhận assignedBy/assignedAt/id phân công từ client.
Khóa Order → Trip → chặng → users theo ID → phân công. Giữ ID và metadata của dòng không đổi; đổi role giữ ID và cập nhật actor/time; thêm người mới, xóa người bị bỏ khỏi danh sách.
Audit ASSIGN_CREW và thông báo IN_APP cho người được thêm/đổi role/gỡ phân công cùng transaction. Gửi lại danh sách giống cũ không thêm audit/thông báo. Lỗi rollback toàn bộ.
Không đổi trạng thái Order/Trip, không sửa legs. Chưa kiểm tra trùng lịch nhân sự, chưa có version chống ghi đè hai danh sách khác nhau; request sau có thể thay thế request trước.`,
      requestBody: { required: true, content: { 'application/json': { schema: ref('TripAssignmentsInput'), examples: { assign: { value: { assignments: [{ userId: '7', role: 'DRIVER' }, { userId: '8', role: 'ESCORT' }] } } } } } },
      responses: { 200: response('TripAssignments', { saved: { value: crewExample } }), ...errors('/api/v1/trips/{id}/assignments', [400,401,403,404,409,429,500]) },
    },
  },
  '/api/v1/trips/{id}/review-plan': { post: {
    ...readCommon, 'x-contract-status': 'accepted', operationId: 'reviewTripPlan',
    summary: '[Đã triển khai] Manager duyệt hoặc trả lại kế hoạch', parameters: [pathId],
    description: `Chỉ Manager. Trip phải PENDING_APPROVAL, Order APPROVED/PREPARING và chưa có dữ liệu vận hành.
APPROVED: kiểm tra lại chặng, tuyến, giờ, xe active và sức chứa ngựa NORMAL; khóa xe theo ID tăng dần rồi kiểm tra lịch đã duyệt dưới READ COMMITTED. Hai kế hoạch trùng xe/trùng giờ không được cùng duyệt.
Khoảng lịch [đi, đến), giờ đến > giờ đi. Chưa có số phút đệm/tối thiểu được chốt. Xe đang MOVING/AT_STOP hoặc đã xuất phát chưa ghi nhận đến ở Order IN_TRANSIT khác bị chặn cho tới khi xác nhận kết thúc vận hành; không suy ra xe đã rảnh từ giờ đến dự kiến.
Ghi approvedBy từ tài khoản hiện tại, approvedAt UTC server; xóa returnReason.
RETURNED: bắt buộc reason sau trim, 1–255 ký tự; Trip về DRAFT, xóa approvedBy/approvedAt, lưu lý do. Có thể trả lại kế hoạch rỗng/sai để Coordinator sửa.
Cả hai quyết định giữ nguyên Order và ID chặng, ghi audit REVIEW_PLAN + thông báo IN_APP cho Coordinator cùng transaction. Lỗi rollback toàn bộ. Duyệt lần nữa hoặc sửa Trip đã duyệt trả 409.
API phân công không chuyển Order READY; dùng GET readiness và POST orders/{id}/mark-ready.`,
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
Trip phải DRAFT, Order APPROVED/PREPARING, chưa có vận hành. Kiểm tra chặng, điểm nối, xe active, giờ UTC và thời gian Trip khớp chặng đầu/cuối.
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
    responses: { 200: response('TripList', { withTrips: { summary: 'Có chuyến', value: { items: [summary], total: 1, page: 1, limit: 20 } }, empty: { summary: 'Chưa có chuyến', value: { items: [], total: 0, page: 1, limit: 20 } } }), ...errors('/api/v1/trips', [400, 401, 403, 429, 500]) },
  } },
  [detailPath]: { get: {
    ...readCommon, operationId: 'getTrip', summary: '[Đã triển khai] Chi tiết chuyến và chặng', parameters: [pathId],
    description: `${readNotice}\n\nManager hoặc Coordinator phụ trách được xem. Chặng theo seqNo tăng dần, gồm tên điểm và mã xe để UI không phải tự nối danh mục. Chuyến mới trả legs: [], các thời gian tổng thể null. vehicleId/vehicleCode/vehicleActive có thể null; không tự bỏ chặng khỏi response.`,
    responses: { 200: response('TripDetail', { planned: { summary: 'Đã lưu 2 chặng nháp', value: detail }, noLegs: { summary: 'Trip vừa được tạo', value: emptyDetail }, inactiveVehicle: { summary: 'Xe của chặng cũ đã inactive; cần đổi trước khi lưu', value: { ...detail, legs: detail.legs.map(leg => ({ ...leg, vehicleActive: false })) } } }), ...errors(detailPath, [400, 401, 403, 404, 429, 500]) },
  } },
  [optionsPath]: { get: {
    ...readCommon, operationId: 'getTripPlanOptions', summary: '[Đã triển khai] Địa điểm và xe để lập kế hoạch', parameters: [pathId],
    description: `${readNotice}\n\nKiểm tra quyền đọc Trip trước khi trả danh mục. v0.1 trả toàn bộ danh mục nhỏ, không phân trang/cắt ngầm; locations theo name rồi id, vehicles theo plateOrCode rồi id. vehicles chỉ chứa xe active. Mảng rỗng nghĩa là chưa có lựa chọn; không suy ra đây là danh sách xe chắc chắn rảnh lịch hoặc đủ sức chứa. Tên và trạng thái xe cũ lấy từ chi tiết Trip, kể cả khi xe không còn trong options.`,
    responses: { 200: response('TripPlanOptions', { available: { summary: 'Danh mục thử', value: optionsExample }, empty: { summary: 'Chưa chuẩn bị danh mục', value: { locations: [], vehicles: [] } } }), ...errors(optionsPath, [400, 401, 403, 404, 429, 500]) },
  } },
  [planPath]: { put: {
    ...readCommon, operationId: 'saveTripDraftPlan', summary: '[Đã triển khai] Coordinator lưu kế hoạch nháp', parameters: [pathId],
    description: `**ĐÃ TRIỂN KHAI API LƯU KẾ HOẠCH.** Dùng token Coordinator phụ trách và ID thật.

### Quyền và trạng thái
Chỉ Coordinator phụ trách. Manager không được sửa. Trip phải DRAFT, Order APPROVED/PREPARING. Kiểm tra lại trong transaction; chặn chặng khác NOT_STARTED hoặc có lịch sử vận hành (milestones, nhật ký/sự cố liên quan).

### Dữ liệu và validation
- Gửi đầy đủ 1–50 chặng theo giới hạn kỹ thuật hiện tại, không phải PATCH một chặng.
- Chặng cũ phải có id thuộc Trip, không trùng, đúng thứ tự và không được bỏ sót; chặng mới không có id, chỉ thêm sau các chặng cũ. Thiếu/đảo thứ tự/trộn ID chuyến khác trả 400.
- Điểm và xe phải tồn tại; xe active; điểm đi khác điểm đến. Điểm đến chặng trước = điểm đi chặng sau.
- Giờ đến >= giờ đi; giờ đi chặng sau >= giờ đến chặng trước. Nhận ngày giờ ISO UTC có Z, năm 1000–9999, chính xác đến giây; chấp nhận .000Z nhưng từ chối phần lẻ giây khác 0 vì schema dùng DATETIME(0). Không chấp nhận ngày không tồn tại. Không tự thêm quy tắc phải cách ngày hiện tại N ngày trong contract này.
- Không nhận seqNo, plannedBy, orderId, planStatus, status, carrierId hoặc actual* từ body. Dữ liệu carrier cũ không được xóa ngầm chỉ vì field không thuộc contract.

### Kết quả và giới hạn
Giữ ID chặng cũ, server sinh ID chặng mới và seqNo. Trip lấy thời gian chặng đầu/cuối; trạng thái vẫn DRAFT. Lưu chặng, Trip và audit cùng transaction; không thay đổi hồ sơ, phân công, lịch sử hoặc trạng thái Order. Response là chi tiết đã lưu để frontend cập nhật ID trước lần lưu tiếp theo.
Không có kiểm tra phiên bản/idempotency trong v0.1: nếu mất response sau khi thêm chặng, GET lại chi tiết trước khi retry. Bản ghi sau có thể ghi đè bản trước khi cùng sửa. Chưa chứng nhận đủ điều kiện vận chuyển.
`,
    requestBody: { required: true, content: { 'application/json': { schema: ref('TripPlanInput'), examples: {
      firstSave: { summary: 'Lưu lần đầu: chặng mới không có id', value: { legs: [firstLeg, secondLeg] } },
      editExisting: { summary: 'Sửa giờ chặng 302: giữ đủ ID và thứ tự', value: { legs: [{ ...firstLeg, id: '301' }, { ...secondLeg, id: '302', plannedArrivalAt: '2026-10-20T07:00:00Z' }] } },
    } } } },
    responses: { 200: response('TripDetail', { firstSave: { summary: 'Sau lưu lần đầu', value: detail }, editExisting: { summary: 'Sau sửa giờ chặng 302', value: { ...detail, plannedArrivalAt: '2026-10-20T07:00:00Z', legs: [detail.legs[0], { ...detail.legs[1], plannedArrivalAt: '2026-10-20T07:00:00Z' }] } } }), ...errors(planPath, [400, 401, 403, 404, 409, 413, 429, 500]) },
  } },
};
