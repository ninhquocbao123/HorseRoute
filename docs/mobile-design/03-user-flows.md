# 03 — User flow

Ngày lập: 29/10/2026. Dùng mã màn ở `02-screens.md`, API và trạng thái ở `01-data-inventory.md`. Mermaid render được trên GitHub / VS Code.

Quy ước trên mũi tên: hành động người dùng hoặc sự kiện hệ thống; `API:` là endpoint gọi; `→ X` là trạng thái nghiệp vụ đổi sang X. Số chạm đếm trên đường chính, không tính gõ phím.

Hàng chờ offline dùng chung cho mọi flow: thao tác ghi khi mất mạng được lưu SQLite kèm `clientRequestId`, gửi lại theo thứ tự khi có mạng; mục lỗi vĩnh viễn (4xx) hiện trong COM-12 với cách xử lý. Phần backend cần cho hàng chờ: G2 (chống trùng) và G3 (nới cửa sổ nhập bù, Long đã chọn phương án A).

## 1. Chung

### F-C1 Mở app lần đầu → đăng nhập → vào đúng vai trò

```mermaid
flowchart TD
  A["Mở app"] --> B["COM-01 Khởi động"]
  B -->|"Không có token"| C["COM-02 Đăng nhập"]
  B -->|"Có token, API: GET /users/me OK"| R{"role?"}
  B -->|"Có token, 401"| C
  C -->|"Đăng nhập, API: POST /auth/login"| R
  C -->|"Sai email/mật khẩu"| C1["Lỗi tại form: Email hoặc mật khẩu không đúng"]
  C1 --> C
  C -->|"Mất mạng"| C2["Banner: Cần kết nối để đăng nhập"]
  R -->|"CUSTOMER"| N1["COM-06 Quyền thông báo (lần đầu)"]
  R -->|"DRIVER_ESCORT, API: GET /tracking/driver/trips"| K{"crewRole chuyến hiện tại?"}
  R -->|"Vai trò khác"| X["COM-05 Dùng web"]
  K -->|"DRIVER"| N2["COM-06 Quyền thông báo"]
  K -->|"ESCORT"| N3["COM-06 Quyền thông báo"]
  K -->|"Chưa có chuyến"| N4["Theo crew_type (CẦN XÁC NHẬN nguồn)"]
  N1 --> H1["CUS-01 Hành trình"]
  N2 --> H2["DRV-01 Chuyến của tôi"]
  N3 --> H3["ESC-02 Ngựa trên chuyến"]
  N1 -->|"Từ chối quyền"| H1
```

Đường chính: 2 chạm (Đăng nhập, Cho phép thông báo). Token lưu `expo-secure-store`.

### F-C2 Token hết hạn

```mermaid
flowchart TD
  A["Đang dùng app"] -->|"API trả 401 Token không hợp lệ hoặc đã hết hạn"| B{"Có mục chờ gửi?"}
  B -->|"Không"| C["COM-02 Đăng nhập, giữ màn đích"]
  B -->|"Có"| D["Giữ hàng chờ trong SQLite, không xóa"]
  D --> C
  C -->|"Đăng nhập lại cùng tài khoản"| E["Quay lại màn cũ, gửi tiếp hàng chờ"]
  C -->|"Đăng nhập tài khoản khác"| F["Hỏi: Còn 3 mục chưa gửi của tài khoản trước. Đăng nhập lại tài khoản đó hay bỏ các mục này?"]
```

JWT 7 ngày, không có refresh (G5). Tài xế nên được nhắc đăng nhập lại trước chuyến nếu token còn < 24 giờ (**CẦN XÁC NHẬN** đọc `exp` trong JWT ở client).

### F-C3 Mất mạng giữa chừng

