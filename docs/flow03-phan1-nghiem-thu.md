# Flow 03 — Kết quả triển khai Phần 1

Ngày: 19/10/2026.

## Phạm vi đã làm

- Tạo module `apps/web/src/modules/trips` với TripListPage, TripDetailPage, TripPlanPage và CSS riêng dưới `.trip-workspace`.
- Tách DashboardShell dùng chung cho dashboard hiện tại và các route trips. Giữ nội dung OrdersWorkspace, DocumentsWorkspace, tài khoản, thông báo và cơ chế cảnh báo đơn chưa lưu.
- Thêm guard MANAGER/COORDINATOR dưới ProtectedRoute; các role khác về dashboard, chưa đăng nhập về login.
- Nối sidebar, các nút mở workspace ở trang tổng quan và chuyển hướng link cũ `/dashboard?view=trips` bằng replace.
- Bố cục linh hoạt: một cột trên vùng nội dung hẹp; hai cột ở chi tiết khi container đủ rộng; mobile menu dưới 768px; giới hạn chiều rộng vùng đọc; modal đăng xuất cuộn được trên màn hình thấp.
- Ba trang chỉ hiển thị tiêu đề và nội dung chờ triển khai. Chưa tải dữ liệu trips hoặc gửi thao tác ghi API.

## Cách mở để kiểm tra

Chạy frontend bằng `pnpm --filter web dev`, đăng nhập Manager hoặc Coordinator, chọn **Chuyến vận chuyển** ở sidebar.

| URL | Màn hình |
|---|---|
| `/dashboard/trips` | Danh sách chuyến chờ triển khai |
| `/dashboard/trips/200` | Khung chi tiết chuyến với ID trên URL |
| `/dashboard/trips/200/plan` | Khung lập kế hoạch |
| `/dashboard?view=trips` | Tự chuyển sang danh sách mới |

ID 200 chỉ là ví dụ để kiểm tra router. Phần 1 chưa xác minh chuyến có tồn tại hoặc thuộc Coordinator; việc này sẽ được backend kiểm tra khi nối API ở các phần sau. Link “Xem khu vực kế hoạch” chỉ mở trang placeholder, không cấp quyền sửa kế hoạch cho Manager.

## Kết quả kiểm tra

| Kiểm tra | Kết quả |
|---|---|
| `pnpm --filter web lint` | Đạt — TypeScript |
| `pnpm --filter web build` | Đạt — Vite production build |
| `git diff --check` | Đạt |
| Manager/Coordinator mở trực tiếp và reload cả ba URL | Đạt trên Chromium với Vite local |
| Link chi tiết → kế hoạch, Back trình duyệt và link về danh sách | Đạt |
| Sidebar, trang tổng quan và link cũ | Sidebar/link cũ kiểm tra trên trình duyệt; nút tổng quan dùng cùng hàm dashboardPath |
| CUSTOMER/SPECIALIST/DRIVER_ESCORT/ADMIN truy cập cả ba route | Đạt — chuyển về dashboard |
| Khách chưa đăng nhập truy cập cả ba route | Đạt — chuyển về login |
| Các trang ở 320, 375, 767, 768, 1024, 1440, 1920px | Đạt — không cuộn ngang toàn trang |
| Resize trang kế hoạch từ 320 đến 1920px, bước 40px | Đạt — không tràn ngang |
| Mobile mở menu, Escape đóng, chọn mục đóng menu | Đạt |
| Trang tài khoản, hủy đăng xuất, xác nhận đăng xuất | Đạt với Manager/Coordinator |
| Flow 01 của Manager/Customer và Flow 02 của Manager/Customer/Specialist | Đạt — render workspace với response rỗng giả lập |
| Form đơn chưa lưu → tài khoản → hủy | Đạt — giữ nguyên nội dung nhập |
| Form đơn chưa lưu → đăng xuất | Đạt — dialog cảnh báo chưa lưu |
| Form đơn chưa lưu → tổng quan → xác nhận bỏ thay đổi | Đạt |
| Dialog đăng xuất ở viewport ngang 844 × 390 | Đạt — nằm trong viewport, nút truy cập được |
| Kiểm tra hình ảnh chi tiết ở desktop 1440px và mobile 320px | Đạt — không chồng lấn, chữ/nút hiển thị rõ |

## Giới hạn của lượt kiểm tra

Các kiểm tra trình duyệt dùng response API giả lập cho xác thực và danh sách rỗng, không dùng tài khoản thật và không ghi dữ liệu backend. Đã kiểm tra cơ chế giao diện Flow 01/02 sau khi tách shell; chưa kiểm tra lại nghiệp vụ lưu/duyệt đơn hoặc upload tài liệu với backend thật.

Chưa kiểm tra zoom trình duyệt thực tế 200% và thiết bị di động thật; đã kiểm tra viewport hẹp, resize và màn hình ngang thấp. Deep link đã chạy trên Vite local; máy chủ triển khai production cần SPA fallback về index.html như yêu cầu vốn có của BrowserRouter.

Phần tiếp theo: **Phần 2 — Danh sách chuyến với dữ liệu thật**.
