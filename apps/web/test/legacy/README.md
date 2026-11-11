# Test trình duyệt cũ (không còn chạy)

Các test ở đây dùng API giả (`page.route`) và giao diện của tháng 10/2026. Kiểm kê ngày 11/11/2026: cả 28 file `*.browser.cjs` đều hết thời gian chờ vì tìm nút, tiêu đề hoặc lớp CSS đã đổi (ví dụ nút "Tạo đơn +", tiêu đề "Xin chào, Khách kiểm tra."). `trips-list.browser.mjs` và `trips-detail.browser.mjs` còn trỏ cứng tới Playwright trên một máy Linux. CI không chạy thư mục này.

Luồng nghiệp vụ chính đã có test thay thế chạy trên API và MySQL thật: `apps/web/test/e2e/full-flow.e2e.cjs` (khách đăng ký, hồ sơ ngựa, đặt chuyến, quản lý tiếp nhận, chuyên viên duyệt giấy tờ, báo giá, đặt cọc, điều phối lập kế hoạch, quản lý duyệt, tài xế chạy, chặn giao khi còn nợ, khách trả nốt, giao ngựa).

Những phần các file này kiểm tra mà test E2E chưa phủ, nên viết lại khi cần: thông báo theo vai trò, lịch sử và sự cố của tài xế, khung hộ tống, rời trang khi đang sửa đơn, yêu cầu bổ sung giấy tờ, trang VNPay, thanh toán sandbox, màn vận hành.

Viết lại một file: chuyển ra `apps/web/test/`, sửa bộ chọn theo giao diện hiện tại, chạy được thì thêm vào `test:browser` trong `apps/web/package.json`. Các file `*-harness.tsx` và `*.html` được vite nạp theo đường dẫn `test/...` tính từ `apps/web`, nên cần sửa đường dẫn khi chuyển. Không có giá trị nữa thì xóa.

`roles.render.cjs` (render tĩnh mọi vai trò, không cần trình duyệt) cũng nằm ở đây: nó còn giả lập Firebase và khẳng định chuyên viên có màn "Thêm địa điểm", trong khi giao diện hiện tại không còn lối vào màn này (N2 trong báo cáo đánh giá). Viết lại sau khi sửa N2.
