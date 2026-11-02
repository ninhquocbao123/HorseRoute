# 02 — Kiến trúc thông tin và danh sách màn hình

Ngày lập: 29/10/2026. Dựa trên `00-context.md` và `01-data-inventory.md` (kể cả 5 quyết định của Long ở cuối file 01).

Tổng số: **Chung 12 màn, Khách hàng 16 màn, Tài xế 12 màn, Hộ tống 9 màn** (49 màn; 35 màn P0). Mã màn dùng xuyên suốt các giai đoạn sau.

## 1. Phần chung

### 1.1 Xác định vai trò

Sau đăng nhập, `GET /users/me` trả `role`:

- `CUSTOMER` → bộ tab Khách hàng.
- `DRIVER_ESCORT` → `GET /tracking/driver/trips`; chuyến đang chạy hoặc gần nhất có `crewRole = DRIVER` → bộ tab Tài xế, `ESCORT` → bộ tab Hộ tống. Không có chuyến thì lấy `crew_profiles.crew_type` (**CẦN XÁC NHẬN** API nào trả trường này; hiện `/users/me` không trả). Nếu cùng lúc có chuyến ở cả hai vai trò, hiện công tắc vai trò trong COM-10.
- Role khác → COM-05.

### 1.2 Bảng màn chung

| Mã | Tên | Mục đích | Hành động chính | Dữ liệu hiển thị | Dữ liệu nhập | Endpoint | Trình bày | Offline | Ưu tiên |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| COM-01 | Khởi động | Kiểm tra token, chọn bộ tab | (tự động) | logo | | `/users/me` | màn đầy đủ | dùng phiên đã lưu | P0 |
| COM-02 | Đăng nhập | Vào app | Đăng nhập | | email, mật khẩu | `POST /auth/login` | màn đầy đủ | không | P0 |
| COM-03 | Tạo tài khoản khách hàng | Đăng ký | Tạo tài khoản | | họ tên, email, SĐT, địa chỉ, loại khách, tên CLB, mật khẩu | `POST /auth/register` | màn đầy đủ | không | P1 |
| COM-04 | Quên mật khẩu | Hướng dẫn lấy lại | Gọi hotline | hotline | | không có API (khoảng trống) | màn đầy đủ | có | P1 |
| COM-05 | Vai trò không dùng app | Báo dùng web | Mở web | vai trò | | | màn đầy đủ | có | P0 |
| COM-06 | Giải thích quyền thông báo | Xin quyền push | Cho phép thông báo | lợi ích theo vai trò | | FCM (G1) | màn đầy đủ | có | P0 |
| COM-07 | Giải thích quyền vị trí nền | Xin "Luôn cho phép" (tài xế) | Cho phép vị trí | lý do, ai xem được | | | màn đầy đủ | có | P0 |
| COM-08 | Giải thích quyền camera | Xin camera khi chụp lần đầu | Cho phép camera | | | | bottom sheet | có | P1 |
| COM-09 | Thông báo | Xem và mở thông báo | Mở thông báo | content, thời gian, đã đọc | | `GET /notifications`, `POST /:id/read` | màn đầy đủ (tab) | xem cache | P0 |
| COM-10 | Tài khoản | Hồ sơ, giao diện, đăng xuất | Đăng xuất | họ tên, email, SĐT, ảnh, hotline | sáng/tối, cỡ chữ | `/users/me`, `/me/avatar` | màn đầy đủ (tab) | xem cache | P0 |
| COM-11 | Đổi mật khẩu | | Lưu mật khẩu mới | | mật khẩu cũ, mới | `POST /users/me/password` | màn đẩy | không | P1 |
| COM-12 | Hàng chờ đồng bộ | Xem các mục chưa gửi | Gửi lại ngay | loại, giờ tạo, lỗi | | các API trong hàng chờ | bottom sheet | có | P0 |

Trạng thái offline toàn cục: thanh mảnh dưới header "Đang offline · 3 mục chờ gửi" (chạm mở COM-12); tài xế thêm chỉ báo GPS (đang chia sẻ / tạm dừng / tắt).

## 2. Khách hàng (CUS)

### 2.1 Persona

