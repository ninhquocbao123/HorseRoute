# Flow 03 — Nghiệm thu Phần 6

Đã hoàn thành phân công nhân sự trên tab Nhân sự của chi tiết chuyến.

- `GET /assignment-options` tải các tài khoản DRIVER_ESCORT ACTIVE; options rỗng có hướng dẫn.
- `GET /assignments` tải danh sách hiện tại và `crewReadiness`.
- Coordinator có thể thêm, gỡ và đổi vai trò; PUT gửi toàn bộ danh sách mong muốn.
- Manager chỉ xem danh sách; backend tiếp tục kiểm tra quyền, trạng thái đơn và lịch sử vận hành.
- Client kiểm tra 2–100 người, userId không trùng và có DRIVER/ESCORT. Dialog xác nhận hiển thị số người bị gỡ trước khi lưu.
- Người bị khóa/mất điều kiện vẫn được giữ trong kết quả API và hiển thị blocker. `crewReadiness.complete` chỉ được trình bày là điều kiện nhân sự, không phải READY tổng thể và không xác nhận nhân sự rảnh lịch.

Kiểm tra đạt:

- [x] `pnpm --filter web lint`
- [x] `pnpm --filter web build`
- [x] `git diff --check`

Phạm vi tiếp theo: Phần 7 — kiểm tra readiness và xác nhận READY.
