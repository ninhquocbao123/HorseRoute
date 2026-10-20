import { tripPaths, tripSchemas, tripsTag } from './openapi.trips';
import { trackingPaths, trackingSchemas, trackingTag } from './openapi.tracking';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { loginSchema, registerSchema } from '../../features/auth/auth.validation';
import { draftOrderSchema, orderSchema, reviewSchema, orderQuerySchema, draftHorseSchema, horseSchema } from '../../features/orders/orders.validation';
import { documentReviewSchema, supplementSchema, dossierUpdateSchema } from '../../features/documents/documents.validation';
import { paginationSchema } from '../utils/pagination.util';

// Runtime schema conversion does not need recursive inference of every DTO union.
const toJsonSchema = zodToJsonSchema as (schema: unknown, options: Record<string, unknown>) => Record<string, any>;

const definitions = {
  LoginDto: loginSchema, RegisterDto: registerSchema, DraftHorseDto: draftHorseSchema, HorseDto: horseSchema,
  DraftOrderDto: draftOrderSchema, OrderDto: orderSchema, ReviewDto: reviewSchema, OrderQueryDto: orderQuerySchema,
  DocumentReviewDto: documentReviewSchema, SupplementDto: supplementSchema, DossierUpdateDto: dossierUpdateSchema,
  PaginationDto: paginationSchema,
};
const schemas: Record<string, any> = {};
for (const [name, schema] of Object.entries(definitions)) {
  const { $schema, ...definition } = toJsonSchema(schema, { target: 'openApi3', $refStrategy: 'none' });
  schemas[name] = definition;
}
schemas.DraftOrderDto.properties.horses.items = { $ref: '#/components/schemas/DraftHorseDto' };
schemas.OrderDto.properties.horses.items = { $ref: '#/components/schemas/HorseDto' };
Object.assign(schemas, tripSchemas, trackingSchemas);
schemas.Error = { type: 'object', properties: { statusCode: { type: 'integer' }, message: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] }, fields: { type: 'object', additionalProperties: { type: 'string' } }, requestId: { type: 'string', format: 'uuid' }, path: { type: 'string' }, timestamp: { type: 'string', format: 'date-time' } } };