Anh Minh Anh, 38 tuổi, quản lý CLB đua ngựa ở TP.HCM, có 6 ngựa. Mở app buổi tối hoặc khi có thông báo, để xem đơn đã tới đâu và ngựa có ổn không. Lo nhất: ngựa gặp vấn đề sức khỏe trên đường mà không ai báo, và chi phí phát sinh không rõ.

### 2.2 Ba việc quan trọng nhất

1. Biết ngựa đang ở đâu trên hành trình và có khỏe không.
2. Gửi yêu cầu vận chuyển cho ngựa đã có hồ sơ, không phải nhập lại.
3. Biết đơn đang chờ mình làm gì (bổ sung, giấy tờ, đặt cọc) và tổng chi phí.

### 2.3 Tab bar

| Tab | Icon (Lucide) | Lý do |
| --- | --- | --- |
| Hành trình | `route` | Việc số 1: theo dõi chuyến đang chạy và việc cần làm |
| Đơn hàng | `clipboard-list` | Mọi đơn, mọi trạng thái, có nút tạo yêu cầu |
| Ngựa | `horse` không có trong Lucide → dùng `paw-print` (**CẦN XÁC NHẬN**, hoặc vẽ icon riêng cùng nét) | Hồ sơ ngựa dùng lại khi đặt |
| Tài khoản | `user-round` | COM-10 |

Thông báo mở từ chuông trên header (có số chưa đọc), không chiếm tab.

### 2.4 Bảng màn

| Mã | Tên | Mục đích | Hành động chính | Dữ liệu hiển thị | Nhập | Endpoint | Trình bày | Offline | Ưu tiên |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CUS-01 | Hành trình (trang chủ) | Thấy chuyến đang chạy và việc cần làm | Mở chuyến đang chạy | order_code, status, horse_names, latestMilestone, điểm dừng kế tiếp, giờ dự kiến; danh sách việc: NEED_INFO, missing_documents, chờ cọc (quote_total, paid) | | `/orders/customer-workspace`, `/tracking/orders/:id/timeline` | màn tab | cache | P0 |
| CUS-02 | Đơn hàng | Danh sách đơn | Tạo yêu cầu vận chuyển | order_code, status, tuyến, desired_departure_date, horse_count, quote_total | lọc: Đang xử lý / Đang chạy / Đã xong / Đã đóng | `/orders/customer-workspace` | màn tab | cache | P0 |
| CUS-03 | Chi tiết đơn | Toàn cảnh 1 đơn | Hành động theo trạng thái (Sửa và gửi lại / Xem báo giá / Theo dõi) | trạng thái + lý do (manager_note), tuyến, ngày, ngựa, giấy tờ thiếu, tóm tắt báo giá | | `/orders/:id`, `/quote`, `/documents/orders/:id` | màn đẩy | cache | P0 |
| CUS-04 | Báo giá và thanh toán | Minh bạch chi phí | Thanh toán cọc (mở web) | items, adjustment + lý do, VAT, total, deposit, paid, còn lại, expires_at, receipts | | `/orders/:id/quote`, `/payments/orders/:id` | màn đẩy | cache | P0 |
| CUS-05 | Theo dõi hành trình | Ngựa đang ở đâu | Gọi điều phối (**CẦN XÁC NHẬN** khách có được thấy số điều phối) | bản đồ vị trí ước tính + nhãn "Ước tính theo mốc", điểm dừng, mốc + giờ, isOverdue, remainingKm, báo cáo sức khỏe mới nhất | | `/tracking/orders/:id/map`, `/timeline`, `/horse-reports` | màn đẩy | cache | P0 |
| CUS-06 | Báo cáo sức khỏe | Đọc 1 báo cáo | Đã xem (tự đánh dấu) | horseName, tình trạng, nhiệt độ, nhịp tim, ăn uống, customerNote, ảnh, escortName, sentAt | | `/horse-reports`, `/view`, `/attachments/:id` | màn đẩy | cache | P0 |
| CUS-07 | Nhật ký chăm sóc | Xem cho ăn/uống/nghỉ | | activityType, horseName, lượng, performedAt, summary | | `/tracking/orders/:id/care-activities` | màn đẩy | cache | P1 |
| CUS-08 | Ngựa | Danh sách hồ sơ ngựa | Thêm ngựa | ảnh, name, breed, tuổi, sex, đơn đang tham gia | | `/customer/profiles` | màn tab | cache | P0 |
| CUS-09 | Hồ sơ ngựa | Chi tiết 1 ngựa | Đặt vận chuyển cho ngựa này | toàn bộ profile, ảnh, giấy tờ đã gắn | | `/customer/profiles`, `/files/:id` | màn đẩy | cache | P0 |
| CUS-10 | Thêm/sửa hồ sơ ngựa | | Lưu hồ sơ | | name, passportNo, breed, birthDate, sex, coatColor, microchip, weightKg, heightCm, feed, note, ảnh | `POST/PUT /customer/profiles`, `/files` | màn đẩy | không | P0 |
| CUS-11 | Yêu cầu · 1 Chọn ngựa | | Tiếp tục | hồ sơ ngựa (ngựa đang bận bị khóa, nêu đơn) | chọn ≥1 | `/customer/profiles` | màn đẩy (stepper 4 bước) | không | P0 |
| CUS-12 | Yêu cầu · 2 Tuyến và ngày | | Tiếp tục | km ước tính | điểm đi, nước đi, điểm đến, nước đến, ngày khởi hành | `/customer/route-distance` | màn đẩy | không | P0 |
| CUS-13 | Yêu cầu · 3 Ghi chú | | Tiếp tục | | yêu cầu đặc biệt (≤5000) | | màn đẩy | không | P0 |
| CUS-14 | Yêu cầu · 4 Xem lại | Kiểm tra trước khi gửi | Gửi yêu cầu | tóm tắt 3 bước | | `POST /orders` (requestId) → `/submit` | màn đẩy | không | P0 |
| CUS-15 | Đã gửi yêu cầu | Xác nhận | Xem đơn | order_code, "Chờ duyệt", bước tiếp theo | | | màn đầy đủ | | P0 |
| CUS-16 | Giấy tờ của đơn | Trạng thái giấy tờ theo ngựa | Tải giấy tờ trên web | loại giấy, status, expiry_date, invalid_reason | | `/documents/orders/:id` | màn đẩy | cache | P1 |

