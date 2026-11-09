# 13 — Tiến độ tổng hợp mobile, đọc file này đầu phiên làm việc mới

Cập nhật ngày 09/11/2026. Mở đầu phiên sau chỉ cần nói việc muốn làm ở mục 2, ví dụ "làm tiếp kế hoạch 10".

## 0a. Nhãn Hoàng Sa, Trường Sa trên bản đồ mobile (ngày 09/11/2026)

**Trạng thái: code xong, đã thử trên máy ảo `Pixel_9a`, đã commit trên nhánh worktree, chưa đưa vào `long`.** Làm trong worktree `.claude/worktrees/bold-fermi-e646ed`, nhánh `claude/bold-fermi-e646ed`, đã đặt lại về `long` commit `1190b5c`. Commit `a6bd015` (sửa deploy Vercel) có trên `main`, chưa có trên `long`.

**Lỗi:** tile OpenFreeMap bản `20261101` có "Tam Sa", "Quận Tây Sa", "Quận Nam Sa", "Kalayaan", "Yongle Qundao", chữ Hán, và các vòng ranh giới nước khác quanh đảo.

**Đã làm:**

- `apps/mobile/src/map/map-labels.ts` (mới): ẩn mọi nhãn và ranh giới trong vùng ẩn, thêm nhãn "Quần đảo Hoàng Sa (Việt Nam)" tại [112, 16.5] và "Quần đảo Trường Sa (Việt Nam)" tại [114.3, 10]. `tune` trong `map-html.ts` gọi `localizeLabels`. CSP không đổi.
- Vùng ẩn có 3 polygon: hai vùng đã thử trên web, thêm vùng biển giữa hai quần đảo (lng 110–113.2, lat 10.4–15.8) vì ở đó còn khoảng 15 tên đáy biển chữ Hán.
- Chuyển các lớp `boundary_*` xuống ngay dưới lớp `water`: ở z5 `within` không ẩn được vòng quanh Trường Sa, vì tile gộp vòng đó chung một feature với đoạn trên Palawan. Hệ quả: đoạn biên giới chạy giữa sông, hồ lớn bị mặt nước che; chưa soi riêng ở zoom cao.
- `apps/mobile/tests/map-labels.test.ts` (mới).

**Kết quả kiểm thử:**

- Test mobile 68/68, `tsc` không báo lỗi, `style-spec` của MapLibre không báo lỗi trên style Liberty thật. Metro build được bundle Android có đoạn code mới.
- Trình duyệt, trang `mapHtml` thật: Hoàng Sa và Trường Sa ở z5, z8, z10 chỉ còn nhãn Việt Nam, không còn vòng ranh giới. Hải Nam, Palawan, biên giới đất liền còn nguyên. Không có vi phạm CSP.
- Máy ảo `Pixel_9a` (Expo Go, `TripMapView` và WebView thật, tile thật, sáng và tối): Hoàng Sa, Trường Sa ở z5, z8, z10 chỉ còn nhãn Việt Nam, không còn vòng ranh giới, đảo vẫn hiện. Hải Nam, Palawan còn nhãn và ranh giới. Bản đồ không rơi về sơ đồ dự phòng.
- Cách thử trên máy ảo: entry tạm (đã xóa) đưa chuyến giả vào `TripMapView`, góc nhìn do fit theo điểm dừng, không vuốt phóng to bằng tay, không đăng nhập. Lý do: API chỉ nối DB chung, không được test trên đó.
- Khởi động emulator từ shell phải tách tiến trình (`Start-Process` của PowerShell). Chạy nền qua Bash thì emulator tự thoát với mã 0.

**Việc tiếp theo, theo thứ tự:**

1. Long yêu cầu thì đưa nhánh `claude/bold-fermi-e646ed` vào `long`.
2. Web nhiều khả năng cũng còn tên đáy biển chữ Hán và vòng ranh giới ở zoom thấp (mới đọc code, chưa thử trên web): `apps/web/src/features/trackmap/map-labels.ts`, nhánh `claude/map-display-mapbox-token-3e39a1`.

