// Flow 3 - Vehicles: danh mục phương tiện (FR-TRP-01). Coordinator thêm/sửa/xóa; Manager chỉ đọc.
const ref = (name: string) => ({ $ref: '#/components/schemas/' + name });
const id = { type: 'string', pattern: '^[1-9]\\d{0,19}$', example: '5', description: 'ID BIGINT dưới dạng chuỗi.' };
const object = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, required, properties });
const vehicleType = { type: 'string', enum: ['LIGHT', 'MEDIUM', 'HEAVY'], description: 'LIGHT: 2 chỗ; MEDIUM: 4–6 chỗ; HEAVY: 9 chỗ.' };
const status = { type: 'string', enum: ['AVAILABLE', 'RESERVED', 'IN_TRANSIT'] };
const plateOrCode = { type: 'string', minLength: 1, maxLength: 30, example: '51C-123.45', description: 'Biển số hoặc mã xe, duy nhất (không phân biệt hoa/thường), tối đa 30 ký tự sau khi trim.' };
const capacityStalls = { type: 'integer', minimum: 1, maximum: 100, example: 4, description: 'Số chỗ ngựa (stall).' };

export const vehicleSchemas = {
  Vehicle: object({
    id, plateOrCode, vehicleType, capacityStalls, status,
    legCount: { type: 'integer', minimum: 0, description: 'Số chặng đã tham chiếu xe; > 0 thì không xóa được.' },
    inActiveUse: { type: 'boolean', description: 'Xe nằm trong kế hoạch đã duyệt của đơn chưa kết thúc: không được đổi status hay giảm sức chứa dưới nhu cầu.' },
  }),
  VehicleList: object({ items: { type: 'array', items: ref('Vehicle') }, total: { type: 'integer', minimum: 0 }, page: { type: 'integer', minimum: 1 }, limit: { type: 'integer', minimum: 1, maximum: 100 } }),
  VehicleCreateInput: object({ plateOrCode, vehicleType, capacityStalls }),
  VehicleUpdateInput: object({ plateOrCode, vehicleType, capacityStalls, status }),
};

export const vehiclesTag = { name: 'Flow 3 - Vehicles' };

const requestIdHeader = { description: 'UUID do server cấp để tra log.', schema: { type: 'string', format: 'uuid' } };
const errorDescriptions: Record<number, string> = {
  400: 'Sai ID/query/body hoặc trường không được phép (kèm fields theo từng trường).',
  401: 'Thiếu token, token sai/hết hạn.',
  403: 'Vai trò không được phép (chỉ Coordinator ghi; Manager chỉ đọc).',
  404: 'Không tìm thấy phương tiện.',
  409: 'Trùng biển số/mã xe, hoặc xe đang được dùng nên không thể xóa/đổi trạng thái/giảm sức chứa.',
  429: 'Vượt giới hạn tần suất request.',
  500: 'Lỗi nội bộ; thông báo an toàn, tra log bằng requestId.',
};
const errors = (codes: number[]) => Object.fromEntries(codes.map(code => [code, {
  description: errorDescriptions[code], headers: { 'X-Request-ID': requestIdHeader }, content: { 'application/json': { schema: ref('Error') } },
}]));
const ok = (status: number, schema: Record<string, unknown>, example: unknown, description = 'Thành công.') =>
  ({ [status]: { description, headers: { 'X-Request-ID': requestIdHeader }, content: { 'application/json': { schema, example } } } });
const common = { tags: [vehiclesTag.name], security: [{ bearer: [] }], 'x-implementation-status': 'implemented' };
const json = (schema: string, example: unknown) => ({ required: true, content: { 'application/json': { schema: ref(schema), example } } });
const vehicleId = { name: 'id', in: 'path', required: true, description: 'ID phương tiện (vehicles.id).', schema: id };
const vehicle = { id: '5', plateOrCode: '51C-123.45', vehicleType: 'MEDIUM', capacityStalls: 4, status: 'AVAILABLE', legCount: 2, inActiveUse: false };

export const vehiclePaths = {
  '/api/v1/vehicles': {
    get: { ...common, operationId: 'listVehicles', summary: 'Coordinator/Manager: danh sách phương tiện theo trạng thái vận hành',
      description: 'Sắp theo biển số/mã xe. `status` = all|AVAILABLE|RESERVED|IN_TRANSIT (mặc định all); `q` tìm theo biển số/mã xe (chứa chuỗi).',
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
        { name: 'status', in: 'query', schema: { type: 'string', enum: ['all', 'AVAILABLE', 'RESERVED', 'IN_TRANSIT'], default: 'all' } },
        { name: 'q', in: 'query', schema: { type: 'string', maxLength: 30 } },
      ],
      responses: { ...ok(200, ref('VehicleList'), { items: [vehicle], total: 1, page: 1, limit: 20 }), ...errors([400, 401, 403, 429, 500]) } },
    post: { ...common, operationId: 'createVehicle', summary: 'Coordinator: thêm phương tiện',
      description: 'Xe mới luôn AVAILABLE. Trùng biển số/mã xe trả 409. Ghi audit (VEHICLE/CREATE).',
      requestBody: json('VehicleCreateInput', { plateOrCode: '51C-123.45', vehicleType: 'MEDIUM', capacityStalls: 4 }),
      responses: { ...ok(201, ref('Vehicle'), vehicle, 'Đã tạo.'), ...errors([400, 401, 403, 409, 429, 500]) } },
  },
  '/api/v1/vehicles/{id}': {
    get: { ...common, operationId: 'getVehicle', summary: 'Coordinator/Manager: chi tiết phương tiện', parameters: [vehicleId],
      responses: { ...ok(200, ref('Vehicle'), vehicle), ...errors([400, 401, 403, 404, 429, 500]) } },
    put: { ...common, operationId: 'updateVehicle', summary: 'Coordinator: sửa phương tiện và trạng thái vận hành', parameters: [vehicleId],
      description: 'Thay thế toàn bộ trường. Khóa dòng xe trong transaction và ghi audit. Không đổi status xe đang nằm trong kế hoạch đã duyệt của đơn chưa kết thúc.',
      requestBody: json('VehicleUpdateInput', { plateOrCode: '51C-123.45', vehicleType: 'MEDIUM', capacityStalls: 6, status: 'AVAILABLE' }),
      responses: { ...ok(200, ref('Vehicle'), { ...vehicle, capacityStalls: 6 }), ...errors([400, 401, 403, 404, 409, 429, 500]) } },
    delete: { ...common, operationId: 'deleteVehicle', summary: 'Coordinator: xóa phương tiện chưa từng được dùng', parameters: [vehicleId],
      description: 'Chỉ xóa được xe chưa có chặng nào tham chiếu (`legCount` = 0). Xe đã dùng trả 409. Ghi audit (VEHICLE/DELETE).',
      responses: { 204: { description: 'Đã xóa.', headers: { 'X-Request-ID': requestIdHeader } }, ...errors([400, 401, 403, 404, 409, 429, 500]) } },
  },
};