Ghi chú: yêu cầu đơn giản không gửi `booking` (trường này tùy chọn trong `orderSchema`). Khoảng trống: không gửi được người nhận (`recipient_name/phone`) nếu bỏ booking; đề xuất cho phép `booking.recipient` riêng, hoặc ghi vào yêu cầu đặc biệt.

### 2.5 Ý tưởng cho màn quan trọng nhất: CUS-05 Theo dõi hành trình

**Hướng A — Bản đồ ở trên, timeline ở bottom sheet kéo được.** Bản đồ chiếm 55% màn, xe ở vị trí ước tính, sheet chứa điểm dừng và thẻ báo cáo sức khỏe.
- Ưu: quen thuộc như app giao hàng, cảm giác "đang sống".
- Nhược: vị trí chỉ là ước tính (đứng yên ở điểm xuất phát chặng), bản đồ to dễ khiến khách nghĩ là GPS thật và thắc mắc vì sao xe không chạy.

**Hướng B — Timeline là chính, bản đồ là thẻ nhỏ.** Trên cùng là thẻ trạng thái lớn ("Đang trên đường đến Cửa khẩu Mộc Bài · dự kiến 10:40"), dưới là timeline điểm dừng có giờ kế hoạch/thực tế, xen thẻ báo cáo sức khỏe đúng thời điểm; bản đồ là thẻ cao 160pt, chạm để mở toàn màn.
- Ưu: trung thực với dữ liệu (mốc là thật, vị trí là ước tính); đọc nhanh; báo cáo sức khỏe nằm đúng dòng thời gian, đúng nỗi lo của khách.
- Nhược: ít "wow" hơn.

**Khuyến nghị: B.** Dữ liệu thật là mốc, không phải GPS, và Long đã chọn giữ vị trí ước tính.

### 2.6 Ý tưởng khác

- CUS-01: không chào hỏi, không banner quảng cáo. Thẻ chuyến đang chạy (gradient teal duy nhất được phép) + danh sách "Cần bạn xử lý" dạng list gọn.
- CUS-04: bảng chi phí như hóa đơn, số canh phải, đơn vị ₫; dòng "Đã thanh toán" và "Còn lại" đậm; hạn báo giá đếm ngược nếu < 48 giờ.
- Tạo yêu cầu 4 bước có thanh tiến độ, giữ nháp khi thoát (dùng `POST /orders` lưu nháp ở bước 1).

