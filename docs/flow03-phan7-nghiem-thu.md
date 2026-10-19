# Biên bản nghiệm thu Phần 7 — Kiểm tra điều kiện và xác nhận READY

Ngày kiểm tra: 19/10/2026

## Đã triển khai

- `getTripReadiness` và `useTripReadinessQuery` tải kết quả readiness theo trip ID.
- Tab READY phân biệt loading, lỗi, kết quả HTTP 200 và trạng thái đơn đã READY.
- Blocker được nhóm theo nhân sự, kế hoạch/phương tiện, hồ sơ/chứng từ và trạng thái khác.
- Manager có dialog xác nhận; request gửi `POST /orders/:orderId/mark-ready` với body `{}`. Coordinator không thấy nút này.
- Lỗi 409 thay danh sách blocker cũ và khóa xác nhận cho kết quả hiện tại; thành công đồng bộ detail, list và readiness query.
- Blocker chưa có API xử lý chỉ hiển thị hướng dẫn, không tạo nút thao tác giả. Chưa thêm link hồ sơ trực tiếp vì workspace hồ sơ chưa nhận `orderId` qua URL.

## Kiểm tra đã chạy

- `pnpm --filter web lint` — đạt.
- `pnpm --filter web build` — đạt.
- `git diff --check` — cần chạy cùng lần nghiệm thu cuối.

## Cách mở màn hình

Đăng nhập bằng Manager hoặc Coordinator, mở `/dashboard/trips/:tripId?tab=readiness`. Với Manager, nút xác nhận chỉ xuất hiện khi backend trả `eligibleForReady: true` và đơn chưa READY.

Kiểm thử backend thực tế cho các mã blocker, 409 và quyền tài khoản cần dữ liệu/API môi trường tương ứng; chưa tự đánh dấu thay cho kiểm thử tích hợp đó.