## 0. Kế hoạch 10 với thanh toán mô phỏng (ngày 06/11/2026)

**Trạng thái: code và tài liệu xong, đã có trên `long` (máy và GitHub); chưa merge vào `dev`, `main`.** Làm trong worktree `.claude/worktrees/claude-code-docker-running-d4ddbb`, nhánh `claude/progress-13-payment-simulation-f07217`, dựng từ `long` commit `6c3b2a4`. 

**Long đã quyết định:** tạm dùng thanh toán mô phỏng. Khi có khóa VNPay Sandbox thì thiết kế lại phần cổng thanh toán. Phần 12 đã xong về code, chỉ còn kiểm tra trên máy thật. Câu 3, 4 mục 11 file 10 đang theo đề xuất, Long chưa xác nhận rõ.

**Đã làm:**

- API: migration `1800000093000-DeliveryExceptions` (loại sự cố `DELIVERY_ISSUE`, bảng `delivery_exceptions`, người nhận thực tế ở `leg_milestones`). Đã chạy trên DB chung ngày 06/11/2026.
- API: mốc `DELIVERED` và hiệu chỉnh chặng trả `402` khi chưa trả đủ; `paymentCleared`, `deliveryExceptionReason` trong dữ liệu chuyến; `/tracking/orders/:id/delivery-clearance`, `/delivery-exception`, `/delivery-exception/open`; thông báo khi xe tới mà chưa đủ tiền và khi đã trả đủ; dùng lại phiên mô phỏng còn hạn.
- Mobile khách: `paymentAction`, CUS-04, màn `PaymentScreen` mô phỏng (CUS-17, CUS-18), thẻ đặt cọc, thanh toán, khẩn ở trang chủ. Thẻ đặt cọc không còn hiện khi báo giá hết hạn.
- Mobile tổ lái: "Chờ khách thanh toán", "Kiểm tra lại", tự hỏi lại 15 giây, báo sự cố giao ngựa, "Người khác nhận thay"; chỉ báo đã giao và tắt GPS sau khi máy chủ nhận; hàng chờ xử lý `402`.
- Web: tài xế có trạng thái chờ; `DeliveryExceptionPanel` cho quản lý (duyệt) và điều phối (mở); form sự cố có loại Giao ngựa; hiện người nhận thực tế ở chi tiết chuyến.

**Kết quả kiểm thử:**

- `tsc` sạch ở api, web, mobile. Test API 180/180, test mobile 59/59.
- `e2e-api.mts` trên MySQL dùng một lần: 42/42, gồm 14 ca mới.
- Máy ảo Android: đặt cọc, thất bại rồi thử lại, màn chờ của tài xế, thông báo đã trả đủ, sự cố giao ngựa, giao với người nhận thay: đạt.
- Web, trình duyệt: quản lý duyệt, điều phối mở, màn chờ của tài xế, dòng "Điều phối cho phép giao", form sự cố Giao ngựa, tài xế xác nhận giao: đạt.
- Màn tự chuyển trang thấy ở lần thử trước: không tái hiện được. Để yên màn chờ hơn 70 giây và khách trả tiền lúc đang mở, màn vẫn đứng yên, code điều hướng chỉ chạy khi có thao tác chạm. Nhiều khả năng do có người chạm máy ảo, chưa khẳng định chắc.

**Còn mở:**

- Test trình duyệt của web (`apps/web/test/**/*.browser.cjs`) đều lỗi timeout, trang trắng. `driver-trip` lỗi y hệt trên `long` sạch nên không do phần này; các file khác chưa so với `long`. Nguyên nhân chưa tìm. Playwright không có trong `package.json`, cần đặt `PLAYWRIGHT_PACKAGE`.
- Mockup HTML trong `ui/` chưa vẽ CUS-17, CUS-18 và màn chờ của tài xế.
- Ảnh bàn giao chưa gắn vào mốc giao: tài xế gửi qua sự cố giao ngựa.
- Chưa có nút thu hồi ngoại lệ đã duyệt. Mỗi đơn chỉ có một ngoại lệ.
- Khi còn mô phỏng, khách vẫn tự xác nhận đã trả được, nên quy tắc giao có thể bị lách (mục 2 file 10). Phải tắt khi chuyển sang VNPay.