```mermaid
flowchart TD
  A["Thao tác ghi bất kỳ"] -->|"Có mạng"| B["Gọi API ngay"]
  A -->|"Mất mạng"| C["Lưu SQLite, nhãn Chờ gửi, haptic nhẹ"]
  B -->|"Timeout / lỗi mạng"| C
  C --> D["Thanh trạng thái: Đang offline · N mục chờ gửi"]
  D -->|"Có mạng lại"| E["Gửi lần lượt theo thứ tự tạo"]
  E -->|"2xx"| F["Xóa khỏi hàng chờ, cập nhật dữ liệu"]
  E -->|"409 trạng thái đã đổi"| G["Tải lại dữ liệu, COM-12 báo: Chuyến đã được điều phối cập nhật, kiểm tra lại"]
  E -->|"4xx khác"| H["COM-12: lỗi + cách sửa, nút Sửa / Bỏ"]
  E -->|"5xx / mạng"| I["Thử lại lùi dần 5s, 15s, 60s"]
  I --> E
```

App bị tắt giữa chừng: hàng chờ nằm trong SQLite nên còn nguyên; khi mở lại, COM-01 gửi tiếp trước khi tải dữ liệu mới.

## 2. Khách hàng

### F-K1 Tạo hồ sơ ngựa

```mermaid
flowchart TD
  A["CUS-08 Ngựa"] -->|"Thêm ngựa"| B["CUS-10 Thêm hồ sơ"]
  B -->|"Chụp/chọn ảnh"| P{"Quyền ảnh?"}
  P -->|"Cho phép"| B
  P -->|"Từ chối"| P1["Ghi chú: Bạn có thể thêm ảnh sau trong Cài đặt"]
  P1 --> B
  B -->|"Lưu hồ sơ, API: POST /customer/profiles"| C{"Kết quả"}
  C -->|"201"| D["Tải ảnh, API: POST /profiles/:id/files"]
  D -->|"OK"| E["CUS-09 Hồ sơ ngựa + toast Đã lưu hồ sơ"]
  D -->|"Ảnh lỗi / quá 5 MB"| D1["Hồ sơ đã lưu, ảnh hiện nút Thử lại"]
  C -->|"409 Định danh đã được sử dụng"| C1["Lỗi tại ô Số hộ chiếu"]
  C1 --> B
  C -->|"Mất mạng"| C2["Giữ form, nút Lưu báo: Cần kết nối để lưu"]
```

Đường chính: 3 chạm (Thêm ngựa, chọn ảnh, Lưu) + nhập form. Hồ sơ khách không vào hàng chờ offline vì cần kiểm tra trùng số hộ chiếu.

### F-K2 Gửi yêu cầu → báo giá → chấp nhận

```mermaid
flowchart TD
  A["CUS-02 hoặc CUS-09"] -->|"Tạo yêu cầu"| S1["CUS-11 Chọn ngựa"]
  S1 -->|"Chọn ngựa, Tiếp tục; API: POST /orders nháp với requestId → DRAFT"| S2["CUS-12 Tuyến và ngày"]
  S1 -->|"Ngựa đang thuộc đơn khác"| S1x["Ngựa bị khóa, ghi: Đang thuộc đơn HR-..."]
  S2 -->|"Tiếp tục; API: PUT /orders/:id"| S3["CUS-13 Ghi chú"]
  S3 -->|"Tiếp tục"| S4["CUS-14 Xem lại"]
  S4 -->|"Gửi yêu cầu; API: POST /orders/:id/submit → PENDING"| S5["CUS-15 Đã gửi"]
  S4 -->|"422 lỗi trường"| S4x["Quay về bước có lỗi, đánh dấu ô"]
  S5 --> W["Chờ Manager duyệt"]
  W -->|"Push ORDER_REVIEWED → NEED_INFO"| N["CUS-03: lý do + Sửa và gửi lại"]
  N --> S2
  W -->|"Push ORDER_REVIEWED → REJECTED"| RJ["CUS-03: lý do từ chối"]
  W -->|"Push ORDER_REVIEWED → APPROVED"| AP["CUS-03 Đã duyệt"]
  AP -->|"Push QUOTE_APPROVED"| Q["CUS-04 Báo giá"]
  Q -->|"Thanh toán cọc: mở web"| WEB["Web: VNPay"]
  WEB -->|"Socket payment:updated / push PAYMENT_SUCCESS → PREPARING"| Q2["CUS-04: Đã đặt cọc"]
  Q -->|"Không đồng ý giá"| Q3["Gọi hotline (chưa có API từ chối, G9)"]
  Q -->|"Báo giá hết hạn"| Q4["Thông báo: Báo giá đã hết hạn, chờ báo giá mới"]
```