## 3. Tài xế (DRV)

### 3.1 Persona

Anh Hùng, 45 tuổi, lái xe tải chở ngựa 12 năm. Cầm máy khi dừng đèn đỏ, ở trạm nghỉ hoặc cửa khẩu; tay có thể đeo găng, nắng chói; sóng yếu ở vùng biên. Lo nhất: quên ghi mốc làm điều phối gọi hỏi liên tục, và gặp sự cố mà không biết báo ai.

### 3.2 Ba việc quan trọng nhất

1. Ghi mốc tại mỗi điểm dừng bằng một chạm (kể cả khi mất sóng).
2. Biết điểm kế tiếp, giờ phải tới, người nhận.
3. Báo sự cố nhanh, kèm ảnh, kể cả offline.

### 3.3 Tab bar

| Tab | Icon | Lý do |
| --- | --- | --- |
| Chuyến | `truck` | Màn làm việc chính |
| Sự cố | `triangle-alert` | Báo và theo dõi sự cố; nút báo luôn ở 1 chạm |
| Thông báo | `bell` | Cảnh báo từ điều phối quan trọng với tài xế |
| Tài khoản | `user-round` | |

### 3.4 Bảng màn

| Mã | Tên | Mục đích | Hành động chính | Dữ liệu hiển thị | Nhập | Endpoint | Trình bày | Offline | Ưu tiên |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DRV-01 | Chuyến của tôi | Chọn chuyến | Mở chuyến đang chạy/sắp tới | orderCode, orderStatus, plannedDepartureAt, điểm đầu/cuối, số ngựa | | `/tracking/driver/trips` | màn tab | cache | P0 |
| DRV-02 | Chuyến hôm nay | Làm việc trong chuyến | **Nút ngữ cảnh lớn**: Kiểm tra trước chuyến → Bắt đầu chuyến → Đã đến [điểm] → Rời [điểm] → Đã thông quan → Xác nhận đã giao | điểm kế tiếp + giờ kế hoạch + trễ/đúng giờ, timeline điểm dừng, số ngựa, xe, người nhận, điều phối, hotline, chỉ báo GPS/đồng bộ | | `/tracking/trips/:id`, `/milestones`, `/complete` | màn đẩy | **có** | P0 |
| DRV-03 | Kiểm tra trước chuyến | 5 mục an toàn | Xong, sẵn sàng khởi hành | 5 mục `PRE_DEPARTURE_CHECKS` | tick từng mục hoặc nút "Đã kiểm tra tất cả" | lưu máy (G6) | màn đẩy | có | P0 |
| DRV-04 | Xác nhận mốc | Tránh bấm nhầm | Mốc tại điểm dừng (đến/rời): ghi ngay, hiện thanh "Hoàn tác" 5 giây. Thông quan, Đã giao: hộp xác nhận | tên mốc, điểm, giờ hiện tại (sửa được trong 24 giờ) | giờ (tùy chọn) | `/milestones`, `/complete` | thanh hoàn tác / bottom sheet | có (vào hàng chờ) | P0 |
| DRV-05 | Bản đồ chuyến | Xem tuyến và vị trí | Mở chỉ đường (Google Maps) | tuyến, vị trí thật, điểm dừng | | `/trips/:id/map`, `/positions` | màn đẩy | tile cache **CẦN XÁC NHẬN** || P0 |
| DRV-06 | Báo sự cố · 1 Loại và mức độ | | Tiếp tục | 3 loại, 3 mức (nhãn + mô tả, không chỉ màu) | loại, mức | | màn đẩy (modal toàn màn) | có | P0 |
| DRV-07 | Báo sự cố · 2 Chi tiết | | Gửi báo cáo | vị trí tự lấy | loại con (chip), hư hại (chip), ngựa (chip, bắt buộc nếu Y tế), mô tả (≥5 ký tự, có nút đọc giọng nói), ≤3 ảnh có nhãn | `POST /trips/:id/incidents` | màn đẩy | có (hàng chờ) | P0 |
| DRV-08 | Đã gửi / chờ gửi | Xác nhận | Gọi điều phối | trạng thái gửi, mã sự cố, hotline | | | màn đầy đủ | có | P0 |
| DRV-09 | Sự cố của chuyến | Theo dõi xử lý | Báo sự cố mới | type, severity, status (Mới/Đã tiếp nhận/Đã đóng), handlingNote | | `GET /trips/:id/incidents` | màn tab | cache || P0 |
| DRV-10 | Ngựa và giao nhận | Biết chở gì, giao ai | Gọi người nhận | horses (name, passportNo, breed), recipient, customer.name | | `/tracking/trips/:id` | màn đẩy | cache | P1 |
| DRV-11 | Lịch sử chuyến | Chuyến đã xong | | orderCode, tuyến, ngày giao | | `/tracking/driver/trips` | màn đẩy | cache | P1 |
| DRV-12 | Cảnh báo từ điều phối | Đọc cảnh báo | Đã hiểu | alertType, content, sentByName, sentAt | | `/trips/:id/alerts`, socket `tracking:alert` | bottom sheet tự bật | cache | P1 |
| DRV-13 | Hoàn tất chuyến | Kết thúc rõ ràng sau "Xác nhận đã giao" | Về danh sách chuyến | mã đơn, giờ giao, số ngựa, người nhận, số mốc/sự cố, "GPS đã tắt", mục còn chờ gửi | | `/complete` | màn đầy đủ | có | P0 |