**Việc tiếp theo, theo thứ tự:**

1. Migration `DeliveryExceptions` đã chạy trên DB chung ngày 06/11/2026. Lúc đó cả 3 đơn đang hoạt động còn nợ nên bị chặn ở bước giao cho tới khi trả đủ hoặc có ngoại lệ: `VCN-20261025-0002` (READY), `VCN-20261026-0001` (IN_TRANSIT, đang dừng), `VCN-20261030-0002` (READY).
2. Khi Long có khóa VNPay Sandbox: làm giai đoạn 1 và 2 file 10 phần cổng thật.

**Dựng lại môi trường thử** (đã xóa sau phiên này):

- `docker run` `mysql:8.0` cổng 33077 và `redis:7-alpine` cổng 63790. DB `wdp` phải tạo với `utf8mb4_unicode_ci`, nếu không migration `CustomerProfiles` lỗi collation.
- Nạp riêng các lệnh `CREATE TABLE` của `apps/api/test/fixtures/schema.sql`, rồi `pnpm typeorm migration:run -t none`.
- Đặt sẵn mọi biến `DB_*`, `REDIS_*`, `JWT_SECRET`, `CORS_ORIGIN`, `PORT=3100`, rồi trong `apps/api` chạy `npx ts-node --files src/index.ts`.
- E2E, trong `apps/mobile`: `E2E_API_URL=http://127.0.0.1:3100/api/v1 E2E_DB_PORT=33077 E2E_DB_PASSWORD=<mật khẩu thử> node --experimental-strip-types scripts/e2e-api.mts`.
- Metro: đặt `EXPO_PUBLIC_API_URL=http://10.0.2.2:3100/api/v1`, chạy `npx expo start --go --localhost --port 8090`, rồi `adb reverse tcp:8090 tcp:8090`.
- Web: `VITE_API_URL=http://127.0.0.1:3100/api/v1 npx vite --port 5190 --strictPort --host 127.0.0.1`, và `CORS_ORIGIN=http://127.0.0.1:5190` ở API.

## 1. Đã hoàn thành

| Việc | Kết quả | Chi tiết |
| --- | --- | --- |
| Sửa lỗi mobile | Xong, migration `ClientRequestIds` đã chạy trên DB chung | [09-test-va-sua-loi.md](09-test-va-sua-loi.md) |
| Làm lại tạo đơn 4 bước theo web | Xong, đơn từ mobile quản lý duyệt và báo giá được | [11-tao-don-mobile-plan.md](11-tao-don-mobile-plan.md) |
| Bản đồ và theo dõi chuyến | Xong trên máy ảo Android: MapLibre + OpenFreeMap, không cần token | [12-ban-do-theo-doi-mobile-plan.md](12-ban-do-theo-doi-mobile-plan.md), mục 11 |
| Chỉnh giao diện: thanh điều hướng, hồ sơ, bộ lọc, bo góc | Xong | [changelog.md](changelog.md), U-01 đến U-08 |
| CI: lockfile, lỗi kiểu React của web, schema test nạp thêm migration | Xong, các bước trước flow3 đều qua khi chạy trên máy | Commit `a2d078e` |

## 2. Chưa làm

**Đã sửa và có trên `long`:** 4 lỗi và 6 chỗ chỉnh giao diện sau khi test trên máy ảo, kết quả ở [14-sua-loi-sau-test-may-ao.md](14-sua-loi-sau-test-may-ao.md), mục 9.

### Việc lớn

1. **Cổng VNPay Sandbox thật.** Xử lý khi giao ngựa và thanh toán mô phỏng đã làm, xem mục 0. Cần Long có khóa sandbox, tự đặt vào `.env`, không gửi qua chat. Xem [10-thanh-toan-mobile-plan.md](10-thanh-toan-mobile-plan.md), bắt đầu từ mục 0.
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
