# Manager: Figma M1–M3

Mẫu: Figma file `XvYelFeTRkb5CFamqUHNak`, M1 `57-3173`, M2 Duyệt giá vận chuyển, M3 `57-3588`. Dùng font Be Vietnam Pro, tiêu đề ExtraBold 28px, sidebar 264px; nội dung liền sidebar, co giãn theo màn hình; nội dung dùng dữ liệu thật nên số liệu và độ dài khác dữ liệu minh họa trong Figma.

- `/dashboard?view=orders`: tiếp nhận, lọc/tìm mã đơn hoặc khách, xem chi tiết, từ chối/yêu cầu bổ sung, duyệt với điều phối viên và quy tắc kiểm dịch. Thiết lập duyệt mở trong hộp thoại để giữ bố cục M1.
- `/dashboard?view=quotes`: chọn đơn đã duyệt, lập dự toán, điều chỉnh có lý do, nhập VAT; duyệt trực tiếp hoặc lưu nháp trong hộp thoại thiết lập chuyến; có thể yêu cầu lập lại. Giá trị và số ngựa kiểm tra trên server, không nhận thành tiền từ trình duyệt.
- `/dashboard?view=revenue`: tháng/năm, doanh thu, cơ cấu, tuyến và lịch sử; xuất CSV UTF-8 mở bằng Excel.
- Menu Manager chỉ gồm tiếp nhận đơn, duyệt giá, doanh thu và bảng giá; đã bỏ menu cài đặt dẫn tới các màn hình cũ. Các đường dẫn hồ sơ, chuyến và giám sát cũ của Manager quay về tiếp nhận đơn. Màn hình chuyến vẫn dành cho Điều phối viên. Phiên bản bảng giá đã áp dụng không sửa trực tiếp.

## Database đã bổ sung

Migration `ManagerQuotes1800000008000` chỉ thêm bảng; không sửa/xóa đơn cũ hoặc tạo dữ liệu tài chính giả.

`order_quotes`: FK đơn và phiên bản bảng giá, đầu vào JSON, hạng mục JSON, tạm tính, điều chỉnh/lý do, VAT, tổng tiền, cọc/tỷ lệ, hiệu lực, trạng thái DRAFT/APPROVED/NEED_REVISION, revision, người tạo/duyệt và thời gian. Mỗi dự toán là một bản lưu mới. Một đơn chỉ duyệt một báo giá chính thức; khóa đơn trong transaction ngăn hai lần duyệt đồng thời. Báo giá chính thức giữ nguyên khi đổi bảng giá chung. Yêu cầu điều chỉnh đóng dự toán cũ, lập dự toán mới theo bảng giá đang hiệu lực.

`order_receipts`: FK đơn/báo giá, số tiền đã nhận, mã chứng từ duy nhất, thời điểm nhận, người ghi sổ và thời điểm tạo. Chỉ Manager ghi sổ sau khi đã nhận tiền; không có chức năng chuyển tiền. Không cho thu quá tổng báo giá, ghi trùng chứng từ hoặc thu trên báo giá chưa duyệt. Khóa đơn và đọc khoản thu có khóa chống ghi đồng thời vượt số còn thiếu. Chưa triển khai hoàn tiền/hủy chứng từ hay sửa giá đã duyệt.

Audit ghi CREATE/APPROVED/NEED_REVISION/RECEIPT. Duyệt giá gửi thông báo trong ứng dụng cho chủ đơn; Customer xem các hạng mục, tổng/cọc, thời hạn và số tiền đã thu trong chi tiết đơn. Không gửi email/SMS.

Doanh thu chỉ tính đơn DELIVERED và tổng khoản thu >= tổng báo giá. Kỳ ghi nhận là thời điểm muộn hơn giữa log chuyển DELIVERED và khoản thu cuối cùng, quy đổi UTC+7. Đơn cũ thiếu log bàn giao dùng ngày khoản thu cuối cùng; không suy đoán giá/thu tiền cho dữ liệu cũ. VAT do Manager nhập, mặc định 0%; cần chọn mức áp dụng phù hợp nghiệp vụ. Chưa có phân tách nhiều xe cho đơn >9 ngựa; cần báo giá riêng.

## API

Manager only: GET `/manager/overview`, GET `/manager/quote-orders`, GET/POST `/manager/orders/:id/quotes`, POST `/manager/quotes/:id/review`, POST `/manager/quotes/:id/receipts`, GET `/manager/revenue?year=&month=`. GET `/orders/:id/quote` kiểm tra quyền sở hữu Customer hoặc Manager. Swagger có DTO và routes.

## Kiểm tra

- `apps/api/test/manager.mysql.cjs`: schema thử nghiệm ngẫu nhiên, migration lặp lại, phân quyền, tính giá server, kiểm tra đơn/số ngựa/tuyến, duyệt đồng thời, thu đồng thời, chống thu dư/trùng, quyền Customer, thông báo, doanh thu.
- `apps/web/test/manager.browser.cjs`: Edge với API giả lập; font/cỡ sidebar, duyệt đơn, tạo/duyệt giá, xuất báo cáo, màn hình nhỏ. Ảnh `apps/web/test-results/manager-*-figma.png` dùng dữ liệu minh họa.
- `apps/api/scripts/verify-manager-live.cjs`: đọc API thật qua MySQL; không tạo báo giá hoặc khoản thu trên database thật.
