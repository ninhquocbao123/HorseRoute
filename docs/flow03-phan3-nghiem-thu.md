# Flow 03 — Nghiệm thu Phần 3: Chi tiết chuyến chỉ đọc

Ngày kiểm tra: 19/10/2026.

## Kết luận

Trước lượt rà soát, mã nguồn đã có API/hook chi tiết, summary, timeline, badges và các tab nhưng còn thiếu kiểm tra ID đầy đủ, thông báo 400 riêng và liên kết accessibility của tab. Đã hoàn thiện các điểm này và kiểm tra đạt cả bốn mục checklist Phần 3.

## Chức năng đã đối chiếu/hoàn thiện

- getTripDetail gọi GET `/trips/{tripId}` qua Axios chung; useTripDetailQuery dùng query key theo accountId và tripId, truyền AbortSignal và không retry lỗi 4xx.
- Chặn ID không hợp lệ trước khi gọi API: số nguyên dương dạng chuỗi, không số 0 đầu, tối đa BIGINT UNSIGNED. Giữ nguyên ID lớn, không ép Number.
- Hiển thị riêng “Kế hoạch” và “Đơn”; DRAFT có returnReason hiển thị “Bản nháp · Cần chỉnh sửa” và banner lý do giữ xuống dòng.
- Tóm tắt hiển thị ID chuyến, mã đơn, ID người lập, thời gian dự kiến, ID người duyệt/thời điểm duyệt khi API có dữ liệu. Không suy đoán tên người từ ID.
- Timeline sắp theo seqNo, hiển thị tên điểm đi/đến, mã phương tiện, cảnh báo xe ngừng hoạt động, giờ dự kiến và trạng thái chặng. Không có chặng hiển thị empty state.
- Thời gian hiển thị UTC+07:00 và ghi rõ múi giờ. Nội dung dài tự xuống dòng, grid chi tiết không vượt vùng chứa ở màn hình nhỏ.
- Tab Kế hoạch có dữ liệu; Nhân sự và Điều kiện READY ghi rõ đang được chuẩn bị. Tab lưu trên URL, giữ sau refresh; giá trị không hợp lệ trở về plan mà vẫn giữ page/limit.
- Tab có ID/nhãn liên kết đúng với panel, điều khiển được bằng ArrowLeft/ArrowRight/Home/End và bàn phím Tab.
- Hiển thị lỗi riêng cho ID sai/400, 403, 404; lỗi mạng/5xx có nút thử lại. Khi lỗi không hiển thị chi tiết cũ; khi đổi ID chưa tải xong chỉ hiện skeleton của chuyến đang tải.
- Giữ phạm vi chỉ đọc: chưa có nút lưu/gửi/duyệt kế hoạch hoặc phân công/READY. Trang lập kế hoạch vẫn thuộc các phần triển khai tiếp theo.

## Kiểm tra đã đạt

- [x] Phân biệt planStatus và orderStatus; DRAFT có returnReason hiện “Cần chỉnh sửa”.
- [x] Chuyến chưa có chặng có empty state; ID/tên/thời gian lấy từ response; metadata duyệt hiển thị khi có dữ liệu.
- [x] ID sai không gọi API; xử lý HTTP 400/403/404/503 và lỗi mạng; thử lại thành công; chuyển ID ngay trong ứng dụng không hiện chuyến trước đó.
- [x] Tab được giữ sau refresh; tab sai trở về plan; nội dung dài không tràn ngang ở 320, 375, 768, 1024, 1440, 1920px.
- [x] `pnpm --filter web lint` và `pnpm --filter web build` đạt.
- [x] Bộ kiểm tra danh sách Phần 2 chạy lại đạt sau khi cập nhật fixture cho trang chi tiết thực tế.

Các script kiểm tra trình duyệt:

- `apps/web/test/trips-detail.browser.mjs`
- `apps/web/test/trips-list.browser.mjs`

Script dùng Playwright/Chromium, có thể trỏ runtime bằng PLAYWRIGHT_MODULE và BROWSER_EXECUTABLE; TRIPS_TEST_URL mặc định `http://127.0.0.1:5178`. Frontend phục vụ test dùng `VITE_API_URL=/api/v1`.

## Cách mở kiểm tra

Đăng nhập Manager/Coordinator, chọn một chuyến từ `/dashboard/trips`. Có thể mở trực tiếp `/dashboard/trips/{tripId}?tab=plan&page=2&limit=10` bằng ID thực tế. Kiểm tra ba tab, refresh và link về danh sách.

## Phạm vi bằng chứng

Các ca trình duyệt dùng API fixtures để kiểm tra dữ liệu biên, lỗi và responsive; không ghi dữ liệu backend. Mã ứng dụng gọi API thật, không chứa dữ liệu giả fallback. Lượt này chưa chạy end-to-end bằng tài khoản thật trên database nghiệp vụ; backend không thay đổi. Không đánh dấu các phần lập kế hoạch, nhân sự hoặc READY đã hoàn thành.
