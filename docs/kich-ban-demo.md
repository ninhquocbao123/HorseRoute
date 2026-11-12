# Kịch bản demo trước hội đồng

Lập ngày 12/11/2026 (ngày 7 của [kế hoạch xử lý lỗi](ke-hoach-xu-ly-loi-10-11-2026.md)). Phần 3 đã được tập trên web với dữ liệu demo ngày 12/11/2026. Kết quả tập và các lỗi tìm được ghi ở mục 6.

Thời lượng khoảng 20 phút. Mỗi bước ghi: ai đăng nhập, làm gì, chỉ cho hội đồng thấy gì.

## 1. Chuẩn bị (trước buổi bảo vệ ít nhất 30 phút)

1. **Dựng dữ liệu demo** theo [demo-local.md](demo-local.md):

   ```bash
   cd apps/api
   DEMO_DB_PORT=33062 DEMO_DB_PASSWORD=demo node scripts/seed-flow4-demo.cjs
   ```

   Seed chỉ chạy trên MySQL của máy này. Nó không đụng WDP hay Aiven. Mỗi lần chạy, seed xóa rồi dựng lại database `wdp_flow4_demo`.
2. **Chạy API và web demo:**

   ```bash
   pnpm dev:api:demo
   pnpm dev:web:demo
   ```

   Web demo ở http://localhost:5180. Nhân viên đăng nhập ở `/staff/login`, khách đăng nhập ở `/login`. Mật khẩu chung của mọi tài khoản: `Demo@12345`.
3. **Cần mạng Internet.** Bản đồ nền, tìm địa chỉ (Photon, khi lỗi tự chuyển sang Nominatim) và tính tuyến (OSRM) đều là dịch vụ công khai.
4. **Làm nóng bản đồ, 10 phút trước khi vào:** đăng nhập `coordinator@example.com`, lần lượt mở 3 chuyến của các đơn `WDP-DEMO-AUTO-VN`, `-CN`, `-TH` (danh sách chuyến của điều phối). Chờ tới khi hiện "Giờ đến dự kiến", **không bấm lưu**.
   - Lần đầu mất 10–30 giây. Các lần sau dùng kết quả đã nhớ nên nhanh hơn.
   - Ngày 12/11, Photon công khai mất khoảng 30 giây mỗi lần tra. Hệ thống đã tự chuyển sang Nominatim, nên vẫn lập được trong khoảng 25 giây.
   - Nếu lúc làm nóng vẫn báo "Dịch vụ bản đồ công khai đang chậm…", xem mục 5.
5. **Mở sẵn các tab trình duyệt** ở chế độ ẩn danh, mỗi vai một tab, để khỏi đăng xuất qua lại: khách, quản lý, điều phối, tài xế.
6. **Điện thoại Android** (nếu demo app):
   - Chạy `npm run start:emulator` trong `apps/mobile` (xem [apps/mobile/README.md](../apps/mobile/README.md)).
   - Đặt `EXPO_PUBLIC_API_URL=http://10.0.2.2:3010/api/v1` trong `apps/mobile/.env.local` để app trỏ vào API demo.

### Tài khoản demo

| Vai | Email | Dùng ở bước |
| --- | --- | --- |
| Khách hàng | `customer@example.com` | 3.1, 3.5, 3.8 |
| Quản lý | `manager@example.com` | 3.2, 3.4, 3.6 |
| Điều phối | `coordinator@example.com` | 3.3 |
| Tài xế chuyến mới | `driver3@example.com` | 3.7 |
| Tài xế chuyến đang chạy | `driver@example.com` | 3.9 |
| Hộ tống chuyến đang chạy | `escort@example.com` | 3.9 |
| Chuyên viên | `specialist@example.com` | Câu hỏi thêm |
| Quản trị | `admin@example.com` | 3.10 |

### Dữ liệu có sẵn