### 3.5 Ý tưởng cho màn quan trọng nhất: DRV-02 Chuyến hôm nay

**Hướng A — Một nút lớn theo ngữ cảnh.** Nửa trên: tên điểm kế tiếp cỡ lớn, giờ phải tới, khoảng cách; nửa dưới cố định một nút cao 64pt đổi nhãn theo trạng thái; timeline điểm dừng cuộn ở giữa; nút "Báo sự cố" là nút phụ cố định góc dưới trái.
- Ưu: không phải nghĩ, chạm được khi đeo găng; mỗi lúc chỉ có một việc đúng.
- Nhược: khi cần ghi mốc khác thứ tự (VD đã thông quan nhưng quên ghi đến cửa khẩu) phải vào menu phụ.

**Hướng B — Danh sách điểm dừng, mỗi điểm có nút riêng.** Như checklist hành trình: mỗi điểm dừng là một hàng có nút "Đã đến" / "Rời đi".
- Ưu: thấy toàn bộ, linh hoạt.
- Nhược: nhiều nút cùng lúc, dễ bấm nhầm hàng khi xe rung; nút nhỏ hơn.

**Khuyến nghị: A**, có thêm "Ghi mốc khác" trong menu "…" cho trường hợp ngoại lệ. Web đã đi hướng tương tự (`DriverWorkspace.tsx`: "Bắt đầu chuyến đi", "Check-in chặng").

### 3.6 Ý tưởng khác

- Chỉ báo GPS và đồng bộ luôn ở header: "GPS đang chia sẻ" / "Mất sóng · 12 điểm chờ gửi".
- Nút "Báo sự cố" luôn trong 1 chạm ở DRV-02; DRV-06 dùng thẻ lớn cho 3 loại, mức độ dùng nhãn chữ + icon, không chỉ màu.
- Chế độ tương phản cao tự bật trong dark mode ngoài trời **CẦN XÁC NHẬN** (đề xuất sau MVP).

## 4. Hộ tống (ESC)

### 4.1 Persona

Chị Thu, 30 tuổi, kỹ thuật viên chăm sóc ngựa. Ngồi trong khoang ngựa hoặc đứng ở chuồng tạm, một tay giữ dây cương, tay kia cầm máy. Ghi chép nhiều lần mỗi ngày (cho ăn, uống, nghỉ, đo nhiệt độ). Lo nhất: ngựa có dấu hiệu lạ mà báo chậm, và mất bản ghi khi không có sóng.

### 4.2 Ba việc quan trọng nhất

1. Ghi cho ăn / uống nước / nghỉ chân trong 2–3 chạm.
2. Ghi và gửi báo cáo sức khỏe kèm ảnh.
3. Báo bất thường ngay khi thấy.

### 4.3 Tab bar