Đường chính tới khi gửi: 6 chạm (Tạo yêu cầu, chọn ngựa, 3 lần Tiếp tục, Gửi). Thoát giữa chừng: nháp đã lưu trên server từ bước 1, CUS-02 hiện đơn "Nháp" để làm tiếp. Trạng thái đơn bị đổi bởi người khác (VD manager đã duyệt khi khách đang sửa NEED_INFO): submit trả 409, app tải lại CUS-03.

### F-K3 Theo dõi chuyến từ push → hoàn thành

```mermaid
flowchart TD
  P["Push ORDER_IN_TRANSIT"] -->|"Chạm"| A["CUS-05 Theo dõi; API: /timeline, /map; socket join:order"]
  A -->|"Socket order:status_updated / push ORDER_LEG_PROGRESS"| A
  A -->|"Chạm thẻ báo cáo"| B["CUS-06 Báo cáo sức khỏe; API: POST /horse-reports/:id/view"]
  B --> A
  A -->|"Chạm bản đồ"| M["Bản đồ toàn màn, nhãn Vị trí ước tính theo mốc gần nhất"]
  A -->|"isOverdue"| O["Dòng cảnh báo: Trễ 35 phút so với kế hoạch + Gọi hotline"]
  A -->|"Push ORDER_DELIVERED → DELIVERED"| D["CUS-03: Đã giao ngựa lúc 14:20"]
  A -->|"Mất mạng"| X["Hiện dữ liệu cache + Cập nhật lúc 10:35"]
```

Đường chính: 1 chạm (mở push). Vị trí luôn ghi rõ là ước tính (quyết định G4).

## 3. Tài xế

### F-D1 Nhận chuyến → xem chi tiết

```mermaid
flowchart TD
  P["Push TRIP_CREW_CHANGED hoặc ORDER_READY"] -->|"Chạm"| A["DRV-02 Chuyến; API: GET /tracking/trips/:id"]
  L["DRV-01 Chuyến của tôi"] -->|"Chạm chuyến"| A
  A -->|"Lưu chi tiết chuyến vào SQLite"| A
  A -->|"Chạm Ngựa và giao nhận"| B["DRV-10"]
  A -->|"Chuyến chưa READY"| C["Nút chính mờ: Chờ Manager chuyển chuyến; vẫn xem được kế hoạch"]
  P -->|"Phân công bị gỡ"| D["DRV-01 + thông báo: Phân công của bạn đã được gỡ"]
```

Đường chính: 1 chạm.

### F-D2 Checklist → bắt đầu chuyến (bật GPS nền)