| Đơn | Trạng thái | Dùng để |
| --- | --- | --- |
| `WDP-DEMO-AUTO-VN` | Đã duyệt, chờ lập kế hoạch | Tự lập lộ trình Hà Nội → TP.HCM: 8 điểm nghỉ, 2 đêm, đi hoàn toàn trong nước |
| `WDP-DEMO-AUTO-TH` | Đã duyệt, chờ lập kế hoạch, **chưa có số tờ khai** | Cửa khẩu Cầu Treo, Thakhek sang Thái Lan; luồng thông quan B13 |
| `WDP-DEMO-AUTO-CN` | Đã duyệt, chờ lập kế hoạch, đã có số tờ khai | Cửa khẩu Hữu Nghị. Tuyến xong trong ngày nên phải dời giờ giao sang hôm sau (quy định ngày giao khác ngày đi) |
| `WDP-DEMO-F4-A` | Đang vận chuyển | Tài xế, hộ tống, GPS, sự cố, chăm sóc ngựa, khách theo dõi |
| `WDP-DEMO-F4-NEW` | Chờ duyệt | Quản lý tiếp nhận, lập báo giá |
| `WDP-DEMO-F4-H1…H4` | Đã giao | Lịch sử, doanh thu |

Tổ lái rảnh để phân công: tài xế `Tài Xế Ba` và hộ tống `Hộ Tống Hai`. Xe rảnh: `29C-246.13` (2 ngăn), `51G-864.20` (9 ngăn).

## 2. Mở đầu (1 phút)

Giới thiệu: HorseRoute quản lý vận chuyển ngựa đua bằng đường bộ trong Việt Nam và sang Trung Quốc, Thái Lan. Hệ thống có 6 vai trò, chạy trên web và app Android, cùng một API.

## 3. Luồng chính

### 3.1 Khách đặt chuyến quốc tế (2 phút, `customer@example.com`)

1. Bấm "Đặt chuyến ngay", chọn "Quốc tế", chọn nước nhận Thái Lan.
2. Chọn ngựa, tới bước "Dịch vụ & bảo hiểm".
3. **Chỉ cho hội đồng:**
   - Mục "Thông quan (không bắt buộc, có thể bổ sung sau)" có cửa khẩu dự kiến, số tờ khai, giấy phép nhập khẩu.
   - Giải thích: số tờ khai thường chỉ có sau khi có giấy kiểm dịch, nên đặt đơn không bắt buộc.
   - Khung ước tính chi phí tính ngay theo bảng giá.
4. Không cần gửi đơn: đã có đơn mẫu `WDP-DEMO-F4-NEW` cho bước sau.

### 3.2 Quản lý tiếp nhận, báo giá (1 phút, `manager@example.com`)

Mở đơn `WDP-DEMO-F4-NEW` và lập dự toán theo bảng giá. Chỉ cho hội đồng các con số định dạng kiểu Việt Nam ("VAT 0%", "Đặt cọc 30%").

### 3.3 Điều phối tự lập lộ trình (5 phút, `coordinator@example.com`)

1. Mở chuyến của `WDP-DEMO-AUTO-VN`. Hệ thống tự lập, không phải nhập tay điểm nào. **Chỉ cho hội đồng:**
   - Hai đầu lấy từ địa chỉ trong đơn. Giờ xuất phát lấy theo ngày và khung giờ lấy ngựa khách chọn.
   - Điểm nghỉ cho ngựa sau khoảng 3 giờ 30 phút lái, không quá 4 giờ. Lý do: Điều 64 Luật Trật tự, an toàn giao thông đường bộ 2024 không cho lái liên tục quá 4 giờ, quá 10 giờ một ngày.
   - Nghỉ qua đêm khi đủ 10 giờ lái trong ngày, đi tiếp từ 05:00 sáng hôm sau.
   - Cách tính giờ đến dự kiến: lái × 1,25 cho xe tải, cộng bốc ngựa, nghỉ, dự phòng 1 giờ.
   - Tuyến đi hoàn toàn trong nước. Bản đồ công khai từng cho tuyến này đi tắt qua Lào; hệ thống tự kéo về Quốc lộ 1.
2. Mở chuyến của `WDP-DEMO-AUTO-TH`. **Chỉ cho hội đồng:**
   - Hệ thống tự chèn cặp cửa khẩu: "Đến cửa khẩu" (dừng 30 phút kiểm tra giấy tờ) và "Đã qua cửa khẩu".
   - Ô "Hành lang cửa khẩu" đổi được tuyến (qua Lào đường 8, đường 9, hoặc qua Campuchia).
3. Bấm **Lưu lộ trình**.
4. Bấm **Chọn phương tiện**, chọn `29C-246.13`, xác nhận.
5. Bấm **Chọn nhân sự**, chọn `Tài Xế Ba`, mở mục "Hộ tống", chọn `Hộ Tống Hai`, xác nhận.
6. Giờ đi, giờ đến đã được tự điền. Bấm **Lưu chặng và phân công**, rồi **Gửi duyệt**.
7. Nếu được hỏi: kế hoạch có đoạn lái liên tục quá 6 giờ không có điểm nghỉ thì không gửi duyệt được (B5).