| Tab | Icon | Lý do |
| --- | --- | --- |
| Ngựa | `paw-print` (như CUS) | Màn làm việc chính: thẻ từng ngựa |
| Nhật ký | `notebook-pen` | Dòng thời gian mọi ghi chép của chuyến, kể cả nháp |
| Thông báo | `bell` | |
| Tài khoản | `user-round` | |

Nút nổi "Ghi nhanh" (cao 56pt) ở tab Ngựa và Nhật ký, nằm vùng ngón cái.

### 4.4 Bảng màn

| Mã | Tên | Mục đích | Hành động chính | Dữ liệu hiển thị | Nhập | Endpoint | Trình bày | Offline | Ưu tiên |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ESC-01 | ~~Chuyến của tôi~~ | Gộp vào ESC-09 (Long, 30/10): đang trong chuyến thì không đổi chuyến | | | | | | | bỏ |
| ESC-02 | Ngựa trên chuyến | Toàn cảnh đàn ngựa | Ghi nhanh | mỗi ngựa: tên, giống, tình trạng gần nhất (nhãn + icon), lần cho ăn gần nhất, nước hôm nay; tóm tắt hôm nay (L nước, bữa, lần nghỉ); điểm kế tiếp của xe | | `/tracking/trips/:id`, `/horse-logs`, `/care-activities` | màn tab | **có** | P0 |
| ESC-03 | Ghi nhanh chăm sóc | Ghi 1 hoạt động | Lưu nhật ký | | hoạt động (chip), ngựa (chip, có "Cả đoàn" cho Nghỉ chân), khẩu phần (chip mẫu + sửa), lít (stepper 1 L, nút ±5), phút (stepper 5 phút), giờ (mặc định bây giờ), ghi chú | `POST /trips/:id/care-activities` | bottom sheet | có (hàng chờ) | P0 |
| ESC-04 | Báo cáo sức khỏe | Ghi tình trạng 1 ngựa | Gửi báo cáo (phụ: Lưu nháp) | | tình trạng (4 chip lớn), nhiệt độ (stepper 0,1 °C quanh 37,8), nhịp tim (stepper), ăn uống (3 chip), ảnh (**luôn bắt buộc**, G13), ghi chú nội bộ, ghi chú gửi khách, công tắc "Gửi cho khách" | `POST /legs/:id/horse-logs`, `PATCH`, `/send` | màn đẩy | có (tự lưu nháp) | P0 |
| ESC-05 | Chi tiết ngựa | Lịch sử 1 ngựa trên chuyến | Báo cáo sức khỏe | thông tin ngựa, báo cáo (nháp/đã gửi/khách đã xem), hoạt động chăm sóc | | `/horse-logs`, `/care-activities` | màn đẩy | cache | P0 |
| ESC-06 | Nhật ký chuyến | Dòng thời gian | Ghi nhanh | mọi hoạt động + báo cáo theo giờ, bản đính chính, mục chờ gửi | sửa = tạo bản đính chính | `/care-activities`, `/horse-logs` | màn tab | có || P0 |
| ESC-07 | Báo bất thường | Đường tắt 4 chạm (bắt buộc ảnh) | Chụp ảnh và gửi | | chạm "Báo bất thường" trên thẻ ngựa → chọn Bỏ ăn / Căng thẳng / Khí hậu thay đổi / Y tế khẩn → camera → gửi | `horse-logs` (SENT) hoặc `incidents` (HORSE_MEDICAL) | bottom sheet | có | P0 |
| ESC-08 | Báo cáo nháp | Hoàn tất nháp | Mở nháp | danh sách nháp | | `/horse-logs` (DRAFT) | màn đẩy | có | P1 |
| ESC-09 | Lịch sử chuyến | Chuyến đang chạy, sắp tới (khóa khi đang chạy), đã xong | Xem lại chuyến | orderCode, trạng thái, tuyến, ngày, số ngựa | | `/tracking/driver/trips` | màn đẩy, icon trên ESC-02 | cache | P0 |
| ESC-10 | Xem lại chuyến | Chỉ đọc chuyến đã giao | | ngựa, nhật ký, báo cáo | | `/tracking/trips/:id`, `/horse-logs`, `/care-activities` | màn đẩy | cache | P1 |

