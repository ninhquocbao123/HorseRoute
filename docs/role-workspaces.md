> Tài liệu lịch sử. Cơ chế JWT và cấu trúc pages hiện tại được cập nhật tại [auth-pages-swagger.md](auth-pages-swagger.md).

# Giao diện sau đăng nhập

`/dashboard` hiển thị không gian theo vai trò từ tài khoản đã được backend xác minh. Menu dùng `?view=` để giữ màn hình khi tải lại. View không thuộc vai trò trở về Tổng quan; phân quyền API vẫn do backend đảm nhiệm.

| Vai trò | Khu vực |
| --- | --- |
| Manager | Tổng quan, yêu cầu vận chuyển, chuyến vận chuyển, tiến độ vận hành |
| Customer | Tổng quan, đơn của tôi, hồ sơ, theo dõi hành trình |
| Specialist | Tổng quan, hồ sơ & kiểm dịch, quy định, theo dõi phê duyệt |
| Coordinator | Tổng quan, chuyến vận chuyển, phương tiện, lộ trình & phân công |
| Driver / Escort | Tổng quan, chuyến của tôi, mốc hành trình, nhật ký ngựa |

Tất cả vai trò có thông báo, lọc chưa đọc, đánh dấu đã đọc, tài khoản, gửi email đổi mật khẩu và đăng xuất. Layout có sidebar desktop và menu thu gọn mobile. Không có nút giả đổi role trong bản production.

## Kết nối dữ liệu

- Thống kê đơn Customer/Manager lấy tổng số từ API orders theo quyền hiện tại. Các thẻ thống kê mở danh sách đơn; lọc trạng thái thực hiện trong danh sách.
- Màn hình đơn dùng lại OrdersWorkspace của Flow 1.
- Thông báo gọi API notifications. Không dùng dữ liệu nghiệp vụ mẫu.
- Hồ sơ, chuyến, phương tiện, lộ trình, nhật ký hiện là giao diện chờ kết nối: tiêu đề, bảng, trạng thái chưa khả dụng và hướng dẫn theo vai trò. **Chưa có form CRUD hoặc API cho các khu vực này.** Không được coi là đã hoàn tất nghiệp vụ Flow 2–4.

## Kiểm tra

- TypeScript frontend: đạt.
- `node apps/web/test/roles.render.cjs`: 35 kiểm tra render đạt. Dùng dịch vụ giả lập trong test, không truy cập Firebase/MySQL.
- Production Vite build: đạt.
- Chưa kiểm tra trực quan / tương tác trên trình duyệt trong lượt thay đổi này.

Chạy `pnpm dev:web`, đăng nhập tài khoản đúng vai trò và mở `/dashboard`. Cần backend đang chạy để tải số liệu và thông báo.

