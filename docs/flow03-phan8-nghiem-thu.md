# Biên bản nghiệm thu Phần 8 — Kiểm tra toàn luồng và hoàn thiện

Ngày rà soát: 19/10/2026

## Phạm vi đã rà soát

- Kiểm tra luồng trạng thái trong code: DRAFT → PENDING_APPROVAL → APPROVED → phân công → readiness → READY.
- Kiểm tra luồng trả lại: DRAFT có `returnReason`, chỉnh sửa và gửi lại; Manager duyệt/trả lại theo quyền.
- Kiểm tra readiness: 200 có blocker vẫn là kết quả hợp lệ, 409 thay blockers cũ, READY không hiện nút xác nhận lần hai.
- Kiểm tra guard MANAGER/COORDINATOR, trạng thái rỗng/lỗi/retry, query key theo ID, dirty guard và lỗi mutation.
- Kiểm tra CSS responsive theo container query, nội dung dài, tab URL, focus/role/label và dialog native.

## Kiểm tra đã chạy

- `pnpm --filter web lint` — đạt.
- `pnpm --filter web build` — đạt.
- `git diff --check` — đạt.
- Các file browser regression hiện có đã được rà lại để bảo đảm Flow 01/02 không bị thay đổi bởi module trips.

## Hạn chế môi trường

Browser integration test với Vite fixture chưa chạy được trong sandbox này vì tiến trình Vite không được phép bind cổng (`listen EPERM`). Vì vậy các kịch bản có backend giả lập, xoay thiết bị và zoom thực tế cần chạy lại ở máy phát triển/CI. Đây là bước kiểm thử môi trường, không phải lỗi TypeScript/build.

## Cách nghiệm thu thủ công

1. Đăng nhập Manager, mở một trip và thực hiện lần lượt lập kế hoạch, lưu, gửi duyệt, duyệt, phân công, mở tab READY và xác nhận READY.
2. Tạo/đổi một kế hoạch bị trả lại, kiểm tra lý do hiển thị rồi gửi lại.
3. Với readiness có blocker, xử lý blocker được backend hỗ trợ, bấm **Kiểm tra lại**; mô phỏng 409 để kiểm tra blockers mới thay blockers cũ.
4. Lặp lại bằng Coordinator để xác nhận chỉ xem được kết quả và không có nút xác nhận READY; kiểm tra mobile 320–390px, keyboard và dialog.