Báo sự cố chung (xe, đường) của hộ tống dùng lại DRV-06/07.

### 4.5 Ý tưởng cho màn quan trọng nhất: ESC-02 Ngựa trên chuyến

**Hướng A — Thẻ ngựa có nút hành động ngay trên thẻ.** Mỗi thẻ: ảnh vuông 56pt, tên, tình trạng; 3 nút nhỏ Cho ăn / Uống / Báo cáo trên thẻ.
- Ưu: 1 chạm cho từng ngựa.
- Nhược: nhiều nút nhỏ (≤44pt) lặp lại, khó bấm một tay, màn rối khi 6 ngựa.

**Hướng B — Thẻ gọn + một nút "Ghi nhanh" chung.** Thẻ chỉ hiển thị tình trạng và giờ ăn/uống gần nhất (đỏ chữ khi quá 4 giờ chưa uống, **CẦN XÁC NHẬN** ngưỡng). Nút nổi "Ghi nhanh" mở ESC-03, chọn hoạt động rồi chọn ngựa bằng chip; "Báo bất thường" là hành động khi chạm giữ hoặc menu trên thẻ.
- Ưu: một nút lớn ở vùng ngón cái, chọn được nhiều ngựa một lần (cho cả đoàn uống nước), màn sạch.
- Nhược: ghi cho 1 ngựa cần thêm 1 chạm chọn ngựa.

**Khuyến nghị: B.** Ghi cho nhiều ngựa cùng lúc là việc thường xuyên nhất; web cũng dùng "Ghi nhận nhanh" chung (`QuickLogCard.tsx`). **CẦN XÁC NHẬN**: API care-activities nhận 1 ngựa mỗi lần; chọn nhiều ngựa = app gửi nhiều request.

## 5. Ma trận đối chiếu chức năng MVP → màn

| Actor | Chức năng MVP (00-context mục 3) | Màn |
| --- | --- | --- |
| Khách hàng | Hồ sơ ngựa | CUS-08, CUS-09, CUS-10 |
| Khách hàng | Gửi yêu cầu vận chuyển đơn giản | CUS-11 → CUS-15 |
| Khách hàng | Xem đơn/báo giá | CUS-02, CUS-03, CUS-04 (+ CUS-16 giấy tờ, chỉ xem) |
| Khách hàng | Theo dõi vị trí | CUS-01, CUS-05, CUS-06, CUS-07 |
| Khách hàng | Nhận thông báo | COM-06, COM-09 |
| Tài xế | Xem chuyến được giao | DRV-01, DRV-02, DRV-10 |
| Tài xế | Checklist | DRV-03 |
| Tài xế | Cập nhật mốc chặng | DRV-02, DRV-04 |
| Tài xế | GPS nền | COM-07, chỉ báo trong DRV-02, DRV-05 |
| Tài xế | Báo sự cố kèm ảnh | DRV-06, DRV-07, DRV-08, DRV-09 |
| Hộ tống | Xem danh sách ngựa | ESC-02, ESC-05 (lịch sử: ESC-09) |
| Hộ tống | Ghi nhật ký chăm sóc/sức khỏe | ESC-03, ESC-04, ESC-06, ESC-08 |
| Hộ tống | Chụp ảnh | ESC-04, ESC-07 (COM-08) |
| Hộ tống | Báo bất thường | ESC-07 (+ DRV-06/07 dùng chung) |
| Chung | Offline/đồng bộ | COM-12, thanh trạng thái toàn cục |

Không có màn ngoài phạm vi: không có màn điều phối, manager, thanh toán trong app (CUS-04 chỉ mở web), tải giấy tờ (CUS-16 chỉ xem).

## 6. Thông báo push

Sự kiện lấy từ `notifications.event_type` đang ghi trong code (`01-data-inventory.md` mục 4.12). Push cần G1.

