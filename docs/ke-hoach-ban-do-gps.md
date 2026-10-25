# Kế hoạch: Bản đồ theo dõi đơn vận chuyển + GPS thời gian thực (Mapbox)

## Context

Dự án đã xong Flow 4 (ghi mốc, nhật ký, sự cố, timeline), nhưng mọi theo dõi đều là danh sách chữ. Bạn muốn thêm **bản đồ Mapbox** để theo dõi đơn, kèm **GPS thời gian thực của tài xế**. Bản thiết kế `docs/thiet-ke-theo-doi-ban-do-mapbox.md` đã được bạn trả lời 7 câu hỏi, cộng 3 câu làm rõ:

| # | Quyết định đã chốt |
|---|---|
| 1 | Customer: **Option A**: chỉ thấy tuyến, điểm dừng, tiến độ **ước tính** theo mốc; không nhận tọa độ GPS |
| 2 | **Làm GPS thời gian thực** từ tài xế |
| 3 | **Specialist quản lý danh mục địa điểm** (thêm/sửa, chọn tọa độ trên bản đồ). Chặng vẫn do Coordinator lập (Flow 3), mốc vẫn do Driver ghi (Flow 4) |
| 4 | **Specialist và Manager xem bản đồ + GPS thời gian thực** (tất cả chuyến). Coordinator: chuyến mình lập |
| 5 | Không có link công khai; Customer đăng nhập để xem |
| 6 | Token Mapbox trong `apps/web/.env` là của bạn, gói miễn phí |
| 7 | Thử Mapbox; không ổn thì thay (MapLibre) |
| + | Chặng máy bay (`AIRCRAFT_HOLD`): **ước tính, không nhận GPS** |
| + | **Làm trên desktop trước**; giao diện mobile để nhóm thiết kế sau |

## Đánh giá khách quan tính năng (dựa trên dữ liệu thật)

**Giá trị thật:**
- Là phần "theo dõi" trực quan nhất của sản phẩm; Manager/Coordinator/Specialist nhìn toàn cảnh chuyến đang chạy.
- Dữ liệu Flow 3–4 đã đủ để vẽ tuyến + tiến độ (chặng, mốc, giờ dự kiến/thực tế).
- Specialist quản lý địa điểm lấp đúng lỗ hổng **FR-TRP-02** (chưa ai làm, chưa có API ghi `locations`).

**Giới hạn cần nói thẳng:**
1. **`locations` chưa có tọa độ** (chỉ tên/loại/quốc gia/địa chỉ). Bản đồ phụ thuộc hoàn toàn vào việc nhập tọa độ đúng.
2. **GPS chỉ có ý nghĩa với chặng đường bộ.** DB thật: 25 chặng, **11 chặng máy bay** (không GPS), 14 chặng xe tải, phần lớn là nội địa ngắn (Củ Chi ↔ Tân Sơn Nhất).
3. **Dữ liệu mẫu có tuyến phi thực tế:** xe tải Narita→Sydney, xe tải Changi→Sha Tin. Directions không có đường → phải rơi về "đường thẳng ước lượng", bản đồ sẽ trông lạ khi demo nếu không dọn dữ liệu.
4. **"GPS thời gian thực trên desktop" về bản chất là mô phỏng:** máy tính đứng yên, vị trí lấy từ Wi-Fi/IP (sai số lớn). Muốn thấy xe "chạy" phải dùng **trình mô phỏng GPS** (script hoặc DevTools Sensors). Khi trình bày phải nói rõ đây là mô phỏng; GPS thật trên điện thoại chưa kiểm chứng (để giai đoạn mobile).
5. **Trình duyệt chỉ cấp vị trí trên HTTPS hoặc `localhost`**. Desktop dùng `localhost` nên ổn; mobile sau này cần HTTPS.
6. **Riêng tư và an ninh:** vị trí tài xế là dữ liệu cá nhân; cho Specialist xem GPS mở rộng diện người thấy vị trí xe chở ngựa quý. Đây là quyết định của bạn, kế hoạch tuân theo, nhưng giữ nguyên tắc: thu thập chỉ khi chuyến đang chạy + tài xế bật chia sẻ, tự xóa sau 30 ngày, Customer không bao giờ nhận GPS.
7. **Điều khoản Mapbox:** kết quả geocoding "tạm thời" không được lưu vĩnh viễn; lưu tuyến Directions lâu dài cũng cần đối chiếu điều khoản. Thiết kế né bằng cách: tọa độ địa điểm do Specialist **đặt ghim trên bản đồ** (tìm kiếm chỉ để di chuyển bản đồ), cache tuyến có hạn dùng.
8. **DB chung của nhóm:** migration mới phải chạy trên DB Aiven; chỉ thêm cột/bảng (nullable), không phá dữ liệu, nhưng phải báo nhóm.
9. **Giới hạn 100 request/phút theo IP:** demo trên một máy với 5 vai trò cùng polling + tài xế gửi GPS dễ chạm trần → phải tách limiter cho API bản đồ/GPS theo người dùng.
10. **Công sức ~6–8 ngày làm việc**; tách theo bước để luôn có bản chạy được, và có **cờ tắt bản đồ** (`VITE_MAP_ENABLED`) để không ảnh hưởng các flow đã xong nếu Mapbox trục trặc.

