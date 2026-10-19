# Hướng dẫn thử Flow 4 trên giao diện

Mục tiêu: chạy thử toàn bộ Flow 4 (ghi mốc, nhật ký ngựa, sự cố, cảnh báo, hiệu chỉnh, timeline) bằng các tài khoản có mật khẩu đã biết, **không đụng vào database cloud dùng chung của nhóm**.
Cách làm: dùng một MySQL riêng trên máy bạn (Docker, cổng 33061) và dữ liệu mẫu có sẵn.

Luồng này đã được chạy thử tự động từ giao diện qua API thật và MySQL thật (13 bước, không lỗi).

## A. Chuẩn bị (làm một lần mỗi lần thử)

Mở PowerShell tại thư mục gốc dự án (`HorseRoute`).

**1. Dừng API đang chạy ở cổng 3000** (nhấn `Ctrl+C` trong cửa sổ `pnpm start:dev` cũ).

**2. Bật MySQL riêng cho bản demo** (đợi khoảng 20 giây cho MySQL khởi động):
```powershell
docker run -d --rm --name wdp-flow4-demo-mysql -p 127.0.0.1:33061:3306 -e MYSQL_ROOT_PASSWORD=demo mysql:8.0
```

**3. Tạo dữ liệu mẫu** (chạy lại lệnh này bất cứ lúc nào để đưa dữ liệu về trạng thái ban đầu; khi đó phải khởi động lại API ở bước 4):
```powershell
cd apps/api
$env:DEMO_DB_PORT='33061'; $env:DEMO_DB_PASSWORD='demo'
node scripts/seed-flow4-demo.cjs
```
Script chỉ chạy với MySQL trên máy bạn và chỉ đụng tới database `wdp_flow4_demo`.

**4. Chạy API trỏ vào database demo** (cùng cửa sổ PowerShell, vẫn ở `apps/api`):
```powershell
$env:DB_HOST='127.0.0.1'; $env:DB_PORT='33061'; $env:DB_NAME='wdp_flow4_demo'
$env:DB_USER='root'; $env:DB_PASSWORD='demo'; $env:DB_SSL='false'; $env:DB_SSL_CA_PATH=''
$env:DOCUMENT_STORAGE_PROVIDER='local'
pnpm start:dev
```
`DOCUMENT_STORAGE_PROVIDER='local'` quan trọng: nếu bỏ, ảnh bạn tải lên sẽ đi vào kho Supabase thật của nhóm (do `.env` đang đặt `supabase`). Ảnh demo được lưu ở `apps/api/var/private-documents` (không đưa lên git).

**5. Chạy giao diện** (cửa sổ PowerShell khác, tại thư mục gốc):
```powershell
pnpm dev:web
```
Mở http://localhost:5173/login.

**Mẹo:** để thử giao diện điện thoại, mở DevTools (`F12`) → bật Device Toolbar (`Ctrl+Shift+M`) → chọn 390 px. Dùng cửa sổ ẩn danh hoặc trình duyệt khác cho mỗi vai trò để đăng nhập song song.

## B. Tài khoản (mật khẩu tất cả: `Demo@12345`)

