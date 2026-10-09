# Dữ liệu mẫu WDP v2

`wdp_seed_v2.sql` bổ sung **191 bản ghi cho đủ 24 bảng** của file `wdp_schema_v2.sql` được cung cấp. Dữ liệu tiếng Việt, mốc kịch bản cố định ngày **08/10/2026**, DATETIME theo UTC. Khi chạy vào ngày khác, trạng thái lưu sẵn và cảnh báo tính theo ngày hiện tại có thể khác nhau.

## Cách nhập bằng MySQL Workbench

1. Chuẩn bị database `wdp` có đúng cấu trúc schema v2 và cả 24 bảng đều rỗng. Nếu đã tạo bảng thì không cần chạy lại schema. **File schema gốc có `DROP DATABASE` và sẽ xóa dữ liệu nếu chạy lại.**
2. Mở `database/wdp_seed_v2.sql` trong Workbench, dùng kết nối MySQL 8.0.16 trở lên có quyền INSERT, SELECT và CREATE ROUTINE / EXECUTE / ALTER ROUTINE.
3. Chạy toàn bộ file. Kết quả cuối: users = 10, orders = 10, horses = 11, documents = 33, trips = 5.

Seed dùng transaction, giữ nguyên kiểm tra khóa ngoại, không xóa hay ghi đè bản ghi. Nếu một bảng đã có dữ liệu, seed báo lỗi và không thêm dữ liệu. Chạy khi ứng dụng chưa ghi đồng thời vào database. Nếu Workbench dừng ở lỗi trước lệnh dọn procedure, sau khi xử lý nguyên nhân hãy chạy `DROP PROCEDURE IF EXISTS wdp.seed_wdp_v2_demo;` rồi thử lại; không xóa dữ liệu để ép chạy lại seed.

## Nội dung demo

- 10 người dùng: đủ 6 vai trò, trạng thái ACTIVE/PENDING/LOCKED. Email dùng miền `example.com`.
- 10 đơn: đủ DRAFT, PENDING, NEED_INFO, REJECTED, APPROVED, PREPARING, READY, IN_TRANSIT, DELIVERED, CANCELLED.
- 11 ngựa; đơn đã giao có 2 ngựa để thử danh sách nhiều ngựa.
- 33 checklist giấy tờ với đủ 5 trạng thái; 21 phiên bản upload gồm một giấy tờ có 2 phiên bản.
- 9 hồ sơ cơ quan với đủ 6 trạng thái; 5 chuyến, 6 chặng, 6 phân công.
- Nhật ký có bản đính chính; 3 loại sự cố với NEW/ACKNOWLEDGED/CLOSED; cảnh báo, thông báo và audit log.

Đây là dữ liệu giả lập. Quy định kiểm dịch không phải quy định pháp lý thực tế. Các mã `DEMO_*` trong system_parameters chỉ để thử bảng cấu hình, chưa ánh xạ các mã L/D/N/S/T vì schema không giải thích chúng.

`password_hash` là chuỗi vô hiệu có chủ đích, không có mật khẩu mẫu. Backend hiện dùng Firebase (`apps/api/src/modules/auth/auth.service.ts`); nhập SQL này không tạo tài khoản Firebase và không bảo đảm đăng nhập hay tương thích entity hiện tại của backend. Seed chỉ nhắm đến schema v2 được cung cấp.

27 attachment chỉ có metadata, đường dẫn `demo/...` chưa có tệp vật lý. Thông báo EMAIL/SMS chỉ là bản ghi, script không gửi thông báo.

## Kiểm tra đã thực hiện

Chạy bộ kiểm tra trong bộ nhớ bằng Node.js 24:

```powershell
node database/verify-seed.cjs 'D:\FPTU\Ky 8\WDP301\db\wdp_schema_v2.sql'
```

Đã kiểm tra 191 bản ghi, PK/UNIQUE/FK/CHECK/ENUM và 8 kiểm tra nhất quán nghiệp vụ bằng SQLite sau khi chuyển đổi cấu trúc MySQL. Đây không phải kiểm thử thực thi trên MySQL: môi trường hiện không có MySQL CLI và Docker daemon chưa chạy. Cú pháp stored procedure, quyền kết nối và hành vi transaction cần được xác nhận khi nhập trên MySQL.
