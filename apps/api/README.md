# API: chẩn đoán khởi động và HTTP

Chạy từ thư mục gốc repository: `pnpm dev:api`.

## Log khởi động

Log là JSON, mỗi dòng một sự kiện. `startup_step_started` và
`startup_step_completed` xác định các bước:

- `config`: đọc và kiểm tra biến môi trường.
- `mysql_config`: tạo cấu hình database, đọc file CA nếu bật SSL.
- `application`: tạo các thành phần Express và Redis.
- `mysql`: kết nối database.
- `redis`: kết nối Redis.
- `http`: mở cổng HTTP.
- `expiry_job`: lên lịch job hết hạn tài liệu.

`api_listening` xác nhận HTTP đã mở và job đã được lên lịch; không đảm bảo
lần chạy đầu tiên của job đã hoàn thành. Lỗi job được ghi bằng `expiry_job_failed`.

Ví dụ lỗi (rút gọn):

```json
{"event":"startup_failed","stage":"mysql_config","code":"ENOENT","message":"Không tìm thấy file; kiểm tra đường dẫn cấu hình và chứng chỉ SSL."}
```

| Mã lỗi | Kiểm tra |
| --- | --- |
| `INVALID_ENV` | Các tên biến trong `configFields`; không ghi giá trị của biến |
| `INVALID_SSL_CONFIG` | `DB_SSL` và đường dẫn tuyệt đối `DB_SSL_CA_PATH` |
| `ENOENT` ở `mysql_config` | File CA có tồn tại ở đường dẫn đã cấu hình không |
| `ECONNREFUSED` | Dịch vụ có chạy, địa chỉ/cổng có đúng không |
| `ER_ACCESS_DENIED_ERROR` | Tài khoản và quyền MySQL |
| `WRONGPASS` / `NOAUTH` | Cấu hình xác thực Redis |
| `EADDRINUSE` | Cổng HTTP đã bị chiếm |
| `UNKNOWN_ERROR` | Kiểm tra thành phần ở `stage`; thông điệp lỗi lạ không được ghi nguyên văn |

Không log nguyên đối tượng lỗi, stack, SQL, request body, token, mật khẩu hoặc
response của nhà cung cấp. Thông điệp chẩn đoán được ánh xạ từ mã lỗi;
muốn hỗ trợ một lỗi mới, bổ sung ánh xạ an toàn trong `logger.util.ts`.

## Request ID

Mỗi request được server cấp UUID mới, trả qua header `X-Request-ID`.
CORS cho phép frontend đọc header này. Không dùng lại ID client gửi lên.
Các response lỗi từ error middleware và rate limiter có thêm `requestId`;
các response thành công giữ nguyên body. Với response do handler tự tạo
(ví dụ health), dùng header để tra log.

`request_completed` ghi method, route template (không ghi giá trị tham số hay query),
status code và thời gian xử lý. `unmatched` nghĩa là chưa xác định được route,
ví dụ 404, lỗi JSON trước routing, hoặc bị chặn trước route handler.
Route template là đường dẫn trong router, ví dụ `/:id`, không phải URL đầy đủ.
`request_failed` liên kết lỗi 500 với cùng request ID.
Nếu client ngắt kết nối trước khi hoàn tất, log ghi `aborted: true` và mã quy ước
`499`; đây không phải HTTP response được gửi cho client.

## Shutdown

SIGINT/SIGTERM ngừng nhận kết nối mới và ngừng lên lịch job. API chờ HTTP
và job đang chạy, rồi ngắt Redis và MySQL. Mỗi lỗi cleanup được ghi riêng;
lỗi cleanup không thay thế lỗi khởi động ban đầu. Shutdown có giới hạn 15 giây,
sau đó tiến trình thoát với mã 1 và log `shutdown_timeout`.

## Kiểm tra

Chạy từ thư mục gốc:

```bash
pnpm --filter api lint
pnpm --filter api test
pnpm --filter api build
```

`lint` hiện là kiểm tra kiểu TypeScript. Bộ test không dùng database thật:
kiểm tra lỗi thiếu CA, mô phỏng Redis từ chối kết nối và lỗi cleanup, chiếm
cổng HTTP thực trên localhost, chờ job đang chạy, request ID và lọc log.
Test HTTP/lifecycle cần quyền mở cổng localhost. Các bài integration MySQL
`flow1.mysql.cjs` / `flow2.mysql.cjs` không nằm trong lệnh test mặc định.