| Vai trò | Email | Dùng để |
|---|---|---|
| Driver | `driver@example.com` | Luồng chính (chuyến #200) |
| Escort | `escort@example.com` | Cùng chuyến #200 |
| Coordinator | `coordinator@example.com` | Điều phối chuyến #200 |
| Manager | `manager@example.com` | Xem tất cả |
| Specialist | `specialist@example.com` | Chỉ đọc |
| Customer | `customer@example.com` | Chủ đơn A và C |
| Customer 2 | `customer2@example.com` | Chủ đơn B (thử cô lập) |
| Driver khác | `driver2@example.com` | Chuyến #201 (thử cô lập) |
| Coordinator khác | `coordinator2@example.com` | Điều phối chuyến #201 (thử cô lập) |

Dữ liệu mẫu: **đơn A** `WDP-DEMO-F4-A` (READY, chuyến #200 đã duyệt, 3 ngựa, 2 chặng; chặng 1 đến **cửa khẩu**), **đơn B** (của khách khác, chuyến của điều phối viên khác), **đơn C** (kế hoạch chưa duyệt).

## C. Kịch bản thử

### 1. Customer: trước khi xuất phát
Đăng nhập `customer@example.com` → menu **Theo dõi hành trình**.
- Danh sách đơn chỉ có **A và C** (không có B).
- Chọn A: có 2 chặng, cả hai **Chưa bắt đầu**, chưa có dòng "Cập nhật lần cuối".
- Chọn C: hiện câu giải thích "Lịch trình chi tiết sẽ hiển thị sau khi kế hoạch…", không có chặng nào.

### 2. Driver (điện thoại 390 px): xuất phát
Đăng nhập `driver@example.com` → **Chuyến của tôi**.
- Thấy thẻ `WDP-DEMO-F4-A`: 3 ngựa, xe, tuyến; **không** thấy đơn B.
- Bấm **Cập nhật mốc** → có **một nút lớn** `XÁC NHẬN XUẤT PHÁT` → bấm → bấm **Xác nhận** (2 lần chạm).
- Nút đổi thành `ĐÃ ĐẾN TRẠM DỪNG`. Giờ ghi nhận mặc định là lúc bạn bấm.

### 3. Driver: nhật ký ngựa
Menu **Nhật ký ngựa**.
- Chọn ngựa **Bạch Mã**, bấm **Bỏ ăn**, gõ ghi chú, bấm **Chụp / chọn ảnh** và chọn một ảnh JPG/PNG (≤ 5 MB, tối đa 3 ảnh) → **GỬI NHẬT KÝ**.
- Có thông báo "Đã lưu nhật ký ngựa", bản ghi hiện ở danh sách kèm ảnh thu nhỏ.
- Bấm **Đính chính bản ghi này** → chọn **Ổn định** → gửi: bản mới ghi "đính chính bản #…". Bản cũ vẫn còn nguyên (nhật ký không sửa/xoá được).

### 4. Driver: báo sự cố khẩn cấp
Bấm nút đỏ **BÁO SỰ CỐ KHẨN CẤP**.
- Chọn **Y tế ngựa**, mô tả, **không chọn ngựa** → gửi: báo lỗi "chọn con ngựa bị ảnh hưởng".
- Chọn ngựa, đính kèm ảnh → gửi: thông báo "Đã báo sự cố KHẨN…".

### 5. Manager và Specialist: xem vận hành
- `manager@example.com` → **Tiến độ vận hành**: 3 thẻ (đang vận chuyển = 1, sự cố chưa đóng = 1, trễ hạn = 0); chuyến có nhãn đỏ **1 sự cố khẩn**.
  - Tab **Sự cố hành trình**: xem được nhưng **không có** nút Tiếp nhận/Đóng.
  - Tab **Nhật ký ngựa**: thấy bản ghi của bước 3.
  - Có nút **Hiệu chỉnh mốc** (Manager được phép).
- `specialist@example.com` → **Theo dõi thông quan**: dòng "Bạn xem ở chế độ chỉ đọc", **không có** tab Sự cố và không có nút Hiệu chỉnh.

### 6. Coordinator: sự cố, cảnh báo, hiệu chỉnh
Đăng nhập `coordinator@example.com` → **Điều hành vận hành** (không phải "Chuyến vận chuyển", mục đó là Flow 3).
- Tab **Sự cố hành trình**: thấy ảnh Driver đã đính kèm. Bấm **Tiếp nhận**. Bấm **Đóng sự cố** → để trống → báo "Cần ghi hướng xử lý" → nhập ghi chú → đóng. Dòng "Đã xử lý lúc …" hiện ra.
- Tab **Cảnh báo**: chọn **Thời tiết**, nhập nội dung, **Gửi cảnh báo**.
- Tab **Tiến độ** → **Hiệu chỉnh mốc** ở chặng 1: chọn **Đã đến điểm dừng**, bấm Lưu khi chưa nhập lý do → báo "Lý do hiệu chỉnh là bắt buộc"; nhập lý do → lưu thành công.

### 7. Driver: hoàn tất hành trình
Đăng nhập lại Driver → **Mốc hành trình**.
- Đầu trang thấy **cảnh báo thời tiết** của điều phối viên.
- Vì chặng 1 là cửa khẩu, các nút lần lượt là: `ĐÃ THÔNG QUAN` → `HOÀN THÀNH CHẶNG` → (chặng 2) `XÁC NHẬN XUẤT PHÁT` → `ĐÃ ĐẾN ĐIỂM ĐÍCH` → `ĐÃ GIAO NGỰA AN TOÀN`. Mỗi lần: bấm nút lớn rồi **Xác nhận**.
- Cuối cùng hiện "Tất cả các chặng đã hoàn thành".

### 8. Customer: kết quả
`customer@example.com` → **Theo dõi hành trình** → đơn A:
- Trạng thái **Đã giao**, cả 2 chặng màu xanh, mỗi chặng có các mốc và giờ.
- Dòng "Cập nhật lần cuối lúc … bởi Tài Xế Demo".
- Menu **Thông báo** có các tin: khởi hành, tiến độ chặng, đã giao ngựa an toàn.

### 9. Cô lập quyền
- `customer2@example.com` → Theo dõi hành trình: chỉ thấy đơn **B**.
- `driver2@example.com` → Chuyến của tôi: chỉ thấy đơn **B**.
- `coordinator2@example.com` → Điều hành vận hành: không thấy chuyến #200.

## D. Các tình huống lỗi nên thử thêm

| Làm gì | Kết quả đúng |
|---|---|
| Driver: bấm "Nhập bù giờ đã xảy ra", chọn giờ cách đây hơn 2 giờ | Báo "Đã vượt quá thời gian cho phép nhập bù (120 phút)…" |
| Driver: ô giờ nhập bù | Không chọn được giờ trong tương lai |
| DevTools → Network → **Offline**, rồi Driver bấm Xác nhận một mốc | Báo "Mất kết nối mạng…", sheet vẫn mở. Bỏ Offline, bấm **Gửi lại** → gửi đúng giờ đã chốt lúc bấm |
| Offline, rồi đóng sheet | Xuất hiện khung vàng "Có thao tác chưa gửi được" kể cả sau khi tải lại trang |
| Nhật ký ngựa: gõ ghi chú, tắt mạng, gửi, tải lại trang | Ghi chú vẫn còn (ảnh phải chọn lại) |
| Thu nhỏ trình duyệt về 360–430 px | Không tràn ngang; mọi nút cao ≥ 44 px |
| Thao tác liên tục rất nhanh | Báo "Bạn thao tác quá nhanh…" (API giới hạn 100 request/phút/IP) |

## E. Dọn dẹp
- `Ctrl+C` ở cửa sổ API và cửa sổ web.
- `docker stop wdp-flow4-demo-mysql` (container tự xoá vì có `--rm`).
- Đóng cửa sổ PowerShell đã đặt biến môi trường, hoặc mở cửa sổ mới. Lần sau chạy API bình thường sẽ lại dùng database trong `.env`.

## F. Lỗi thường gặp
- **Trang trắng ở `/dashboard`:** dev server Vite đôi khi giữ cache file rỗng trên Windows. Dừng `pnpm dev:web` và chạy lại (có thể thêm `--force`).
- **API lỗi `EAI_AGAIN`:** máy không phân giải được tên máy chủ MySQL (khi dùng database cloud). Thử lại sau; với bản demo không gặp lỗi này vì dùng `127.0.0.1`.
- **`EADDRINUSE` cổng 3000:** vẫn còn một API cũ đang chạy; tắt nó trước.
- **Không đăng nhập được:** chắc chắn API đang chạy với biến môi trường của bước A4 (database `wdp_flow4_demo`); tài khoản demo không tồn tại trong database cloud.
- Muốn thử lại từ đầu: chạy lại bước A3 rồi khởi động lại API (A4).
