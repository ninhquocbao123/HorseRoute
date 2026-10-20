# Tiến độ: Bản đồ theo dõi đơn + GPS (Mapbox)

Cập nhật: 20/10/2026 · Nhánh: `feature/trackmap` · Kế hoạch gốc: [ke-hoach-ban-do-gps.md](ke-hoach-ban-do-gps.md) · Thiết kế: [thiet-ke-theo-doi-ban-do-mapbox.md](thiet-ke-theo-doi-ban-do-mapbox.md)

## Tóm tắt

| Bước | Nội dung | Trạng thái |
|---|---|---|
| 0 | Chuẩn bị: thư viện Mapbox, biến môi trường | ✅ Xong, đã commit `71e456f` |
| 1 | Dữ liệu: tọa độ địa điểm, bảng `location_routes`, `trip_positions` | ✅ Xong, **đã chạy trên Aiven** |
| 2 | API quản lý địa điểm cho Specialist | ✅ Xong |
| 3 | Giao diện "Địa điểm & cửa khẩu" + lớp bản đồ dùng chung | ✅ Xong, đã kiểm với Mapbox thật |
| 4 | Backend bản đồ (hình học, cache tuyến, 3 API `/map`) | ⏳ Chưa làm (bước tiếp theo) |
| 5 | Giao diện bản đồ cho các vai trò | ⏳ Chưa làm |
| 6 | GPS thời gian thực (desktop + mô phỏng) | ⏳ Chưa làm |
| 7 | Kiểm thử tổng, tài liệu | ⏳ Chưa làm |

Trạng thái git: Bước 0 đã commit; đã merge `origin/main` (commit `d0269ae`). **Bước 1–3 và phần thiết kế lại giao diện Driver chưa commit** (đang nằm trong thư mục làm việc của nhánh).

## Thứ tự merge bắt buộc

Code nhánh này đọc cột `locations.latitude/longitude` (cả ở `GET /trips/:id/plan-options` của Flow 3). Migration trên Aiven **đã chạy** ngày 20/10/2026, nên merge nhánh vào `dev` không còn làm lỗi 500. Nếu dựng DB mới ở nơi khác, phải chạy `pnpm migration:run` trước khi chạy code nhánh này.

## Bước 0. Chuẩn bị ✅

- `apps/web`: `mapbox-gl@^3.33.0`, `react-map-gl@^8.1.3` (import `react-map-gl/mapbox`).
- `apps/web/src/vite-env.d.ts`: kiểu cho `VITE_MAPBOX_TOKEN`, `VITE_MAP_ENABLED`, `VITE_MAP_STYLE`.
- API (`env.validation.ts`): `MAPBOX_ACCESS_TOKEN` (tuỳ chọn), `TRACK_POSITION_RETENTION_DAYS` (mặc định 30).
- Token trong `apps/web/.env` là token public (`pk.`), Mapbox trả 200. API **chưa** đặt `MAPBOX_ACCESS_TOKEN` (Bước 4 sẽ cần; dùng lại token `pk.` được).

## Bước 1. Dữ liệu ✅

- `1800000005000-LocationCoordinates.ts`: thêm `latitude/longitude DECIMAL(9,6) NULL` + 3 CHECK (khoảng vĩ độ, kinh độ, cùng có/cùng trống); nạp tọa độ 20 địa điểm (khớp `name`+`country`, chỉ khi đang trống). `down()` báo lỗi để không mất tọa độ Specialist đã ghim.
- `1800000006000-TrackMap.ts`:
  - `location_routes`: `coordinates` JSON `[[lng,lat],...]`, `mode` ROAD/AIR/STRAIGHT, `fetched_at`; khóa ngoại **ON DELETE CASCADE** (cache, không chặn xóa địa điểm).
  - `trip_positions`: khóa duy nhất `(trip_id, user_id, recorded_at)` để gửi bù không tạo điểm trùng; `accuracy_m` kiểu INT (vị trí theo IP có thể sai hơn 65 km).
- `test/load-schema.cjs`, `scripts/seed-flow4-demo.cjs` chạy thêm 2 migration; 3 địa điểm demo có tọa độ.
- **Đã chạy trên Aiven** (sau khi báo nhóm): cả hai migration báo thành công. Bản sao 20 dòng `locations` trước khi chạy được lưu tạm trên máy. Bước kiểm tra lại sau migration bằng script bị bộ lọc an toàn chặn; cần ai đó mở màn "Địa điểm & cửa khẩu" trên dữ liệu thật để xác nhận đủ 20 địa điểm có tọa độ.