const paths: Record<string, any> = {};
function route(method: string, path: string, summary: string, tag: string, options: {
  public?: boolean; body?: string; query?: z.AnyZodObject; status?: number; multipart?: any; binary?: boolean;
} = {}) {
  const parameters: any[] = [...path.matchAll(/\{(\w+)\}/g)].map(match => ({ name: match[1], in: 'path', required: true, schema: { type: 'string', pattern: '^[1-9]\\d{0,19}$' } }));
  if (options.query) {
    const schema = toJsonSchema(options.query, { target: 'openApi3', $refStrategy: 'none' });
    for (const [name, value] of Object.entries(schema.properties || {})) parameters.push({ name, in: 'query', required: false, schema: value });
  }
  const responses: Record<string, any> = {
    [options.status || 200]: { description: 'Thành công; giữ nguyên JSON của API hiện tại.', content: options.binary ? { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } : { 'application/json': { schema: {} } } },
  };
  for (const code of [400, 401, 403, 404, 409, 413, 429, 503]) responses[code] = { description: 'Lỗi yêu cầu hoặc dịch vụ', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } };
  const operation: any = { summary, tags: [tag], security: options.public ? [] : [{ bearer: [] }], parameters, responses };
  if (options.body || options.multipart) operation.requestBody = { required: true, content: options.multipart ? { 'multipart/form-data': { schema: options.multipart } } : { 'application/json': { schema: { $ref: '#/components/schemas/' + options.body } } } };
  (paths['/api/v1' + path] ||= {})[method] = operation;
}
route('post', '/auth/login', 'Đăng nhập bằng email và mật khẩu', 'Authentication', { public: true, body: 'LoginDto' });
route('post', '/auth/register', 'Đăng ký Customer: tên, email, số điện thoại, mật khẩu, địa chỉ', 'Authentication', { public: true, body: 'RegisterDto', status: 201 });
route('get', '/health', 'Kiểm tra kết nối MySQL', 'Health', { public: true });
route('get', '/users/me', 'Tài khoản hiện tại', 'Users');
route('get', '/users', 'Admin: danh sách người dùng', 'Users', { query: paginationSchema });
route('get', '/orders', 'Customer xem đơn của mình; Manager xem đơn đã gửi, theo nhóm và thứ tự tạo tăng dần', 'Flow 1 - Orders', { query: orderQuerySchema });
route('post', '/orders', 'Customer: lưu nháp, requestId chống tạo trùng', 'Flow 1 - Orders', { body: 'DraftOrderDto', status: 201 });
route('get', '/orders/{id}', 'Chi tiết đơn và lịch sử', 'Flow 1 - Orders');
route('delete', '/orders/{id}', 'Customer: xóa đơn DRAFT của chính mình; đơn đã gửi trả 409', 'Flow 1 - Orders');
route('put', '/orders/{id}', 'Customer: sửa đơn DRAFT hoặc NEED_INFO', 'Flow 1 - Orders', { body: 'DraftOrderDto' });
route('get', '/orders/{id}/review-options', 'Manager: điều phối viên và quy định phù hợp', 'Flow 1 - Orders');
route('post', '/orders/{id}/submit', 'Customer: gửi duyệt đơn hoàn chỉnh', 'Flow 1 - Orders', { status: 201 });
route('post', '/orders/{id}/review', 'Manager: duyệt, yêu cầu bổ sung hoặc từ chối', 'Flow 1 - Orders', { body: 'ReviewDto', status: 201 });
route('get', '/notifications', '100 thông báo mới nhất của mình', 'Notifications');
route('post', '/notifications/{id}/read', 'Đánh dấu thông báo của mình đã đọc', 'Notifications', { status: 201 });
route('get', '/documents/orders', 'Danh sách đơn có checklist', 'Flow 2 - Documents', { query: paginationSchema });
route('get', '/documents/orders/{orderId}', 'Checklist, phiên bản và hồ sơ cơ quan', 'Flow 2 - Documents');
route('post', '/documents/orders/{orderId}/items/{id}/upload', 'Customer: PDF/JPG/PNG tối đa 5 MB', 'Flow 2 - Documents', { status: 201, multipart: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } });
route('post', '/documents/orders/{orderId}/items/{id}/review', 'Specialist: thẩm định phiên bản mới nhất', 'Flow 2 - Documents', { body: 'DocumentReviewDto', status: 201 });
route('post', '/documents/orders/{orderId}/items/{id}/request', 'Specialist: yêu cầu bổ sung', 'Flow 2 - Documents', { body: 'SupplementDto', status: 201 });
route('post', '/documents/orders/{orderId}/dossiers/{id}', 'Specialist: cập nhật hồ sơ; APPROVED cần file giấy phép', 'Flow 2 - Documents', { status: 201, multipart: { ...schemas.DossierUpdateDto, properties: { ...schemas.DossierUpdateDto.properties, file: { type: 'string', format: 'binary' } } } });
route('get', '/documents/orders/{orderId}/files/{id}', 'Tải file sau khi kiểm tra quyền', 'Flow 2 - Documents', { binary: true });

Object.assign(paths, tripPaths, trackingPaths);

export const openApiDocument = {
  tags: [tripsTag, trackingTag],
  openapi: '3.0.3', info: { title: 'WDP Equine Transport API', version: '1.0', description: 'JWT/MySQL. Đăng nhập để lấy accessToken, sau đó dùng Authorize. Flow 1–2 đã có API. Flow 3 - Trips: ba API GET, PUT lưu kế hoạch nháp và POST submit-plan/review-plan và ba API phân công đã triển khai. Flow 4 - Tracking: chặng/mốc, nhật ký ngựa, sự cố, cảnh báo và tệp đính kèm đã triển khai (timeline Customer chưa có). Xem trạng thái từng operation trước khi dùng Execute.' },
  components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } }, schemas }, paths,
};
