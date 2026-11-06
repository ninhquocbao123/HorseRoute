# 13 — Tiến độ tổng hợp mobile, đọc file này đầu phiên làm việc mới

Cập nhật ngày 06/11/2026. Mở đầu phiên sau chỉ cần nói việc muốn làm ở mục 2, ví dụ "làm tiếp kế hoạch 10".

## 1. Đã hoàn thành

| Việc | Kết quả | Chi tiết |
| --- | --- | --- |
| Sửa lỗi mobile | Xong, migration `ClientRequestIds` đã chạy trên DB chung | [09-test-va-sua-loi.md](09-test-va-sua-loi.md) |
| Làm lại tạo đơn 4 bước theo web | Xong, đơn từ mobile quản lý duyệt và báo giá được | [11-tao-don-mobile-plan.md](11-tao-don-mobile-plan.md) |
| Bản đồ và theo dõi chuyến | Xong trên máy ảo Android: MapLibre + OpenFreeMap, không cần token | [12-ban-do-theo-doi-mobile-plan.md](12-ban-do-theo-doi-mobile-plan.md), mục 11 |
| Chỉnh giao diện: thanh điều hướng, hồ sơ, bộ lọc, bo góc | Xong | [changelog.md](changelog.md), U-01 đến U-08 |
| CI: lockfile, lỗi kiểu React của web, schema test nạp thêm migration | Xong, các bước trước flow3 đều qua khi chạy trên máy | Commit `a2d078e` |

## 2. Chưa làm

### Việc lớn

1. **Thanh toán VNPay Sandbox và xử lý tình huống khi giao ngựa.** Đã chốt hướng, chưa code. Cần Long có khóa sandbox, tự đặt vào `.env`, không gửi qua chat. Xem [10-thanh-toan-mobile-plan.md](10-thanh-toan-mobile-plan.md), bắt đầu từ mục 0.
2. **Cho CI trên `main` xanh.** CI đang đỏ ở `flow3-read.mysql.cjs` và `flow4-tracking.mysql.cjs`, vì test còn viết theo API và schema cũ, chưa thấy là lỗi của code:
   - flow3: 32/49 ca hỏng. Test gửi `vehicleId` theo từng chặng và danh sách `assignments` phẳng, API đã đổi sang phân xe và nhân sự theo từng xe. Phải viết lại khoảng 470 dòng trong `apps/api/test/trips-*-checks.cjs`, nên có Tiến xem cùng để chốt ca nào còn đúng nghiệp vụ.
   - flow4: 5/26 ca hỏng. Ba ca gửi báo cáo sự cố thiếu ảnh hoặc sai trường, một ca timeline do sự cố nhỏ chưa đóng, một ca migration `EscortHorseCare` không drop được bảng vì khóa ngoại. Chưa xem kỹ nên chưa loại trừ lỗi thật.
   - Các file `locations.mysql.cjs`, `vehicles.mysql.cjs`, `trips-*-checks.cjs`, `seed-flow4-demo.cjs` vẫn dùng cột cũ `plate_or_code`, `is_active`. Không xóa flow3, flow4 khỏi CI để cho xanh.

### Cần Long kiểm tra trên máy thật

Claude không làm được các việc này.

- Bản đồ trên iPhone thật và Android thật: có chạy không, độ mượt, pin và độ nóng khi bật bám xe khoảng 30 phút.
- Màu bản đồ mobile so với web. Web vẫn dùng Mapbox nên sẽ khác đôi chút.
- GPS nền khi tắt màn hình: Expo Go không chạy được, cần bản build riêng.
- Bấm thử giao diện web sau các thay đổi gần đây; hiện mới build và chạy test tự động.

### Việc nhỏ

- Chưa kiểm tra trên bản đồ: TalkBack, cỡ chữ hệ thống lớn, chặng bay.
- Kiểu của `react-native-webview` 14 chưa khớp RN 0.88, đang ép kiểu ở một chỗ trong `apps/mobile/src/map/TripMapView.tsx`.
- Mockup HTML trong `docs/mobile-design/ui/` chưa vẽ lại theo bản đồ thật và tạo đơn mới.
- Tính quãng đường báo sai "Chưa kết nối được dịch vụ bản đồ" với điểm ở đảo như Côn Đảo.
- Thẻ "Đặt cọc cho..." ở trang chủ từng hiện với báo giá đã hết hạn. Cần kiểm tra lại xem còn không.
- Đổi bản đồ web sang MapLibre: chưa làm, để sau nếu muốn web và mobile giống hệt.

### Trước ngày demo

API vẫn dùng `MAPBOX_ACCESS_TOKEN` để tìm địa chỉ và tính tuyến mới, kể cả khi bản đồ mobile không cần token. Danh sách chuẩn bị ở mục 8 file 12: kiểm tra trước trên đúng máy, kiểm tra token, dùng chuyến đã lưu tuyến, mang 4G và video dự phòng.

## 3. Trạng thái nhánh

| Nhánh | Commit | Có gì |
| --- | --- | --- |
| `long` (máy và GitHub) | Mới nhất, có file này | Đủ mọi thứ ở mục 1 |
| `dev`, `main` trên GitHub | `992be3b` | Chưa có sửa CI và bản đồ; muốn đưa lên phải merge từ `long` |

Worktree: `.claude/worktrees/test-sua-loi-file-09-d56b37`, nhánh `claude/test-sua-loi-file-09-d56b37`. Thư mục chính ở nhánh `long`. Cách làm: commit trong worktree, fast-forward `long`, rồi push.

## 4. Ghi nhớ khi làm tiếp

- Commit với tác giả `longptse180728`, không ghi Claude; nội dung dạng `[dd.mm.yyyy][Long - ...]`.
- DB chung `wdp` là dữ liệu của nhóm: chỉ đọc nếu không được yêu cầu, không chạy test trên đó. Test dùng MySQL Docker riêng, API cổng 3100, Metro cổng 8090.
- Thêm thư viện vào mobile thì cập nhật **cả** `apps/mobile/package-lock.json` và `pnpm-lock.yaml`, không thì CI hỏng ở `--frozen-lockfile`.
- Đổi phiên bản `maplibre-gl` thì chạy `npm run map:vendor` trong `apps/mobile`.
- `pnpm build` trên Windows báo "No projects matched" mà không build `api`, `web`: phải build riêng bằng `pnpm --filter <tên> build`.
- Giả lập GPS trên máy ảo: `adb emu geo fix <lng> <lat> 10 8 <knot>`. Expo Go có quyền vị trí riêng theo từng dự án, `pm grant` không đủ.