| Sự kiện (event_type) | Người nhận | Nội dung mẫu | Mở màn |
| --- | --- | --- | --- |
| ORDER_REVIEWED (duyệt) | Khách hàng | Đơn HR-2610-0012 đã được duyệt. | CUS-03 |
| ORDER_REVIEWED (cần bổ sung / từ chối) | Khách hàng | Đơn HR-2610-0012 cần bổ sung thông tin: thiếu số hộ chiếu ngựa Sao Mai. | CUS-03 |
| QUOTE_APPROVED | Khách hàng | Báo giá đơn HR-2610-0012 đã sẵn sàng: 48.600.000 ₫, cọc 14.580.000 ₫. | CUS-04 |
| PAYMENT_SUCCESS | Khách hàng | Đã nhận đặt cọc 14.580.000 ₫ cho đơn HR-2610-0012. | CUS-04 |
| ORDER_READY | Khách hàng, tài xế, hộ tống | Chuyến đơn HR-2610-0012 sẵn sàng khởi hành 05/11 06:00. | CUS-03 / DRV-02 / ESC-02 |
| ORDER_IN_TRANSIT | Khách hàng | Sao Mai và Kim Long đã lên đường lúc 06:12. | CUS-05 |
| ORDER_LEG_PROGRESS | Khách hàng | Đã đến Cửa khẩu Mộc Bài lúc 10:35. | CUS-05 |
| HORSE_REPORT | Khách hàng | Báo cáo sức khỏe mới của Sao Mai: Sức khỏe ổn định. | CUS-06 |
| ORDER_DELIVERED | Khách hàng | Đã giao ngựa tại Trạm kiểm dịch Svay Rieng lúc 14:20. | CUS-03 |
| TRIP_CREW_CHANGED | Tài xế, hộ tống | Bạn được phân công vai trò tài xế cho chuyến HR-2610-0012. | DRV-02 / ESC-02 |
| TRIP_ALERT | Tài xế, hộ tống | Cửa khẩu: Mộc Bài ùn tắc, dự kiến chờ 2 giờ. | DRV-12 |
| INCIDENT_ACKNOWLEDGED / INCIDENT_CLOSED | Người báo | Điều phối đã tiếp nhận sự cố Hỏng xe. | DRV-09 |
| DOCUMENT_* (**CẦN XÁC NHẬN** event_type cho khách) | Khách hàng | Giấy kiểm dịch của Sao Mai không hợp lệ: hết hạn. | CUS-16 |

Push tới tài xế lúc đang chạy xe: chỉ TRIP_ALERT dùng âm thanh; còn lại im lặng.

## 7. Đề xuất sau MVP

- Thanh toán trong app (VNPay SDK), tải giấy tờ trong app.
- Hủy đơn, xóa hồ sơ ngựa (cần API, G9).
- Vị trí thật cho khách hàng (G4).
- Chế độ tương phản cao ngoài trời cho tài xế; đọc mô tả sự cố bằng giọng nói toàn phần.
- Đăng nhập sinh trắc học.

## Tóm tắt

Chung 12 màn (8 P0), Khách hàng 16 màn (14 P0), Tài xế 13 màn (8 P0), Hộ tống 9 màn (6 P0); tổng 50 màn, 36 P0. Khuyến nghị: CUS-05 hướng B (timeline là chính, bản đồ là thẻ phụ), DRV-02 hướng A (một nút lớn theo ngữ cảnh), ESC-02 hướng B (thẻ gọn + nút "Ghi nhanh" chung).

## Quyết định của Long (29/10/2026)

1. Duyệt 3 hướng: CUS-05 hướng B, DRV-02 hướng A, ESC-02 hướng B.
2. Mốc check-in tại điểm dừng (đến/rời): ghi ngay và hiện thanh "Hoàn tác" 5 giây, không hỏi xác nhận. Thông quan và Đã giao vẫn có hộp xác nhận.
3. Báo bất thường bắt buộc ảnh; mọi báo cáo sức khỏe (nhật ký ngựa) cũng bắt buộc ảnh (G13). Ghi nhanh chăm sóc (ăn, uống, nghỉ) không bắt buộc ảnh (Long xác nhận 29/10).
4. Thêm DRV-13 Hoàn tất chuyến (P0).
5. Liên lạc giữa khách hàng và công ty (chat hay gọi, ai phụ trách) **để sau**. Màn khách hàng chưa hiện số điều phối viên, chỉ giữ chỗ cho khu vực "Liên hệ".
6. Icon tab Ngựa: vẽ riêng icon đầu ngựa cùng nét với Lucide (2px, bo tròn), nếu không đẹp thì dùng icon có sẵn.