**Khác so với kế hoạch / thiết kế:**
- Tọa độ Phụ lục A được đối chiếu OpenStreetMap; sửa Mộc Bài (11.44 → 11.076, 106.158), Dầu Giây (lệch ~10 km), Long Thành, Trảng Bom, Bavet. **Mộc Bài và Bavet vẫn là ước lượng**: trên bản đồ thật, ghim Mộc Bài cách giao lộ QL22 vài km. Specialist cần ghim lại.
- Số liệu thật hiện tại: 10 chặng máy bay, 15 chặng xe tải (kế hoạch ghi 11/14).
- `legs` không có cột phương tiện; loại chặng lấy từ `vehicles.vehicle_type` qua `legs.vehicle_id`.

## Bước 2. API địa điểm ✅

- Module `apps/api/src/features/locations/`, mount `/api/v1/locations`. Đọc: Specialist, Coordinator, Manager. Thêm/sửa/xóa: **Specialist**.
- Kiểm tra: quốc gia theo danh sách ISO dùng chung; múi giờ phải là tên IANA (Intl chấp nhận cả `+07:00` và chữ thường nên có thêm mẫu tên); tọa độ bắt buộc, làm tròn 6 chữ số, không nhận (0, 0).
- 409 khi: trùng tên trong cùng quốc gia (không phân biệt hoa/thường và dấu, theo collation DB); xóa địa điểm còn chặng hoặc quy định kiểm dịch tham chiếu.
- **Quy tắc thêm ngoài kế hoạch (đã được giữ):**
  - Không đổi **loại** địa điểm khi đang nằm trong kế hoạch đã duyệt của đơn chưa giao xong, hoặc đang là cửa khẩu trong quy định kiểm dịch (Flow 4 dựa vào `BORDER` để bắt thông quan).
  - Đổi tọa độ thì xóa tuyến đã cache của địa điểm đó.
- `GET /trips/:id/plan-options` trả thêm `latitude/longitude` (số, null khi chưa ghim).
- Swagger: `openapi.locations.ts`, nhóm "Flow 3 - Locations"; tổng operation **54 → 59** (đích cuối kế hoạch: 64).
- Test: `test/locations.mysql.cjs` (`pnpm --filter api test:mysql:locations`), 8 nhóm kiểm tra.

## Bước 3. Giao diện địa điểm + lớp bản đồ ✅

- `apps/web/src/features/trackmap/`:
  - `MapView.tsx`: khung cho mọi bản đồ; hiện dự phòng khi tắt cờ, thiếu token, không có WebGL 2, token/style lỗi, tải quá 20 giây hoặc lỗi tải chunk; có nút "Thử tải lại".
  - `BaseMap.tsx`: token, style `light-v11`, ngôn ngữ `vi`, tooltip điều khiển tiếng Việt.
  - `LocationPickerMap.tsx`: bấm/kéo ghim; ô tìm kiếm Mapbox chỉ di chuyển bản đồ (không lưu kết quả geocoding, đúng điều khoản).
  - `mapbox-gl` (~1.9 MB) nằm trong chunk riêng, chỉ tải khi mở bản đồ.
- Màn Specialist `?view=locations` ("Địa điểm & cửa khẩu"): bảng lọc theo tên/loại/quốc gia/tọa độ, cảnh báo số địa điểm thiếu tọa độ, modal thêm/sửa có bản đồ, gợi ý múi giờ theo quốc gia, dán "vĩ độ, kinh độ" để điền nhanh.
- `CountrySelect.tsx` thêm prop `label`, `allowClear`, `placeholder` (mặc định giữ nguyên hành vi cũ).
- Kiểm chứng bằng Edge headless trên DB demo local: Mapbox thật (85 request thành công), chặn mạng Mapbox → dự phòng vẫn lưu được, `VITE_MAP_ENABLED=false` → không có request Mapbox nào, vẫn lưu được.

## Việc làm thêm ngoài kế hoạch

- **Merge `origin/main`** (2 commit của Tiến: Thông báo, landing page, theme token). Conflict ở `DashboardLayout.tsx` đã xử lý, giữ cả Fleet/Routes, `NotificationsPanel` và khu vực Địa điểm. CSS bản đồ/địa điểm chuyển sang biến token (`var(--color-brand, …)`).
- **Thiết kế lại giao diện Driver cho web desktop** (yêu cầu riêng, bỏ giao diện mobile):
  - `features/tracking/driver/`: thống kê, danh sách chuyến bên trái, thẻ chuyến + 3 tab (Tổng quan / Mốc hành trình / Nhật ký ngựa), nút màu theo loại mốc, hộp báo sự cố tông đỏ. Logic nghiệp vụ giữ nguyên.
  - Gỡ 56 dòng CSS mobile chỉ Driver dùng khỏi `tracking.css`.
  - `test/driver.browser.cjs` viết lại cho 1440px; `test/portal-harness.tsx` bọc `AntDesignProvider` + theme token như `main.tsx`.
