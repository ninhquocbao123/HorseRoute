# Flow 03 — Nghiệm thu Phần 5

Đã triển khai vòng gửi duyệt và duyệt/trả lại.

- Coordinator gửi `POST /trips/{tripId}/submit-plan` với body `{}` sau khi PUT lưu nháp thành công.
- Client chặn gửi nếu giờ đến không sau giờ đi; backend tiếp tục kiểm tra xe, trạng thái, lịch và điều kiện nghiệp vụ.
- Nếu PUT thành công nhưng submit thất bại, giao diện báo rõ bản nháp đã lưu và giữ ID chặng từ response.
- Manager thấy dialog duyệt/trả lại khi `PENDING_APPROVAL`; trả lại bắt buộc lý do đã trim, tối đa 255 ký tự.
- Sau review thành công, detail được cập nhật từ response và danh sách chuyến bị invalidate. Không có thao tác mở lại APPROVED.
- Pending khóa nút thao tác; Coordinator không duyệt, Manager không sửa kế hoạch.

Kiểm tra đạt: `pnpm --filter web lint`, `pnpm --filter web build`, `git diff --check`.

Phạm vi còn lại: phân công nhân sự ở Phần 6.