```mermaid
flowchart TD
  A["DRV-02, đơn READY"] -->|"Kiểm tra trước chuyến"| B["DRV-03, 5 mục"]
  B -->|"Tick 5 mục, Xong"| A2["DRV-02: nút Bắt đầu chuyến"]
  B -->|"Còn mục chưa tick, Xong"| B1["Hộp thoại: Còn 2 mục chưa kiểm tra. Vẫn tiếp tục?"]
  B1 --> A2
  A2 -->|"Bắt đầu chuyến"| Q{"Đã có quyền vị trí Luôn cho phép?"}
  Q -->|"Chưa"| G["COM-07 Giải thích quyền vị trí"]
  G -->|"Cho phép"| S
  G -->|"Chỉ khi dùng app / Từ chối"| G1["Banner: GPS chỉ gửi khi mở app. Mở Cài đặt"]
  G1 --> S
  Q -->|"Có"| S["DRV-04 Xác nhận Bắt đầu chuyến, giờ = bây giờ"]
  S -->|"Xác nhận; API: POST /legs/:id/milestones DEPARTED → leg MOVING, đơn IN_TRANSIT"| R["DRV-02 đang chạy, GPS nền bật, gửi lô 20 điểm/30 giây"]
  S -->|"Mất mạng"| R1["Mốc vào hàng chờ; GPS vẫn ghi vào SQLite"]
  S -->|"409 Chuyến chưa đủ điều kiện xuất phát: ..."| E["Hiện nguyên lý do + Gọi điều phối"]
  R -->|"GPS tắt trên máy"| T["Banner đỏ: Định vị đang tắt. Bật định vị"]
```

Đường chính nếu tick từng mục: **9 chạm** (Kiểm tra, 5 tick, Xong, Bắt đầu, Xác nhận). Thêm nút "Đã kiểm tra tất cả" ở cuối DRV-03 (1 chạm thay 5 tick) thì còn **5 chạm**. Checklist làm 1 lần mỗi chuyến nên chấp nhận được.

### F-D3 Cập nhật mốc từng điểm dừng đến khi giao

```mermaid
flowchart TD
  A["DRV-02: Đang tới Điểm nghỉ Trảng Bàng"] -->|"Đã đến Trảng Bàng"| B["DRV-04 Xác nhận"]
  B -->|"Xác nhận; API: ARRIVED_AT_STOP → AT_STOP"| C["DRV-02: Đang dừng tại Trảng Bàng, nút Rời Trảng Bàng"]
  C -->|"Rời Trảng Bàng → Xác nhận; API: DEPARTED → MOVING"| D["DRV-02: Đang tới Cửa khẩu Mộc Bài"]
  D -->|"Đã đến cửa khẩu → Xác nhận"| E["DRV-02: Tại cửa khẩu, nút Đã thông quan"]
  E -->|"Đã thông quan → Xác nhận; API: CUSTOMS_CLEARED"| F["DRV-02: Rời cửa khẩu"]
  F -->|"... điểm cuối"| G["DRV-02: nút Xác nhận đã giao"]
  G -->|"Xác nhận đã giao → DRV-04; API: POST /legs/:id/complete → COMPLETED, đơn DELIVERED"| H["Màn hoàn tất: Đã giao 2 ngựa lúc 14:20 + GPS nền tắt"]
  B -->|"Quên ghi, giờ thật đã qua"| B2["Sửa giờ trong DRV-04 (trong 24 giờ, G3 phương án A)"]
  B -->|"Mất mạng"| Q["Hàng chờ; DRV-02 vẫn chuyển sang trạng thái tiếp theo, nhãn Chờ gửi"]
  Q -->|"Có mạng, 409 do điều phối đã hiệu chỉnh"| Q2["Tải lại chuyến, báo: Điều phối đã cập nhật chặng. Kiểm tra lại mốc"]
```

Mỗi điểm dừng: 2 chạm để đến (nút chính + Xác nhận), 2 chạm để rời. Đây là tác vụ thường xuyên nhất của tài xế. Rút gọn đề xuất: DRV-04 có nút "Xác nhận" cao 64pt ngay dưới ngón cái, và thời gian huỷ 5 giây ("Hoàn tác") thay cho hộp xác nhận ở mốc ít rủi ro (Đến/Rời điểm nghỉ) → 1 chạm. Giữ xác nhận 2 bước cho "Bắt đầu chuyến" và "Xác nhận đã giao". **Cần Long duyệt.**

