# VNPAY Sandbox cho dự án

Đây là tích hợp với cổng thử nghiệm chính thức VNPAY, không thu tiền thật.

1. Đăng ký thông tin kết nối tại https://sandbox.vnpayment.vn/devreg/ .
2. Sao chép các biến trong `apps/api/.env.vnpay.example` vào `apps/api/.env`. Điền TmnCode và HashSecret nhận từ VNPAY; không đưa HashSecret vào frontend hoặc Git.
3. Đặt `VNPAY_RETURN_URL` thành địa chỉ frontend thật + `/payments/vnpay/return`.
4. Đăng ký IPN URL với VNPAY: `https://<API công khai>/api/v1/payments/vnpay/ipn`. API localhost không nhận được IPN từ VNPAY; cần triển khai hoặc một đường hầm HTTPS do bạn quản lý.
5. Khởi động lại backend. Trong Đơn của tôi, chọn Đặt cọc hoặc Thanh toán phần còn lại → Tiếp tục đến VNPAY Sandbox.
6. Chọn phương thức và dùng thông tin thanh toán thử nghiệm do VNPAY cung cấp trên tài liệu Sandbox.

Trang Return chỉ đọc trạng thái từ backend. Không lấy tham số `vnp_ResponseCode` trên trình duyệt làm bằng chứng thanh toán. Chỉ IPN có chữ ký đúng và đúng số tiền mới ghi nhận khoản thu. IPN gửi lại không ghi nhận lần hai. Nếu trang báo đang chờ xác nhận, kiểm tra cấu hình/khả năng truy cập IPN; không tự chuyển thành thành công.

Tài liệu: https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html

Kiểm thử cục bộ: `node apps/api/test/vnpay.mysql.cjs` (dùng database thử nghiệm riêng). Kiểm thử này dùng khóa giả, không chứng minh tài khoản merchant đã kết nối thành công với VNPAY. Sau khi cấu hình cần chạy một lượt Sandbox trên cổng chính thức.