**Kết luận:** đáng làm, nhưng làm theo thứ tự: tọa độ + quản lý địa điểm → bản đồ ước tính cho mọi vai trò → GPS (desktop + mô phỏng). Mỗi bước tự đứng được.

## Quyền xem (thực thi bằng `authorizeTrip` sẵn có, 404 ngoài phạm vi / 403 sai vai trò)

| Vai trò | Bản đồ chuyến | GPS trực tiếp | Bản đồ tổng | Quản lý địa điểm |
|---|---|---|---|---|
| Customer | Đơn của mình, **chỉ ước tính**, không sự cố/nhật ký | Không | Không | Không |
| Coordinator | Chuyến mình lập | Có | Chuyến mình lập | Xem |
| Manager | Tất cả | Có | Tất cả | Xem |
| Specialist | Tất cả (chỉ đọc; không thấy sự cố như Flow 4) | **Có** | Tất cả | **Thêm/sửa/xóa** |
| Driver/Escort | Chuyến được phân công | **Gửi** vị trí của mình | Không | Không |

## Các bước thực hiện (theo thứ tự, mỗi bước có tiêu chí xong)

### Bước 0. Chuẩn bị (~0.5 giờ)
- Nhánh `feature/trackmap` từ `dev` (pull mới nhất trước).
- `apps/web`: thêm `mapbox-gl@^3` + `react-map-gl@^8` (import từ `react-map-gl/mapbox`), CSS `mapbox-gl/dist/mapbox-gl.css`.
- `apps/web/src/vite-env.d.ts`: khai báo `ImportMetaEnv` cho `VITE_MAPBOX_TOKEN`, `VITE_MAP_ENABLED`, `VITE_MAP_STYLE`.
- API env (Joi trong `apps/api/src/shared/config/env.validation.ts`): `MAPBOX_ACCESS_TOKEN` (tuỳ chọn; thiếu thì tuyến rơi về đường thẳng), `TRACK_POSITION_RETENTION_DAYS` (mặc định 30).
- **Xong khi:** build web/API sạch; token đọc được.

### Bước 1. Dữ liệu (~0.5 ngày)
- Migration `apps/api/src/database/migrations/1800000005000-LocationCoordinates.ts` (khuôn idempotent như `1800000004000-OrderRequirements.ts`): thêm `locations.latitude/longitude DECIMAL(9,6) NULL` + CHECK khoảng + CHECK cùng null; **nạp tọa độ xấp xỉ** cho 20 địa điểm hiện có (khớp `name`+`country`, chỉ khi đang NULL), giá trị lấy từ Phụ lục A của tài liệu thiết kế.
- Migration `1800000006000-TrackMap.ts`: bảng `location_routes` (cặp địa điểm + mode ROAD/AIR/STRAIGHT, `coordinates` JSON [[lng,lat]...], distance, duration, `fetched_at`) và `trip_positions` (trip, leg, user, lat, lng, accuracy, speed, heading, `recorded_at`, `received_at`, index `(trip_id, recorded_at)`).
- `apps/api/test/load-schema.cjs`: chạy thêm 2 migration mới sau `OrderRequirements`.
- `apps/api/scripts/seed-flow4-demo.cjs`: chạy 2 migration mới + tọa độ cho 3 địa điểm demo.
- **Xong khi:** test MySQL Flow 4 + vehicles vẫn xanh; chạy `pnpm migration:run` trên DB demo local thành công. **Chạy trên DB Aiven chỉ sau khi báo nhóm.**