Lưu ý: Long chọn ghi mốc theo **điểm dừng**. Backend hiện ghi mốc theo `legs` (chặng). Với chuyến mới chỉ có 1 chặng đại diện + `route_plan`, cần xác nhận cách backend gắn mốc ARRIVED_AT_STOP/DEPARTED vào từng điểm dừng (**CẦN XÁC NHẬN**, có thể cần thêm `stopIndex` vào API mốc).

### F-D4 Báo sự cố kèm ảnh khi không có mạng

```mermaid
flowchart TD
  A["DRV-02"] -->|"Báo sự cố"| B["DRV-06 Loại + mức độ"]
  B -->|"Chọn Hỏng xe, Nghiêm trọng, Tiếp tục"| C["DRV-07 Chi tiết, vị trí lấy từ GPS máy"]
  C -->|"Chụp ảnh"| P{"Quyền camera?"}
  P -->|"Chưa hỏi"| P1["COM-08"]
  P -->|"Từ chối"| P2["Chọn từ thư viện, hoặc gửi không ảnh"]
  C -->|"Gửi báo cáo, mất mạng"| Q["Lưu SQLite: form + ảnh đã nén JPEG + clientRequestId"]
  Q --> D["DRV-08: Đã lưu, sẽ tự gửi khi có sóng + Gọi điều phối ngay (sự cố Nghiêm trọng)"]
  Q -->|"Có mạng; API: POST /trips/:id/incidents multipart → NEW"| E["Push nội bộ cho điều phối INCIDENT_REPORTED"]
  E -->|"Socket tracking:incident_updated"| F["DRV-09: Đã tiếp nhận"]
  Q -->|"Ảnh lỗi định dạng / quá 5 MB"| G["COM-12: ảnh 2 không gửi được, nút Bỏ ảnh và gửi"]
  C -->|"App bị tắt"| H["Nháp tự lưu; mở lại vào DRV-07 với dữ liệu cũ"]
```

Đường chính: 6 chạm (Báo sự cố, loại, mức, Tiếp tục, chụp ảnh, Gửi) + mô tả ≥5 ký tự. Mô tả là trường nhập dài duy nhất của tài xế; đề xuất chip câu mẫu theo loại con (VD "Nổ lốp sau bên phải") để không phải gõ.

## 4. Hộ tống

### F-E1 Xem ngựa trên chuyến

```mermaid
flowchart TD
  P["Push TRIP_CREW_CHANGED / ORDER_READY"] -->|"Chạm"| A["ESC-02 Ngựa trên chuyến; API: /trips/:id, /horse-logs, /care-activities"]
  A -->|"Chạm thẻ ngựa"| B["ESC-05 Chi tiết ngựa"]
  A -->|"Mất mạng"| C["Dữ liệu SQLite + Cập nhật lúc ..."]
  A -->|"Không có chuyến"| D["Trống: Chuyến sẽ xuất hiện khi điều phối phân công bạn"]
```

Đường chính: 1 chạm.

### F-E2 Ghi nhật ký chăm sóc / sức khỏe kèm ảnh

```mermaid
flowchart TD
  A["ESC-02"] -->|"Ghi nhanh"| B["ESC-03"]
  B -->|"Uống nước, chọn Sao Mai + Kim Long, stepper 12 L, Lưu"| C{"Mạng?"}
  C -->|"Có; API: POST /care-activities x2"| D["Toast Đã ghi 2 hoạt động; thẻ ngựa cập nhật"]
  C -->|"Không"| D2["Hàng chờ, thẻ hiện nhãn Chờ gửi"]
  C -->|"422 Giờ thực hiện quá xa"| D3["COM-12 (hết khi backend làm G3)"]
  A -->|"Thẻ ngựa → Báo cáo sức khỏe"| E["ESC-04, tự lưu nháp mỗi thay đổi"]
  E -->|"Tình trạng Căng thẳng, nhiệt độ 38,6, chụp 1 ảnh, Gửi báo cáo"| F{"Ảnh đủ? (mọi báo cáo cần ≥1 ảnh, Long chốt 29/10)"}
  F -->|"Thiếu"| F1["Lỗi: Cần ít nhất 1 ảnh để gửi báo cáo"]
  F -->|"Đủ; API: POST /legs/:id/horse-logs SENT"| G["ESC-05: Đã gửi; điều phối nhận HORSE_REPORT_ALERT; khách nhận HORSE_REPORT nếu bật"]
  E -->|"Lưu nháp; API: reportStatus DRAFT"| H["ESC-08 Nháp"]
  G -->|"Socket tracking:horse_report_viewed"| I["ESC-05: Khách đã xem lúc 15:02"]
```