### 3.4 Quản lý duyệt, bị chặn vì thiếu tờ khai (1 phút, `manager@example.com`)

1. Mở đơn `WDP-DEMO-AUTO-TH`, bấm **Duyệt đơn**, rồi **Bắt đầu vận chuyển**.
2. **Chỉ cho hội đồng:** hộp "Chuyển chuyến khi chưa có số tờ khai hải quan" hiện ra.
   - Quản lý chỉ chuyển được khi nêu lý do (lưu vào nhật ký).
   - Cùng cơ chế với trường hợp khách chưa đủ cọc (A5).
3. Bấm **Quay lại**.

### 3.5 Khách bổ sung số tờ khai (1 phút, `customer@example.com`)

Mở đơn `WDP-DEMO-AUTO-TH`. Ở thẻ **Thông quan**, bấm "Bổ sung thông tin thông quan", nhập `30512345678`, bấm **Lưu**. Điều phối viên nhận thông báo.

### 3.6 Quản lý chuyển chuyến (30 giây, `manager@example.com`)

Bấm lại **Bắt đầu vận chuyển**. Lần này không bị hỏi lý do, màn báo "Đã chuyển chuyến cho tài xế".

### 3.7 Tài xế nhận chuyến và qua cửa khẩu (3 phút, `driver3@example.com`, web hoặc app)

1. **Chỉ cho hội đồng trên màn chuyến:**
   - Các chặng có điểm nghỉ và cửa khẩu.
   - Mục **Giấy tờ thông quan**: số tờ khai, giấy phép, hộ chiếu từng con ngựa, nhắc bộ giấy cần mang.
   - Danh sách kiểm tra trước khi chạy.
2. Bấm **Bắt đầu chuyến đi**.
3. Check-in lần lượt: điểm nghỉ 1, rồi "Cửa khẩu Cầu Treo" (hộp xác nhận ghi "Đến cửa khẩu · kiểm tra giấy tờ"), rồi "đã qua cửa khẩu". Không check-in nhảy cóc được.
4. Thẻ "Đã chạy" đếm ngược tới lần nghỉ trễ nhất. Lái quá 4 giờ thì cảnh báo (B4).

### 3.8 Khách theo dõi (1 phút, `customer@example.com`)

Mở "Theo dõi hành trình" của `WDP-DEMO-AUTO-TH`. Khách thấy "Xe đang ở Cửa khẩu Cầu Treo, đang kiểm tra giấy tờ thông quan", rồi "Đã qua cửa khẩu". Khách không thấy GPS thật; lý do ở [quyet-dinh-gps-khach-hang.md](quyet-dinh-gps-khach-hang.md).

### 3.9 Chuyến đang chạy: tài xế, hộ tống (2 phút)

- **`driver@example.com`**, chuyến `WDP-DEMO-F4-A`:
  - Bản đồ có GPS, tốc độ, cảnh báo điều phối, báo sự cố.
  - GPS chỉ "LIVE" 2 phút sau khi seed. Muốn xe chạy thì chạy trình mô phỏng ở mục 4 của [demo-local.md](demo-local.md).
- **`escort@example.com`:**
  - Nhật ký chăm sóc (nước, ăn, nghỉ), báo cáo sức khỏe gửi khách.
  - Có lịch sử đính chính.

### 3.10 Bảo mật, quản trị (1 phút)

- **Khóa tạm (A2):** ở `/login`, nhập sai mật khẩu `customer2@example.com` 5 lần. Lần thứ 6 báo "Đăng nhập tạm khóa 15 phút; dùng Quên mật khẩu để mở ngay".
- **Quản trị (A3):** `admin@example.com` tạo tài khoản tài xế, khóa, mở khóa. Mọi thao tác ghi nhật ký.

## 4. Câu hỏi hội đồng hay hỏi