### Bước 2. API quản lý địa điểm cho Specialist (~0.5 ngày), làm theo khuôn module `vehicles` vừa xong
- `apps/api/src/features/locations/` (validation, repository, service, controller, routes), mount `/api/v1/locations` trong `apps/api/src/routes/index.ts`, đăng ký trong `apps/api/src/shared/config/services.ts`.
- GET list/detail: SPECIALIST, COORDINATOR, MANAGER. POST/PUT/DELETE: **SPECIALIST**.
- Quy tắc: tên+quốc gia duy nhất (409), `country` 2 ký tự, `timezone` IANA hợp lệ (kiểm bằng `Intl.DateTimeFormat`), lat/lng **bắt buộc khi tạo/sửa qua API**; xóa chỉ khi không có chặng (`legs`) và quy định (`quarantine_rules.border_location_id`) tham chiếu (409); audit `entity_type='LOCATION'`.
- Kết quả trả về kèm `legCount`, `ruleCount` để UI khóa nút xóa.
- `GET /trips/:id/plan-options` của Flow 3 trả thêm `latitude/longitude` (không đổi luồng lưu kế hoạch).
- Swagger `apps/api/src/shared/config/openapi.locations.ts` (khuôn `openapi.vehicles.ts`), test `apps/api/test/locations.mysql.cjs` (khuôn `vehicles.mysql.cjs`).
- **Xong khi:** test MySQL locations xanh; Swagger cập nhật số operation.

### Bước 3. Giao diện "Địa điểm" cho Specialist + lớp bản đồ dùng chung (~1 ngày). Bước này **kiểm chứng Mapbox sớm nhất**
- Lớp nền `apps/web/src/features/trackmap/`:
  - `MapView.tsx`: bọc `react-map-gl` (tải lười bằng `React.lazy`), đọc token/style/cờ bật; ngôn ngữ `vi`; điều khiển zoom.
  - `MapFallback.tsx`: hiện khi thiếu token, `VITE_MAP_ENABLED=false`, lỗi WebGL hoặc tải bản đồ lỗi; trang không bao giờ trắng.
  - `map-style.ts`: dùng `mapbox://styles/mapbox/light-v11`; cho phép thay bằng style cục bộ khi test (không gọi mạng).
- Khu vực mới cho Specialist `?view=locations` "Địa điểm & cửa khẩu" (thêm vào `apps/web/src/features/home/role-workspaces.ts`, gắn trong `DashboardLayout.tsx` như `FleetWorkspace`):
  - Bảng antd (lọc theo loại/quốc gia, tìm tên), tag "Thiếu tọa độ".
  - Modal thêm/sửa: tên, loại, quốc gia (dùng lại `apps/web/src/features/orders/CountrySelect.tsx`), múi giờ, địa chỉ, **bản đồ chọn vị trí: bấm hoặc kéo ghim**; ô tìm kiếm Mapbox chỉ để di chuyển bản đồ; ô lat/lng nhập tay.
  - Khóa nút Xóa khi địa điểm đang được dùng.
- Coordinator/Manager: không thêm menu; Coordinator vẫn chọn địa điểm trong form kế hoạch Flow 3 như cũ.
- **Xong khi:** Specialist thêm/sửa địa điểm bằng ghim trên bản đồ thật (token của bạn); tắt `VITE_MAP_ENABLED` thì form vẫn dùng được bằng ô lat/lng.

### Bước 4. Backend bản đồ (~1 ngày)
- `apps/api/src/features/tracking/trackmap.geo.ts` (hàm thuần, không thêm thư viện): khoảng cách haversine, nội suy điểm theo tỉ lệ trên polyline, cung tròn lớn cho chặng bay, chọn `mode` (AIRCRAFT_HOLD → AIR; xe tải/thùng → ROAD; thiếu đường/lỗi → STRAIGHT).
- `trackmap.routes-provider.ts`: lấy tuyến theo cặp địa điểm từ `location_routes`; thiếu thì gọi Mapbox Directions (`fetch`, timeout 5 giây, `geometries=geojson&overview=simplified`) bằng `MAPBOX_ACCESS_TOKEN`, lưu cache có `fetched_at` (hết hạn 30 ngày, cấu hình được); lỗi → STRAIGHT, không chặn trang.
- Vị trí ước tính (theo bảng ở mục 8 tài liệu thiết kế): chưa xuất phát → điểm đi; `MOVING` → nội suy theo thời gian, kẹp [0, 0.95]; `AT_STOP`/`COMPLETED` → điểm đến; luôn kèm nhãn "ước tính".
- Vị trí GPS (cho vai trò được phép): điểm mới nhất của chuyến; tươi (<2 phút) = `LIVE`, 2–10 phút = `STALE` ("mất tín hiệu"), cũ hơn hoặc chặng bay → dùng ước tính.
- API trong `tracking.service.ts`/`tracking.routes.ts` (dùng lại `authorizeTrip`, `getLegsForTrips`, `findOrderForTimeline`, `getActiveTrips`, `isLegOverdue`):
  - `GET /tracking/trips/:tripId/map`: internal roles; Specialist không có sự cố (như Flow 4).
  - `GET /tracking/orders/:orderId/map`: Customer, **không có GPS, sự cố, nhật ký**.
  - `GET /tracking/operations/map`: Manager, Coordinator (chuyến mình), Specialist; mỗi chuyến: vị trí hiện tại, chặng hiện tại, cờ sự cố/trễ hạn.
