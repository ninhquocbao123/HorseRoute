// Flow 3 - Locations: danh mục địa điểm / cửa khẩu (FR-TRP-02). Specialist thêm/sửa/xóa; Coordinator, Manager chỉ đọc.
const ref = (name: string) => ({ $ref: '#/components/schemas/' + name });
const id = { type: 'string', pattern: '^[1-9]\\d{0,19}$', example: '3', description: 'ID BIGINT dưới dạng chuỗi.' };
const object = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, required, properties });
const locationType = { type: 'string', enum: ['BORDER', 'QUARANTINE_STATION', 'REST_STOP', 'AIRPORT', 'FUEL_STOP'], description: 'BORDER: cửa khẩu (Flow 4 bắt buộc thủ tục hải quan khi đến); QUARANTINE_STATION: trạm kiểm dịch; REST_STOP: điểm dừng nghỉ; AIRPORT: sân bay; FUEL_STOP: trạm nhiên liệu.' };
const name = { type: 'string', minLength: 1, maxLength: 150, example: 'Cửa khẩu Mộc Bài', description: 'Duy nhất trong cùng quốc gia (không phân biệt hoa/thường và dấu).' };
const country = { type: 'string', pattern: '^[A-Za-z]{2}$', example: 'VN', description: 'ISO 3166-1 alpha-2; lưu dạng chữ hoa.' };
const timezone = { type: 'string', maxLength: 50, example: 'Asia/Ho_Chi_Minh', description: 'Tên múi giờ IANA (Khu_vực/Thành_phố hoặc UTC); không nhận offset như +07:00.' };
const address = { type: 'string', maxLength: 255, nullable: true, example: 'QL22, Bến Cầu, Tây Ninh' };
const latitude = { type: 'number', minimum: -90, maximum: 90, example: 11.076, description: 'Vĩ độ WGS84, làm tròn 6 chữ số. Không nhận cặp (0, 0).' };
const longitude = { type: 'number', minimum: -180, maximum: 180, example: 106.158, description: 'Kinh độ WGS84, làm tròn 6 chữ số.' };
const nullable = (schema: Record<string, unknown>, description: string) => ({ ...schema, nullable: true, description });

export const locationSchemas = {
  Location: object({
    id, name, locationType, country: { ...country, pattern: '^[A-Z]{2}$' }, timezone, address,
    latitude: nullable(latitude, 'Vĩ độ WGS84; null khi địa điểm cũ chưa được ghim.'),
    longitude: nullable(longitude, 'Kinh độ WGS84; null cùng lúc với latitude.'),
    legCount: { type: 'integer', minimum: 0, description: 'Số chặng đi từ/đến địa điểm; > 0 thì không xóa được.' },
    ruleCount: { type: 'integer', minimum: 0, description: 'Số quy định kiểm dịch dùng địa điểm làm cửa khẩu; > 0 thì không xóa được.' },
    inActiveUse: { type: 'boolean', description: 'Nằm trong kế hoạch đã duyệt của đơn APPROVED/PREPARING/READY/IN_TRANSIT: không được đổi loại.' },
  }),
  LocationList: object({ items: { type: 'array', items: ref('Location') }, total: { type: 'integer', minimum: 0 }, page: { type: 'integer', minimum: 1 }, limit: { type: 'integer', minimum: 1, maximum: 100 } }),
  LocationInput: object({ name, locationType, country, timezone, address, latitude, longitude }, ['name', 'locationType', 'country', 'timezone', 'latitude', 'longitude']),
};

export const locationsTag = { name: 'Flow 3 - Locations' };

const requestIdHeader = { description: 'UUID do server cấp để tra log.', schema: { type: 'string', format: 'uuid' } };
const errorDescriptions: Record<number, string> = {
  400: 'Sai ID/query/body hoặc trường không được phép (kèm fields theo từng trường).',
  401: 'Thiếu token, token sai/hết hạn.',
  403: 'Vai trò không được phép (chỉ Specialist ghi; Coordinator, Manager chỉ đọc).',
  404: 'Không tìm thấy địa điểm.',
  409: 'Trùng tên trong cùng quốc gia; đổi loại khi đang dùng; hoặc xóa địa điểm đã có chặng/quy định tham chiếu.',
  429: 'Vượt giới hạn tần suất request.',
  500: 'Lỗi nội bộ; thông báo an toàn, tra log bằng requestId.',
};
const errors = (codes: number[]) => Object.fromEntries(codes.map(code => [code, {
  description: errorDescriptions[code], headers: { 'X-Request-ID': requestIdHeader }, content: { 'application/json': { schema: ref('Error') } },
}]));
const ok = (status: number, schema: Record<string, unknown>, example: unknown, description = 'Thành công.') =>
  ({ [status]: { description, headers: { 'X-Request-ID': requestIdHeader }, content: { 'application/json': { schema, example } } } });