| Câu hỏi | Trả lời ngắn |
| --- | --- |
| Vì sao khách không xem được GPS? | Quyết định có chủ đích: riêng tư tổ lái, an toàn hàng giá trị cao. Xem [quyet-dinh-gps-khach-hang.md](quyet-dinh-gps-khach-hang.md) |
| Điểm nghỉ đặt theo căn cứ nào? | Luật TTATGTĐB 2024 (Điều 64): lái liên tục ≤ 4 giờ, ≤ 10 giờ/ngày. Mọi mốc là tham số hệ thống (`system_parameters`), đổi không cần sửa code |
| Bản đồ công khai lỗi thì sao? | Photon lỗi thì tự sang Nominatim (đều của OpenStreetMap); cả hai lỗi thì báo rõ và điều phối chọn điểm trên bản đồ. Production nên tự host OSRM, Photon |
| Cửa khẩu có nhận ngựa sống không? | Bản demo coi mọi cửa khẩu trong danh mục đều nhận và kiểm giấy tờ khoảng 30 phút (H4). Xác minh từng cửa khẩu là việc khi mở rộng dự án |
| Thanh toán thật chưa? | VNPay Sandbox đã chạy một giao dịch thật qua IPN (A1). Ở production, chế độ mô phỏng bị tắt |
| Phân quyền làm thế nào? | Máy chủ đọc vai trò từ DB, không tin vai trò trong token. Điều phối chỉ thấy chuyến mình phụ trách, tài xế chỉ thấy chuyến được phân công; có test chứng minh |
| Test ra sao? | 215 test đơn vị API, 21 bộ test tích hợp MySQL, 73 test app, E2E 23 chặng từ đăng ký tới giao ngựa trên trình duyệt thật, CI chạy tự động |

## 5. Khi demo gặp sự cố

| Sự cố | Cách xử lý |
| --- | --- |
| Tự lập báo "Dịch vụ bản đồ công khai đang chậm…" | Bấm "Lập lại tự động" sau 1 phút. Nếu vẫn lỗi: ở "Điểm gửi", "Điểm nhận" bấm "Chọn trên bản đồ" rồi bấm "Lập lại tự động" (hai đầu đã có tọa độ thì không cần tra địa chỉ) |
| Mất mạng | Dùng chuyến đã lập ở bước làm nóng (đã lưu thì mở lại vẫn thấy). Phần còn lại (đơn, báo giá, tài xế, khách) không cần mạng ngoài |
| Bị đăng xuất giữa chừng | Mỗi vai một tab ẩn danh; đăng nhập lại mất 10 giây |
| Cần làm lại từ đầu | Chạy lại seed (mục 1.1), khởi động lại `pnpm dev:api:demo` |
| Lỡ khóa tài khoản khi demo A2 | Đợi 15 phút, dùng "Quên mật khẩu", hoặc chạy lại seed. Không demo A2 bằng tài khoản dùng ở bước khác |

## 6. Kết quả tập ngày 12/11/2026

Đã tập trên web với dữ liệu seed mới (MySQL tạm, bản đồ thật): 3.3 → 3.4 → 3.5 → 3.6 → 3.7 (xem màn chuyến) đều chạy đúng. Các bước 3.7 (check-in cửa khẩu) và 3.8 đã thử ngày 12/11 khi kiểm phần tự lập lộ trình.

Lỗi tìm được khi tập, đã sửa cùng ngày:

- **Photon công khai mất khoảng 30 giây mỗi lần tra**, nên tự lập lộ trình báo lỗi. Đã sửa:
  - Thêm dự phòng Nominatim cho tra hai đầu tuyến, tên địa danh, và quãng đường lúc khách đặt đơn.
  - Thêm "cầu dao": Photon lỗi một lần thì 5 phút tới đi thẳng sang Nominatim.
  - Câu báo lỗi nói đúng nguyên nhân là dịch vụ bản đồ, không còn ghi "không tìm thấy địa chỉ".
  - Thời gian tự lập khi Photon chậm: lần đầu khoảng 25 giây, lần sau khoảng 5 giây.
- **Seed:**
  - Thêm 3 đơn chờ lập kế hoạch, một tổ lái và một xe rảnh.
  - Người nhận và quãng đường của từng đơn demo trước đây lấy nhầm từ đơn mẫu khác.
  - Chọn đơn đi Thái Lan (đi nhiều ngày) làm đơn thiếu tờ khai, để luồng B13 không vướng quy định ngày giao khác ngày đi.
- **Câu chữ:** tiêu đề trang và trang chủ còn "Thailand" ở câu tiếng Việt, đã đổi thành "Thái Lan".

Chưa tập: app Android trên máy ảo hoặc máy thật (mục 1.6), thanh toán VNPay Sandbox trong buổi demo.