- Kiểu dữ liệu chung `packages/shared/src/types/trackmap.type.ts` (export trong `packages/shared/src/index.ts`).
- Swagger thêm vào `openapi.tracking.ts`.
- **Xong khi:** test đơn vị geo (nội suy, biên, cung bay, đổi mode) + test MySQL phân quyền (Customer không nhận GPS/sự cố; Specialist không có sự cố; ngoài phạm vi 404; thiếu tọa độ → cảnh báo, không lỗi; Directions lỗi → STRAIGHT, gọi Directions đúng 1 lần cho mỗi cặp).

### Bước 5. Giao diện bản đồ cho các vai trò (~1–1.5 ngày)
- `TripMap.tsx`: tuyến theo chặng (xám/xanh dương/xanh lá theo trạng thái; nét đứt cho STRAIGHT, cung cho AIR), ghim điểm dừng theo loại, biểu tượng xe (ước tính có viền đứt + nhãn; GPS có chấm "đang phát"), (nội bộ) ghim sự cố mở; `MapLegend.tsx`.
- `FleetMap.tsx`: mọi chuyến đang chạy, chấm màu (bình thường / có sự cố / trễ hạn), bấm mở khung tóm tắt → chọn chuyến.
- Gắn vào màn hình có sẵn:
  - `apps/web/src/features/tracking/customer/CustomerTracking.tsx`: thanh tab "Tiến trình | Bản đồ" trong `section.trk-panel`.
  - `ops/OperationsWorkspace.tsx`: công tắc "Danh sách | Bản đồ".
  - `ops/TripDetailPanel.tsx`: thêm tab `'map'` "Bản đồ" vào mảng `tabs`.
  - `driver/MilestonePanel.tsx`: bản đồ nhỏ sau `section.trk-current`.
- Làm mới: chỉ khi tab đang hiển thị (`document.visibilityState`), 15 giây cho bản đồ có GPS, giữ 60 giây cho Customer (đúng nhịp hiện tại).
- **Xong khi:** mỗi vai trò thấy đúng bản đồ của mình trên desktop; tắt cờ/thiếu token thì hiện dự phòng, timeline vẫn đủ.

### Bước 6. GPS thời gian thực (desktop + mô phỏng) (~1.5 ngày)
- API:
  - `POST /tracking/trips/:tripId/positions`: chỉ Driver/Escort được phân công; đơn `IN_TRANSIT`; chặng hiện tại `MOVING`/`AT_STOP` và **không phải chặng bay** (409); mảng 1–20 điểm (gửi bù khi mất mạng); kiểm lat/lng, `recorded_at` không tương lai quá 60 giây và không cũ quá 24 giờ.
  - `GET /tracking/trips/:tripId/positions?since=`: Coordinator/Manager/Specialist (và Driver chuyến mình) để vẽ vệt đã đi; tối đa 500 điểm.
- Rate limit (`apps/api/src/shared/middlewares/rateLimiter.middleware.ts` + `apps/api/src/app.ts`): limiter chung **bỏ qua** các đường map/positions; thêm limiter **theo người dùng** sau xác thực (khóa = `req.account.id`): positions 30/phút, map 60/phút.
- Tác vụ dọn dữ liệu: `startPositionRetentionJob()` trong tracking service, mỗi giờ xóa điểm cũ hơn `TRACK_POSITION_RETENTION_DAYS`; khởi động/dừng trong `apps/api/src/index.ts` theo đúng khuôn `startExpiryJob` của documents.
- Giao diện Driver (`driver/DriverWorkspace.tsx`, cạnh nút khẩn cấp): công tắc **"Chia sẻ vị trí"**: hộp thoại đồng ý lần đầu; `navigator.geolocation.watchPosition` (enableHighAccuracy); gửi lô mỗi 10 giây; hàng đợi `localStorage` khi lỗi mạng (khuôn `useDraft.ts`); tự tắt khi đơn DELIVERED hoặc chặng bay; hiển thị "Đã gửi lúc …"; xin quyền bị từ chối → hướng dẫn bật lại.
- Bản đồ nội bộ: hiện điểm GPS + vệt đường; trạng thái LIVE/STALE.
- **Trình mô phỏng** `apps/api/scripts/simulate-gps.cjs` (chỉ chạy khi không phải production): đăng nhập bằng tài khoản Driver, lấy hình học chặng hiện tại từ `/map`, gửi điểm dọc tuyến mỗi 5 giây theo tốc độ cấu hình. Thêm hướng dẫn dùng DevTools → Sensors.
- **Xong khi:** chạy mô phỏng → Coordinator/Manager/Specialist thấy xe chạy dọc tuyến (≤15 giây trễ), Customer vẫn chỉ thấy ước tính; dừng mô phỏng 2 phút → "mất tín hiệu".