Ghi nhanh: **4 chạm** (Ghi nhanh, hoạt động, ngựa, Lưu) khi giữ lượng mặc định; ghi cho cả đoàn chỉ thêm 1 chạm "Chọn tất cả". Báo cáo sức khỏe: 5 chạm + ảnh.

### F-E3 Báo bất thường → ai nhận

```mermaid
flowchart TD
  A["ESC-02 thẻ ngựa"] -->|"Chạm giữ hoặc menu: Báo bất thường"| B["ESC-07 sheet"]
  B -->|"Bỏ ăn / Căng thẳng / Khí hậu thay đổi"| C["Camera mở ngay"]
  C -->|"Chụp, Gửi; API: horse-logs SENT, sendToCustomer mặc định tắt"| D["Điều phối viên (planned_by) nhận HORSE_REPORT_ALERT"]
  B -->|"Y tế khẩn (chấn thương, đau bụng)"| E["DRV-07 dựng sẵn: Y tế ngựa + ngựa đã chọn"]
  E -->|"Gửi; API: POST /incidents HORSE_MEDICAL"| F["Manager + điều phối nhận INCIDENT_REPORTED; RED = KHẨN"]
  C -->|"Mất mạng"| G["Hàng chờ + nút Gọi điều phối"]
```

Đường chính: 4 chạm (giữ thẻ, chọn tình trạng, chụp, Gửi). Mục tiêu "2 chạm" của prompt không đạt được vì báo bất thường bắt buộc có ảnh (`HORSE_REPORT_PHOTO_REQUIRED_STATUSES`). Long chốt 29/10: giữ bắt buộc ảnh (4 chạm).

## 5. Thay đổi cần cập nhật vào 02-screens.md

1. Thêm **DRV-13 Hoàn tất chuyến** (màn sau "Xác nhận đã giao": tóm tắt, GPS đã tắt) — P0.
2. DRV-03 thêm nút "Đã kiểm tra tất cả".
3. DRV-04 thêm biến thể "Hoàn tác 5 giây" nếu Long duyệt.
4. ESC-07 ghi rõ 4 chạm, không phải 2.
5. COM-02 thêm biến thể "Còn mục chưa gửi của tài khoản trước" (F-C2).

## Tóm tắt

13 flow (3 chung, 3 khách hàng, 4 tài xế, 3 hộ tống), mỗi flow có nhánh mất mạng, quyền bị từ chối, 409 do người khác đổi trạng thái và app bị tắt. Tác vụ thường xuyên của tài xế (ghi mốc) là 2 chạm mỗi lần; của hộ tống (ghi chăm sóc) là 4 chạm. Phát hiện 1 điểm backend mới: ghi mốc theo điểm dừng có thể cần `stopIndex` trong API mốc.

## Quyết định của Long (29/10/2026)

1. Check-in điểm dừng dùng "Hoàn tác 5 giây": đường chính ghi mốc còn **1 chạm**. Thông quan và Đã giao giữ hộp xác nhận (2 chạm).
2. Báo bất thường giữ bắt buộc ảnh (4 chạm). Mọi báo cáo sức khỏe cũng bắt buộc ảnh.
3. Duyệt DRV-13 và các chỉnh sửa ở mục 5 (đã cập nhật vào 02-screens.md).
