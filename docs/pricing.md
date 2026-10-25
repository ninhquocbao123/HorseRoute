# Quản lý bảng giá

Manager mở **Quản lý bảng giá**, chọn phiên bản và tạo bản nháp từ phiên bản đó. Lưu bản nháp trước khi áp dụng. Bản đã áp dụng không sửa trực tiếp; tạo phiên bản khác để đổi giá. API trả 409 nếu có người lưu cùng bản nháp trước bạn.

## Đơn vị và cách tính

- Cước cơ bản: VND / xe / chuyến, theo hạng Light (2 ngựa), Medium (6 ngựa), Heavy (9 ngựa) và mốc quãng đường. Đến mốc đầu tiên dùng cước tối thiểu. Giữa hai mốc: giá mốc dưới + km vượt × (giá mốc trên − giá mốc dưới) / (km mốc trên − km mốc dưới). Đúng mốc giữ nguyên giá tại mốc; vượt mốc cuối cần báo giá riêng. Phần vượt hiển thị riêng với mã EXCESS_DISTANCE. Đơn giá/km giữ độ chính xác khi tính, thành tiền làm tròn đến đồng. Ví dụ Medium 238 km = 10.143.000 + 88 × 38.220 = 13.506.360 đ cước xe, chưa gồm nhiên liệu và dịch vụ.
- Nhân sự: số ngày dự kiến × giá tài xế và hộ tống / xe / ngày.
- Nhiên liệu và cầu đường: km thực tế / 100 × đơn giá / 100 km (làm tròn đến đồng).
- Cữ nước: số ngựa × số cữ dự kiến × giá / ngựa / cữ.
- Thức ăn, bảo hiểm và khoang mở rộng: số ngựa × giá gói / ngựa / chuyến.
- Thủ tục quốc tế: một khoản / chuyến. Kiểm dịch nội địa nằm trong cước cơ bản.
- Tổng dự toán cộng từng khoản một lần. Tiền đặt cọc là tỷ lệ của tổng; phần còn lại = tổng − cọc.

Giá ban đầu lấy từ HTML v7 do người dùng cung cấp, giữ nguyên mức tiền. Việc hiểu phí cữ nước là phí mỗi lần phục vụ đã được ghi rõ trên giao diện. Số ngày và số cữ cần xác nhận theo lộ trình khi báo giá chính thức. Bảng dự toán không thực hiện thanh toán.

## Phiên bản và thời gian

MySQL lưu `pricing_versions` và hàng khóa `pricing_publish_lock`. Chỉ bản PUBLISHED đã đến thời điểm hiệu lực được công khai. Dữ liệu API và database dùng UTC; màn hình hiển thị giờ Việt Nam, ô hẹn ngày dùng múi giờ thiết bị được ghi ngay bên cạnh.

Không cập nhật hay tính lại các đơn cũ khi áp dụng giá mới. Lịch sử cấu hình giá được giữ nguyên. Hệ thống hiện chưa có nghiệp vụ chốt báo giá tiền cho từng đơn; khi bổ sung phải lưu versionId, đầu vào và bản chụp từng khoản tiền, không đọc lại bảng giá mới để tính giá đã chốt.

## API

Public: GET `/api/v1/pricing/current`, POST `/api/v1/pricing/estimate`.

Chỉ Manager: GET/POST `/api/v1/manager/pricing`, PUT `/api/v1/manager/pricing/:id`, POST `/api/v1/manager/pricing/:id/publish`.

Bản nháp dùng revision để chống ghi đè. Các thao tác tạo, sửa và áp dụng ghi vào `audit_logs`. API dự toán không nhận giá tiền do client gửi; server tự lấy bảng giá hiện hành. Landing tải config từ API, dùng chung hàm tính với server. Khi Manager áp dụng giá, các tab cùng website trong trình duyệt nhận tín hiệu để tải lại bảng giá ngay; các trình duyệt khác làm mới khi focus hoặc mỗi 60 giây. Lưu bản nháp không thay đổi giá công khai; bản hẹn giờ chỉ xuất hiện sau thời điểm hiệu lực.

## Migration

`PricingVersions1800000007000` chỉ thêm bảng và seed ban đầu nếu chưa có phiên bản nào. Không sửa đơn, ngựa hay bảng vận chuyển. Script `apps/api/scripts/apply-pricing-migration.cjs` kiểm tra các migration chờ trước khi chạy; thêm `--apply` để áp dụng riêng thay đổi này.