const common = { tags: [locationsTag.name], security: [{ bearer: [] }], 'x-implementation-status': 'implemented' };
const json = (schema: string, example: unknown) => ({ required: true, content: { 'application/json': { schema: ref(schema), example } } });
const locationId = { name: 'id', in: 'path', required: true, description: 'ID địa điểm (locations.id).', schema: id };
const input = { name: 'Cửa khẩu Mộc Bài', locationType: 'BORDER', country: 'VN', timezone: 'Asia/Ho_Chi_Minh', address: 'QL22, Bến Cầu, Tây Ninh', latitude: 11.076, longitude: 106.158 };
const location = { id: '3', ...input, legCount: 4, ruleCount: 1, inActiveUse: false };

export const locationPaths = {
  '/api/v1/locations': {
    get: { ...common, operationId: 'listLocations', summary: 'Specialist/Coordinator/Manager: danh mục địa điểm',
      description: 'Sắp theo tên. Lọc `locationType`, `country`, `coordinates` = all|missing|present (missing: chưa ghim trên bản đồ), `q` tìm theo tên (chứa chuỗi). Phân trang `page`/`limit` (tối đa 100).',
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
        { name: 'locationType', in: 'query', schema: locationType },
        { name: 'country', in: 'query', schema: country },
        { name: 'coordinates', in: 'query', schema: { type: 'string', enum: ['all', 'missing', 'present'], default: 'all' } },
        { name: 'q', in: 'query', schema: { type: 'string', maxLength: 150 } },
      ],
      responses: { ...ok(200, ref('LocationList'), { items: [location], total: 1, page: 1, limit: 20 }), ...errors([400, 401, 403, 429, 500]) } },
    post: { ...common, operationId: 'createLocation', summary: 'Specialist: thêm địa điểm (bắt buộc tọa độ)',
      description: 'Tọa độ lấy từ ghim trên bản đồ (không lưu kết quả geocoding). Trùng tên trong cùng quốc gia trả 409. Ghi audit (LOCATION/CREATE).',
      requestBody: json('LocationInput', input),
      responses: { ...ok(201, ref('Location'), { ...location, legCount: 0, ruleCount: 0 }, 'Đã tạo.'), ...errors([400, 401, 403, 409, 429, 500]) } },
  },
  '/api/v1/locations/{id}': {
    get: { ...common, operationId: 'getLocation', summary: 'Specialist/Coordinator/Manager: chi tiết địa điểm', parameters: [locationId],
      responses: { ...ok(200, ref('Location'), location), ...errors([400, 401, 403, 404, 429, 500]) } },
    put: { ...common, operationId: 'updateLocation', summary: 'Specialist: sửa địa điểm / ghim lại tọa độ', parameters: [locationId],
      description: 'Thay thế toàn bộ trường (tọa độ bắt buộc). Khóa dòng trong transaction, ghi audit giá trị cũ/mới (LOCATION/UPDATE). Đổi tọa độ thì xóa tuyến đã cache của địa điểm. 409 khi: trùng tên trong cùng quốc gia; đổi loại khi địa điểm đang nằm trong kế hoạch đã duyệt của đơn chưa kết thúc hoặc đang là cửa khẩu của quy định kiểm dịch.',
      requestBody: json('LocationInput', { ...input, latitude: 11.0758, longitude: 106.1612 }),
      responses: { ...ok(200, ref('Location'), { ...location, latitude: 11.0758, longitude: 106.1612 }), ...errors([400, 401, 403, 404, 409, 429, 500]) } },
    delete: { ...common, operationId: 'deleteLocation', summary: 'Specialist: xóa địa điểm chưa được dùng', parameters: [locationId],
      description: 'Chỉ xóa được khi `legCount` = 0 và `ruleCount` = 0; ngược lại 409. Tuyến cache đi kèm tự xóa. Ghi audit (LOCATION/DELETE).',
      responses: { 204: { description: 'Đã xóa.', headers: { 'X-Request-ID': requestIdHeader } }, ...errors([400, 401, 403, 404, 409, 429, 500]) } },
  },
};