- **Sửa CSS toàn cục** `features/home/workspace.css`: `.portal button` không còn đè lên nút antd (dùng `:not(:where([class*=ant-]))`, giữ độ ưu tiên cũ). Ảnh hưởng: nút antd ở mọi màn hình portal (Fleet, Hồ sơ, Đơn hàng, Trips…) giờ hiện đúng màu theme.
- **Điều tra luồng Driver** (tài khoản Bùi Văn Tài): không phải lỗi. Driver chỉ thấy chuyến khi đơn `READY`; chuyến 21, 22 còn `PREPARING` vì giấy tờ/hồ sơ Flow 2 chưa đủ (chuyến 21 còn thiếu file thật trên kho lưu trữ). **Đã thay đổi** từ commit `4fc8100` của Tiến (merge 20/10/2026): bỏ bước Manager "Đánh dấu sẵn sàng"; đơn tự chuyển `READY` khi kế hoạch được duyệt và đã phân công đủ tài xế + hộ tống (không còn kiểm giấy tờ). Các chuyến đã duyệt trước đó vẫn ở `PREPARING` cho tới khi có thao tác duyệt kế hoạch hoặc lưu phân công lại.

## Kiểm thử hiện tại

| Bộ kiểm thử | Kết quả |
|---|---|
| `tsc` API + web, `vite build` | Sạch |
| Unit + Swagger API (`node --test`) | 92/92 |
| MySQL: locations / flow3-read / flow4-tracking / vehicles | 8 / 60 / 17 / 7 đạt |
| MySQL: flow1 / flow2 | 14 / 26 đạt (lần chạy trước merge) |
| `roles.render.cjs` | 40/40 |
| Browser: `driver`, `ops`, `order-list` | Đạt |
| Browser: `flow1`, `flow2`, `order-leave` | ❌ Timeout, **lỗi có sẵn trên HEAD** (không do nhánh này); cần báo Tiến |
| Browser: `trips-list.mjs`, `trips-detail.mjs` | Chưa chạy được: cần gói `playwright` đầy đủ |

## Chạy lại môi trường kiểm thử local

```powershell
# MySQL tạm (cùng bản 8.4 với Aiven) và Redis tạm
docker run -d --rm --name wdp-trackmap-mysql -p 127.0.0.1:33061:3306 -e MYSQL_ROOT_PASSWORD=demo mysql:8.4
docker run -d --rm --name wdp-trackmap-redis -p 127.0.0.1:6380:6379 redis:7-alpine

# Test MySQL (tạo và xóa DB ngẫu nhiên, không đụng Aiven)
$env:TEST_DB_HOST='127.0.0.1'; $env:TEST_DB_PORT='33061'; $env:TEST_DB_USER='root'; $env:TEST_DB_PASSWORD='demo'; $env:TEST_DB_SSL='false'
pnpm --filter api test:mysql:locations

# DB demo + API trỏ vào DB demo (đăng nhập specialist@example.com / Demo@12345)
$env:DEMO_DB_PORT='33061'; $env:DEMO_DB_PASSWORD='demo'; pnpm --filter api seed:flow4-demo
$env:DB_HOST='127.0.0.1'; $env:DB_PORT='33061'; $env:DB_NAME='wdp_flow4_demo'; $env:DB_USER='root'; $env:DB_PASSWORD='demo'; $env:DB_SSL='false'; $env:REDIS_HOST='127.0.0.1'; $env:REDIS_PORT='6380'; pnpm dev:api

# Browser test (cần Microsoft Edge)
$env:PLAYWRIGHT_PACKAGE='<đường dẫn playwright-core>'; node apps/web/test/driver.browser.cjs
```

Lưu ý: container chạy với `--rm` nên mất khi Docker khởi động lại; dựng lại bằng lệnh trên. Ổ C: của máy phát triển đang gần đầy (còn ~3 GB).

## Việc tiếp theo

1. **Commit** Bước 1–3 và phần giao diện Driver (đang chờ bạn quyết định).
2. **Bước 4 — Backend bản đồ:**
   - `trackmap.geo.ts`: haversine, nội suy theo tỉ lệ trên polyline, cung tròn lớn cho chặng bay, chọn mode (AIRCRAFT_HOLD → AIR; xe tải/thùng → ROAD; lỗi → STRAIGHT).
   - `trackmap.routes-provider.ts`: đọc cache `location_routes`, thiếu thì gọi Mapbox Directions (timeout 5 giây), lưu cache 30 ngày; lỗi → STRAIGHT.
   - API `GET /tracking/trips/:tripId/map`, `GET /tracking/orders/:orderId/map` (Customer: không GPS/sự cố/nhật ký), `GET /tracking/operations/map`.
   - Kiểu chung `packages/shared/src/types/trackmap.type.ts`; Swagger thêm 3 operation (→ 62).
   - Đặt `MAPBOX_ACCESS_TOKEN` cho API.
3. Specialist ghim lại tọa độ Mộc Bài và Bavet trên Aiven.
4. Báo Tiến về 3 browser test Flow 1 đang lỗi sẵn.
