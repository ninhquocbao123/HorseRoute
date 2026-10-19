# Flow 03 — Nghiệm thu Phần 4

Đã hoàn thành phần lập và lưu kế hoạch nháp.

- Form dùng React Hook Form + Zod, tải địa điểm/phương tiện từ `GET /trips/{tripId}/plan-options`.
- Chỉ Coordinator phụ trách chuyến DRAFT của đơn APPROVED/PREPARING được sửa; Manager luôn chỉ đọc.
- Payload PUT chỉ chứa `id` của chặng cũ và năm trường được backend cho phép; chặng mới chỉ thêm ở cuối, chặng đã lưu không có nút xóa.
- Kiểm tra 1–50 chặng, điểm đi/đến khác nhau, chặng sau nối chặng trước và thời gian nối tiếp. Lưu nháp cho phép giờ đến bằng giờ đi.
- `datetime-local` hiển thị theo Asia/Ho_Chi_Minh (UTC+07:00), chuyển payload thành ISO có offset UTC; response server được dùng làm baseline mới để nhận ID chặng.
- Dirty form có cảnh báo khi rời trang/back/hủy và beforeunload; refetch không ghi đè form đang dirty. Lỗi lưu, gồm 409, giữ nguyên dữ liệu nhập.

Kiểm tra đã đạt:

- [x] `pnpm --filter web lint`
- [x] `pnpm --filter web build`
- [x] `git diff --check`
- [x] Chỉ Coordinator được sửa; Manager chỉ đọc.
- [x] Không gửi trường `seqNo`, `status`, tên hiển thị hoặc thời gian thực tế.

Phạm vi còn lại của Phần 5: gửi kế hoạch duyệt và xử lý vòng DRAFT → PENDING_APPROVAL.
