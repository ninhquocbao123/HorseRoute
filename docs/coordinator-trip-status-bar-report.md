# Báo cáo thanh trạng thái Coordinator

Ngày: 29/10/2026.

## Phạm vi và nguồn dữ liệu

Bổ sung card ngay dưới nút “Danh sách chuyến”, trước thông báo và workspace hai cột/tiêu đề “Thiết lập lộ trình vận chuyển”. Dùng `orderCode`, `orderStatus`, `planStatus` từ query chi tiết chuyến có sẵn (`GET /api/v1/trips/:id`). Không thêm request, API, bảng hoặc sửa payload, phân quyền hay quy tắc chuyển trạng thái.

## File tạo/chỉnh sửa

- `apps/web/src/modules/coordinator/pages/TripStatusBar.tsx`: card, icon, badge, skeleton, fallback và nhãn hỗ trợ đọc màn hình.
- `apps/web/src/modules/coordinator/pages/trip-status.ts`: ánh xạ và câu hướng dẫn.
- `apps/web/src/modules/coordinator/styles/trip-status.css`: màu, bố cục responsive, CSS scope Coordinator.
- `apps/web/src/modules/coordinator/pages/CoordinatorTripPage.tsx`: gắn card, skeleton lúc tải; giữ giao diện có dữ liệu cache khi refetch lỗi.
- `apps/web/src/modules/coordinator/pages/TripOrderSidebar.tsx`: bỏ badge trạng thái đơn trùng; giữ nguyên thông tin đơn.

## Ánh xạ

| Loại | Giá trị | Nhãn | Màu |
|---|---|---|---|
| Đơn | DRAFT | Bản nháp đơn | Xám xanh |
| Đơn | PENDING | Chờ tiếp nhận | Vàng cam |
| Đơn | NEED_INFO | Cần bổ sung | Cam |
| Đơn | REJECTED | Đã từ chối | Đỏ |
| Đơn | APPROVED | Đơn đã duyệt | Xanh lá nhạt |
| Đơn | PREPARING | Đang chuẩn bị | Xanh dương sáng |
| Đơn | READY | Sẵn sàng xuất phát | Xanh ngọc |
| Đơn | IN_TRANSIT | Đang vận chuyển | Xanh dương đậm |
| Đơn | DELIVERED | Đã giao | Xanh lá đậm |
| Đơn | CANCELLED | Đã hủy | Đỏ |
| Kế hoạch | DRAFT | Bản nháp | Xám xanh |
| Kế hoạch | PENDING_APPROVAL | Chờ duyệt | Vàng cam |
| Kế hoạch | APPROVED | Đã duyệt | Xanh lá |

Màu nền/chữ/viền theo bảng yêu cầu. Icon trang trí có aria-hidden; chữ luôn hiển thị. Hướng dẫn ưu tiên NEED_INFO/REJECTED/CANCELLED và trạng thái đang vận chuyển/hoàn thành, rồi trạng thái kế hoạch. Trạng thái chưa biết dùng nhãn “Chưa xác định” và hướng dẫn an toàn.

## Loading và lỗi

- Tải lần đầu: skeleton, không gán trạng thái mặc định.
- Thiếu trường trạng thái hoặc lỗi tải lại: “Chưa tải được trạng thái đơn.”
- Lỗi refetch khi đã có dữ liệu: giữ giao diện lập lộ trình với dữ liệu cache; thông báo thanh trạng thái thể hiện không tải được dữ liệu mới.
- Nếu lần đầu tải chi tiết thất bại và không có dữ liệu: giữ màn hình lỗi chi tiết hiện có, thêm thông báo trạng thái; không thể dựng form nghiệp vụ khi chưa có chuyến.
- Không thêm vòng lặp gọi API.

## Responsive

Desktop dùng flex với mã bên trái, các nhóm trạng thái bên phải. Dưới 992 px mã nằm hàng riêng; badge và nhóm tự xuống dòng, khoảng cách 8–16 px, không cố định chiều rộng. Chữ dài được wrap. Chưa xác minh bằng ảnh trình duyệt.

## Kiểm tra

- PASS: `pnpm --filter web lint` (script hiện là TypeScript `tsc --noEmit`).
- PASS: `pnpm --filter web build`; có cảnh báo bundle >500 kB, không làm build thất bại.
- PASS: kiểm tra trực tiếp 9 tổ hợp hướng dẫn (gồm trạng thái ưu tiên với kế hoạch chờ duyệt), 3 fallback, đủ 10 trạng thái đơn và 3 trạng thái kế hoạch; chờ duyệt dùng màu pending.
- NOT RUN: kiểm tra trực quan desktop/tablet/mobile và lỗi mạng thực tế. Công cụ trình duyệt không có tab/phiên ứng dụng đang mở. Không thay dữ liệu thật hoặc trạng thái đơn để dựng ảnh.

## Kiểm tra thủ công còn lại

Mở `/coordinator/trips/:id`, xác nhận card nằm ngay dưới nút quay lại, card đơn bên phải không còn badge trùng. Kiểm tra ở 1440/768/390 px, skeleton khi tải lần đầu và lỗi refetch khi đã tải thành công. Kiểm tra các tổ hợp trạng thái bằng dữ liệu kiểm thử; không đổi trạng thái đơn thật chỉ để kiểm tra UI.
