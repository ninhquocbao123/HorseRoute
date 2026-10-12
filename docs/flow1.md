> Cập nhật: xác thực đã chuyển sang JWT/MySQL. Hướng dẫn Firebase bên dưới thuộc phiên bản trước; dùng [auth-pages-swagger.md](auth-pages-swagger.md) để chạy và đăng ký hiện tại.

# Flow 1 — Tạo và phê duyệt yêu cầu vận chuyển

## Phạm vi đã làm ở BE và FE

- Customer tạo bản nháp kể cả khi chưa nhập đủ địa chỉ/ngày/ngựa, mở lại và sửa trước khi gửi.
- Form ngựa gồm tên, định danh/hộ chiếu, giống, ngày sinh, giới tính, màu lông và ghi chú theo schema hiện có.
- Gửi duyệt kiểm tra dữ liệu ở server; lỗi trả theo đường dẫn trường, ví dụ `horses.0.passportNo`. Frontend hiển thị lỗi cạnh ô và giữ dữ liệu đã nhập.
- Gửi thành công chuyển sang PENDING, tạo thông báo trong app cho Manager ACTIVE, ghi audit.
- Customer chỉ xem/sửa/gửi đơn thuộc mình; Manager có danh sách phân trang, lọc trạng thái, tìm mã đơn, xem khách hàng, ngựa, trạng thái giấy tờ và lịch sử xử lý.
- Manager duyệt, từ chối hoặc yêu cầu bổ sung. Hai quyết định cuối bắt buộc lý do. Customer sửa đơn NEED_INFO rồi gửi lại. Chỉ PENDING được xét duyệt.
- Khi duyệt, Manager chọn Coordinator ACTIVE và quy định đúng cặp quốc gia. Phải chọn đủ quy định chung, chỉ một nhóm cửa khẩu. Không tự chọn nhân sự hoặc áp dụng quy định của nước khác.
- Duyệt tạo checklist riêng theo ngựa/loại giấy tờ, dossiers theo ngựa/cơ quan và một Trip DRAFT. Quy định trùng loại giấy tờ không tạo checklist trùng. Lựa chọn được ghi trong audit để Flow 2/3 tra cứu.
- Cập nhật trạng thái, checklist, hồ sơ, chuyến, thông báo và audit cùng transaction. Khóa hàng đơn chống duyệt/gửi đồng thời. POST tạo nháp có requestId chống tạo trùng khi retry; PUT nháp không thay đổi trạng thái trực tiếp.
- Ngựa đã có ID được giữ ID khi chỉnh sửa; không xóa dữ liệu liên quan để vượt khóa ngoại. Nếu bỏ ngựa có hồ sơ, server báo lỗi và rollback khi gửi.

## Chưa nằm trong phạm vi chốt của Flow 1

FR-ORD-12 (tự hủy sau D ngày), FR-ORD-13 (yêu cầu hủy sau duyệt) vẫn mang nhãn [X], chưa triển khai. FR-ORD-15 cập nhật theo hồ sơ/chuyến/chặng thuộc phần tích hợp Flow 2–4. Không tính on-time, gửi SMS/email, xử lý khẩn cấp Flow 5 hoặc nghiệm thu Flow 6.

Màn hình Flow 1 xem trạng thái giấy tờ đã có; tải file, thẩm định và cập nhật hồ sơ sẽ làm ở Flow 2. Không tuyên bố đã kiểm tra điều kiện kiểm dịch pháp lý. Bản nháp chưa gửi lưu ngựa trong JSON, chưa ghi các ngựa chưa hoàn chỉnh vào bảng horses.

## Cấu hình và migration

1. Dùng database `wdp` đúng schema v2, đã có người dùng và danh mục. Không chạy lại schema gốc có DROP DATABASE.
2. Đặt đúng DB_NAME/DB_HOST/DB_USER/DB_PASSWORD trong `.env` gốc. Giữ nguyên khóa Firebase ở backend.
3. Sao lưu trước khi thay cấu trúc, sau đó tại thư mục gốc:

```powershell
pnpm --filter @my-project/shared build
pnpm migration:run
```

Migration liên kết Firebase thêm `users.firebase_uid`. Migration OrderDrafts thêm `orders.draft_payload`, `client_request_id`, unique(customer_id, client_request_id) và cho phép NULL ở 5 trường địa chỉ/quốc gia/ngày khởi hành để lưu nháp. Không xóa dữ liệu. Không tự chạy migration trên `wdp` trong lần triển khai này.

4. Khởi động lại BE (`pnpm dev:api`) và FE (`pnpm dev:web`).
5. Tạo Firebase account cùng email đang có trong users, xác minh email, đăng nhập; tài khoản MySQL phải ACTIVE. Role lấy từ MySQL, không nhận role do trình duyệt/Firebase custom claim gửi lên.

## Kịch bản nghiệm thu

- Đăng nhập Customer, mở `/dashboard`, tạo đơn và lưu ngay khi còn trống. Mở lại, gửi → thấy lỗi ở từng ô.
- Nhập địa chỉ đi/đến, mã quốc gia 2 chữ cái, ngày tương lai, thêm ít nhất một ngựa có tên và hộ chiếu chưa dùng; lưu và gửi → Chờ duyệt.
- Dùng Manager khác phiên trình duyệt, lọc Chờ duyệt, mở đơn; yêu cầu bổ sung không có nội dung → bị chặn. Nhập nội dung → Customer thấy phản hồi.
- Customer sửa và gửi lại → Manager chọn Coordinator/quy định có cơ quan và danh sách giấy tờ, duyệt → xuất hiện checklist, dossiers và Trip DRAFT, Customer nhận thông báo.
- Với đơn PENDING khác, từ chối kèm lý do → REJECTED, không sinh Trip.
- Dùng Customer khác gọi URL/API đơn → 404; role không phù hợp → 403. Đơn APPROVED không còn nút sửa và API cũng từ chối.

## Kiểm thử tự động

- `node apps/api/test/workflow.test.cjs`: 9 kiểm thử đơn vị về quyền, khóa tài khoản, xác minh email, sở hữu, trạng thái, DTO và thông báo.
- `node apps/api/test/flow1.mysql.cjs`: tạo database ngẫu nhiên `wdp_flow1_test_*` trên MySQL local bằng thông tin kết nối `.env`, chạy migration và 13 kịch bản tích hợp, tự xóa database thử. Không đọc/ghi bảng nghiệp vụ của DB_NAME. Cần quyền CREATE/DROP DATABASE cho tài khoản kiểm thử.
- `apps/web/test/flow1.browser.cjs`: Playwright chạy Edge headless, dùng trang harness `/test/flow1.html` của Vite cổng 5179. API giả lập, chặn request ngoài localhost, không đăng nhập Firebase thật. Kiểm tra lưu nháp, lỗi từng trường, giữ dữ liệu khi mất mạng, thêm ngựa, Manager yêu cầu bổ sung và tràn ngang mobile.
- Backend/frontend TypeScript và frontend production build đã qua. Test MySQL đạt 13/13, unit test đạt 9/9.

Kiểm thử MySQL là service + database; kiểm thử trình duyệt dùng API giả lập. Chưa xác nhận end-to-end Firebase → API HTTP → MySQL trên tài khoản thực tế của người dùng.