### Bước 7. Kiểm thử tổng, tài liệu (~0.5–1 ngày)
- `apps/api/test/swagger.test.cjs`: cập nhật tổng operation (54 + 5 locations + 3 map + 2 positions = **64**) và kiểm nhóm mới.
- Browser test mới `apps/web/test/trackmap.browser.cjs` (khuôn `ops.browser.cjs`, nhưng **chặn mọi request ngoài** như `flow1.browser.cjs`; style bản đồ cục bộ; `context.grantPermissions(['geolocation'])` + `setGeolocation` để thử chia sẻ vị trí): Customer không thấy GPS, các vai trò nội bộ thấy, dự phòng khi tắt cờ.
- Sửa `apps/web/test/roles.render.cjs` nếu Specialist có khu vực mới (`locations`).
- Cập nhật `docs/implementation-status.md`, `docs/thiet-ke-theo-doi-ban-do-mapbox.md` (quyết định đã chốt), thêm mục bản đồ/GPS vào `docs/huong-dan-hoan-thanh-flow4.md`.

## Tái sử dụng (không viết lại)
- Phân quyền chuyến: `authorizeTrip` (`tracking.service.ts` L601); chặng/mốc: `getLegsForTrips`, `getLegMilestones`; danh sách chuyến đang chạy: `getActiveTrips` (repo L208); trễ hạn: `isLegOverdue`.
- Khuôn CRUD + audit + Swagger + test MySQL: module `apps/api/src/features/vehicles/` và `apps/api/test/vehicles.mysql.cjs`.
- Khuôn tác vụ nền: `startExpiryJob`/`stopExpiryJob` (`documents.service.ts`), đăng ký trong `apps/api/src/index.ts`.
- Giao diện: `FleetWorkspace.tsx` (antd), `CountrySelect.tsx`, `errorMessage`/`isNetworkError` (`tracking.api.ts`), `useDraft.ts`/`pendingStore`.

## Verification (kiểm chứng đầu cuối)
1. `pnpm --filter api test` (unit) + `test:mysql:flow4`, `test:mysql:vehicles`, `locations.mysql.cjs` mới trên MySQL tạm (Docker), không dùng DB chung.
2. `tsc` API/web + `vite build`; kích thước chunk bản đồ tách riêng.
3. Browser tests: `driver/ops/roles.render` cũ + `trackmap.browser.cjs` mới.
4. Chạy thật trên desktop với DB demo local (`seed:flow4-demo`): Specialist chỉnh tọa độ → Coordinator/Manager/Specialist mở bản đồ → Driver bật chia sẻ vị trí + chạy `simulate-gps.cjs` → xe chạy trên bản đồ nội bộ; Customer chỉ thấy ước tính; tắt mô phỏng → "mất tín hiệu"; tắt `VITE_MAP_ENABLED` → dự phòng.
5. Chỉ sau khi tất cả xanh: báo nhóm, chạy migration trên DB Aiven, thử lại đọc-only trên dữ liệu thật.

## Rủi ro chính và cách giảm
- Token/hạn mức Mapbox lỗi → cờ tắt + dự phòng; đổi sang MapLibre chỉ cần thay `MapView.tsx`.
- Tuyến phi thực tế trong dữ liệu mẫu → STRAIGHT + nhãn "tuyến ước lượng"; đề xuất nhóm dọn dữ liệu demo.
- WebGL trong test headless → style cục bộ, kiểm logic tách khỏi hiển thị.
- Đụng code Flow 3/4 của nhóm → chỉ thêm tab/công tắc, không đổi luồng hiện có; `plan-options` chỉ thêm trường.
