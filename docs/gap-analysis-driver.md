# Gap analysis: giao diện Tài xế (Figma) so với code hiện tại

> Ngày lập: 22/10/2026 · Nhánh: `feature/trackmap` · Chưa sửa code.
> Thiết kế: Figma "Vận chuyển ngựa" (`XvYelFeTRkb5CFamqUHNak`), node `57:4903`, `57:5087`, `57:5285`.

## 0. Tóm tắt

- Thiết kế có **3 màn** cho vai trò `DRIVER_ESCORT`: **D1** Chuyến vận chuyển (trước khi chạy), **D1b** Chuyến đang chạy, **D2** Báo cáo sự cố.
- **Khoảng 60% dữ liệu đã có sẵn** qua API `/tracking/*`: chặng, mốc, ngựa, nhật ký, sự cố, thông báo. Luồng nghiệp vụ "Bắt đầu chuyến đi" và "Check-in chặng" đã chạy được (`MilestonePanel`).
- Các chỗ thiếu lớn:
  1. Thông tin con người trên chuyến (hộ tống, người nhận, điều phối viên kèm số điện thoại) chưa trả về cho tài xế.
  2. Bản đồ và GPS: bảng DB đã có, nhưng **chưa có API** (Bước 4 trong [tien-do-ban-do-gps.md](tien-do-ban-do-gps.md)).
  3. Checklist trước khi chạy chưa có ở đâu cả.
  4. **Mô hình sự cố trong D2 khác BE**: thiết kế có 3 mức độ, vị trí GPS, đối tượng hư hại và nhãn ảnh.
- FE đang dựng theo kiểu "danh sách chuyến + tabs". Thiết kế lại theo kiểu "một chuyến một trang, 2 mục menu" nên phần layout gần như phải dựng lại. Logic và helper thì dùng lại được nhiều.

Ký hiệu: ✅ đã có, dùng được ngay · ⚠️ có nhưng lệch, sai format hoặc chỉ suy ra được một phần · ❌ chưa có.

---

## 1. Danh sách màn hình

| Mã | Tên màn | Khi nào hiển thị | Figma node | Nút chính |
|---|---|---|---|---|
| D1 | Chuyến vận chuyển | Đơn `READY` (sẵn sàng khởi hành) | `57:4903` | "Bắt đầu chuyến đi" → D1b, "Báo cáo sự cố" → D2 |
| D1b | Chuyến đang chạy | Đơn `IN_TRANSIT` | `57:5087` | "Check-in chặng", "Báo cáo sự cố" → D2 |
| D2 | Báo cáo sự cố | Từ D1/D1b hoặc menu | `57:5285` | "Gửi báo cáo cho điều phối", "Hủy" |

**Phần dùng chung cho cả 3 màn**
- **Sidebar**:
  - Logo "Vận chuyển ngựa" và badge "DRIVER · Tài xế".
  - Nhóm "Điều hướng" có 2 mục: *Chuyến vận chuyển*, *Báo cáo sự cố*.
  - Thẻ người dùng ở đáy (tên, vai trò, nút đăng xuất → `LP`).
- **Topbar**: breadcrumb, tiêu đề, mô tả, ô tìm kiếm "Tìm mã đơn, khách hàng…", nút chuông thông báo, ô ngày hiện tại.

---

## 2. Dữ liệu và API theo từng màn

### 2.1 D1: Chuyến vận chuyển (`READY`)

| Khối UI | Dữ liệu hiển thị | Nguồn API | TT |
|---|---|---|---|
| Header: mã + badge | `orderCode`, `orderStatus` (READY → "Sẵn sàng khởi hành") | `GET /tracking/driver/trips` | ✅ |
| Header: tuyến | "TP.HCM → Hà Nội" | Suy từ `legs[0].fromLocationName` và `legs[n-1].toLocationName` | ✅ |
| Header: khoảng cách | "1.720 km" | Chưa có. Bảng `location_routes.distance_m` có nhưng chưa có API | ❌ |
| Header: ngày | "15/11/2026" | `plannedDepartureAt` | ✅ |
| Xe | "51C-482.19 · Medium" | Biển số có trong `legs[].vehicleCode`. **"Medium"** không có cột nào tương ứng: `vehicles` chỉ có `vehicle_type` (TRUCK/AIRCRAFT_HOLD/CRATE) và `capacity_stalls` | ⚠️ |
| Hộ tống | "Lê Thị Mai" | Có trong `trip_assignments`, nhưng chỉ `GET /trips/:id/assignments` trả về, và route đó chỉ cho COORDINATOR/MANAGER | ❌ |
| Ngựa | "Thunder Bolt, Silver Moon" | `GET /tracking/trips/:id` → `horses[].name` | ✅ |
| Người nhận | "Trần Quốc Huy" | `orders` **không có trường người nhận**. Gần nhất là khách hàng (`orders.customer_id → users.full_name`), hiện chưa trả về cho tài xế | ❌ |
| Nút "Bắt đầu chuyến đi" | Ghi mốc xuất phát chặng 1 | `POST /tracking/legs/:legId/milestones` `{ milestoneType: "DEPARTED", occurredAt }` | ✅ |
| Nút "Báo cáo sự cố" | Mở D2 | Thiết kế bật nút cả ở READY. BE (`createIncident`) và FE (`canReport`) chỉ cho phép khi `IN_TRANSIT` | ⚠️ |
| Bản đồ "Lộ trình chuyến đi" | Polyline tuyến, các điểm dừng, pin điểm gửi/nhận | Chưa có. Dự kiến `GET /tracking/trips/:tripId/map` (Bước 4 GPS). `locations.latitude/longitude` đã có | ❌ |
| Nhãn tuyến | "Tuyến A · QL1A + cao tốc" | Không có trong DB | ❌ |
| Các chặng: tên, giờ | 5 điểm, giờ dự kiến, hậu tố "+1/+2" (số ngày sau ngày khởi hành) | Suy từ `legs`: điểm 1 = `legs[0].from` (giờ `plannedDepartureAt`), điểm i = `legs[i].to` (giờ `plannedArrivalAt`) | ✅ |
| Các chặng: ghi chú | "Nhận 2 ngựa / Cho ngựa uống nước / Nghỉ đêm / Bàn giao" | Chỉ suy được một phần: điểm đầu "Nhận {n} ngựa", điểm cuối "Bàn giao", các điểm giữa theo `toLocationType` (REST_STOP, FUEL_STOP, BORDER…). `legs` không có cột ghi chú hay mục đích dừng nên **không ra được "Nghỉ đêm"** | ⚠️ |
| Các chặng: trạng thái | ✓ đã xong / ○ chưa | `legs[].status` | ✅ |
| Kiểm tra trước khi chạy | 5 mục, có lưu tick | Không có bảng, không có API | ❌ |

### 2.2 D1b: Chuyến đang chạy (`IN_TRANSIT`)

| Khối UI | Dữ liệu hiển thị | Nguồn API | TT |
|---|---|---|---|
| Header | Giống D1, badge "Đang di chuyển" | `orderStatus = IN_TRANSIT` | ✅ (các ô hộ tống/người nhận vẫn ❌ như D1) |
| Nút "Check-in chặng" | Hành động tiếp theo của chặng hiện tại | `nextAction()` + `POST /tracking/legs/:legId/milestones` hoặc `POST /tracking/legs/:legId/complete` | ✅ |
| "Còn 1.204 km" | Khoảng cách còn lại | Cần hình học tuyến và vị trí GPS mới nhất | ❌ |
| "ETA 17/11 10:00" | Giờ đến | Tạm dùng `plannedArrivalAt`. ETA động cần GPS | ⚠️ |
| Badge "Đang chia sẻ GPS với điều phối" | Trạng thái gửi vị trí | Bảng `trip_positions` đã có. **Chưa có** `POST /tracking/trips/:tripId/positions`, FE chưa dùng `navigator.geolocation` | ❌ |
| Bản đồ: vị trí xe, đoạn đã đi | Marker xe, polyline 2 màu | Như D1, cộng thêm vị trí mới nhất | ❌ |
| Các chặng | 3 trạng thái: ✓ xong / 🚚 đang tới / ○ chưa | `legs[].status` + `currentLeg()` | ✅ |
| Thẻ "Chặng tiếp" | "Quy Nhơn · còn 86 km · 20:30" | Tên và giờ: `currentLeg().toLocationName`, `plannedArrivalAt`. Số km thì ❌ | ⚠️ |
| Thẻ "Tốc độ" | "64 km/h · giới hạn 80 km/h" | `speed_mps` từ GPS (chưa có API). Giới hạn tốc độ không có trong DB | ❌ |
| Thẻ "Đã chạy" | "6 giờ 40 · nghỉ tiếp sau 1 giờ 20" | FE tự tính: `now − legs[0].actualDepartureAt` và `currentLeg().plannedArrivalAt − now` | ✅ |
| "Ghi chú từ hộ tống" | Giờ + nội dung ghi chú mới nhất | `GET /tracking/trips/:tripId/horse-logs` → `note`, `loggedAt`. `IHorseLog` có `createdBy` nhưng **không có vai trò crew** của người ghi, nên chỉ lọc được "người khác mình", không chắc đó là hộ tống | ⚠️ |

### 2.3 D2: Báo cáo sự cố

| Khối UI | Dữ liệu và hành vi | Nguồn API | TT |
|---|---|---|---|
| Phụ đề | "… · chuyến VCN-2610-018" | `orderCode` | ✅ |
| 1. Mức độ | Đỏ (Nghiêm trọng) / Cam (Trung bình) / Vàng (Nhẹ) | BE chỉ có `urgency` NORMAL/HIGH, **do server tự suy** (HORSE_MEDICAL → HIGH), client không gửi được. Validation `.strict()` sẽ từ chối trường lạ | ⚠️ sai mô hình |
| 2. Loại sự cố | "Hỏng xe · nổ lốp" (có loại con) | Enum `IncidentType` chỉ có 3 giá trị: VEHICLE_BREAKDOWN, LONG_TRAFFIC_JAM, HORSE_MEDICAL. Không có loại con | ⚠️ |
| 2. Vị trí (GPS tự động) | "Km 742 QL1A, Hà Tĩnh" | `incidents` không có lat/lng hay địa chỉ. Cần GPS + reverse geocoding (Mapbox) | ❌ |
| 2. Mô tả chi tiết | Text | `description` (5–2000 ký tự) | ✅ |
| 3. Hư hại liên quan tới | Xe / Ngựa / Cả hai | Không có cột. Hiện chỉ có `horseId` (một con), bắt buộc khi HORSE_MEDICAL. Thiết kế **thiếu ô chọn con ngựa** khi chọn "Ngựa" | ❌ |
| 4. Hình ảnh | Ảnh có nhãn ("Lốp sau", "Toàn xe", "Khoang ngựa") + "Chụp thêm" | Upload multipart `photos` ✅. Nhãn ảnh ❌ (`attachments` không có caption) | ⚠️ |
| Gửi | Tạo sự cố | `POST /tracking/trips/:tripId/incidents` (multipart) | ✅ |
| Trong lúc chờ | 3 mục checklist an toàn | Nội dung tĩnh phía FE, không cần API | ✅ |
| Liên hệ nhanh: điều phối | "Gọi điều phối: Đặng Quốc Việt" (`tel:`) | Có trong DB (`trips.planned_by → users.full_name, phone`), nhưng không API nào trả về cho tài xế | ❌ |
| Liên hệ nhanh: cứu hộ | "Cứu hộ 24/7: 1900 1080" | Chưa có. Đề xuất đặt hằng số hoặc lưu trong `system_parameters` | ❌ |
| Banner cảnh báo | "Mức đỏ sẽ báo ngay … qua cuộc gọi tự động" | BE chỉ tạo thông báo `IN_APP` có tiền tố `[KHẨN]`, **không có cuộc gọi tự động** | ⚠️ (sai so với hành vi thật) |

### 2.4 Phần dùng chung

| Khối UI | Nguồn API | TT |
|---|---|---|
| Thẻ user (tên, vai trò), đăng xuất | `useAuth()` / `AuthProvider` | ✅ |
| Chuông thông báo | `GET /notifications`, `POST /notifications/:id/read` (đã có `NotificationsPanel`) | ✅ |
| Ô tìm kiếm "mã đơn, khách hàng" | Không có API tìm kiếm cho tài xế. Tài xế chỉ có vài chuyến nên có thể lọc phía client từ `GET /tracking/driver/trips`. Nhưng tên khách hàng chưa có trong response | ⚠️ |
| Ngày hôm nay | FE tự tạo | ✅ |

---

## 3. Đối chiếu với code hiện có

### 3.1 API

**Đã có, dùng lại được ngay**

| Endpoint | Dùng cho | File |
|---|---|---|
| `GET /tracking/driver/trips` | Danh sách chuyến của tài xế, chọn chuyến đang hiển thị | [tracking.routes.ts](../apps/api/src/features/tracking/tracking.routes.ts) |
| `GET /tracking/trips/:id` | Ngựa, chặng, mốc | như trên |
| `POST /tracking/legs/:legId/milestones` | Bắt đầu chuyến đi, Check-in | như trên |
| `POST /tracking/legs/:legId/complete` | Hoàn tất chặng trung gian | như trên |
| `GET /tracking/trips/:tripId/horse-logs` | Ghi chú từ hộ tống | như trên |
| `POST /tracking/trips/:tripId/incidents` | Gửi báo cáo sự cố | như trên |
| `GET /tracking/trips/:tripId/incidents` | Lịch sử sự cố của chuyến | như trên |
| `GET /tracking/trips/:tripId/alerts` | Cảnh báo từ điều phối (chưa có chỗ trong thiết kế) | như trên |
| `GET /notifications`, `POST /notifications/:id/read` | Chuông thông báo | [notifications.routes.ts](../apps/api/src/features/notifications/notifications.routes.ts) |

**Còn thiếu**

| Endpoint / thay đổi đề xuất | Phục vụ | Ghi chú |
|---|---|---|
| Mở rộng `GET /tracking/trips/:id`: thêm `crew[] {name, role, phone}`, `customer {name}` (hoặc người nhận), `coordinator {name, phone}`, `vehicle {code, type, capacityStalls}` | D1, D1b, D2 | Chỉ cần JOIN trong [tracking.repository.ts](../apps/api/src/features/tracking/tracking.repository.ts), không cần migration (trừ khi thêm "người nhận" riêng) |
| `GET /tracking/trips/:tripId/map` | Bản đồ D1/D1b, km tổng/còn lại | Đã lên kế hoạch ở Bước 4 GPS: đọc cache `location_routes`, gọi Mapbox Directions khi chưa có cache |
| `POST /tracking/trips/:tripId/positions` (gửi theo lô) | Chia sẻ GPS, tốc độ, vị trí xe | Bảng `trip_positions` đã có khóa unique `(trip_id, user_id, recorded_at)`, dùng `INSERT IGNORE` để gửi lại không bị trùng |
| `GET/PUT /tracking/trips/:tripId/pre-departure-checks` | Checklist D1 | Chỉ cần nếu chọn lưu ở BE (xem Câu hỏi mở) |
| Mở rộng `incidents`: `severity`, `latitude/longitude/location_text`, `damage_target`, caption ảnh | D2 | Cần migration, cập nhật `createIncidentSchema`, enum trong `packages/shared` và `IIncident` |

**Chỗ sai format hoặc lệch**

| Vấn đề | Chi tiết |
|---|---|
| Kiểu trip detail ở FE không khớp BE | BE trả `TrackingTripDetail` (khai báo trong [tracking.dto.ts](../apps/api/src/features/tracking/tracking.dto.ts), có `planStatus`, `plannedDepartureAt`, `plannedArrivalAt`, `crewRole`). FE lại tự khai báo `TripDetail` trong [tracking.api.ts](../apps/web/src/features/tracking/tracking.api.ts) và thiếu các trường đó. Nên chuyển thành `IDriverTripDetail` trong `packages/shared` |
| `urgency` không do client quyết định | Thiết kế cho người dùng chọn mức độ, BE thì tự suy từ loại sự cố. Hai bên cần thống nhất (xem Câu hỏi mở) |
| Báo sự cố khi `READY` | BE trả 409 "Chỉ báo sự cố khi chuyến đang vận chuyển". Thiết kế D1 lại cho phép |
| `IHorseLog` thiếu vai trò người ghi | Muốn hiện "Ghi chú từ hộ tống" chính xác thì cần thêm `createdByCrewRole` |

### 3.2 Frontend

**Layout và điều hướng**

| Thành phần | Hiện tại | Thiết kế | TT |
|---|---|---|---|
| [DashboardShell.tsx](../apps/web/src/components/layout/DashboardShell.tsx) | Logo "WDP EQUINE", khối "Không gian làm việc", nav có "Tổng quan / … / Thông báo", topbar gồm breadcrumb + `AccountMenu` | Logo "Vận chuyển ngựa", badge vai trò, 2 mục nav, thẻ user + logout ở đáy, topbar có tìm kiếm + chuông + ngày | ⚠️ lệch nhiều. Shell dùng chung cho mọi vai trò nên cần quyết định: sửa chung, hay chỉ sửa cho driver |
| [role-workspaces.ts](../apps/web/src/features/home/role-workspaces.ts) (`DRIVER_ESCORT`) | 3 area: `assignments`, `milestones`, `horse-logs` | 2 mục: Chuyến vận chuyển, Báo cáo sự cố | ⚠️ |
| Router | Driver đi qua `/dashboard?view=…` → [HomePage.tsx](../apps/web/src/features/home/HomePage.tsx) → `DriverDashboard` | Có thể giữ cơ chế `?view=`, đổi giá trị thành `trip` / `incident` | ✅ dùng lại |

**Màn hình**

| Màn | Hiện tại | Lệch so với thiết kế |
|---|---|---|
| D1/D1b | [DriverWorkspace.tsx](../apps/web/src/features/tracking/driver/DriverWorkspace.tsx): 4 thẻ thống kê, danh sách chuyến bên trái ([TripList.tsx](../apps/web/src/features/tracking/driver/TripList.tsx)), header + Tabs (Tổng quan / Mốc / Nhật ký) | Thiết kế là **1 chuyến/trang**, không có thẻ thống kê, danh sách hay tabs. D1 và D1b là cùng một trang, đổi nội dung theo `orderStatus` |
| D1: tổng quan | [TripOverview.tsx](../apps/web/src/features/tracking/driver/TripOverview.tsx): `Steps` dọc theo chặng, khối "Việc cần làm", bảng ngựa | Thiết kế: timeline "Các chặng" (theo điểm dừng, không theo chặng) ở cột phải, bản đồ ở cột trái, checklist bên dưới |
| D1b: mốc | [MilestonePanel.tsx](../apps/web/src/features/tracking/driver/MilestonePanel.tsx): nút hành động, modal xác nhận giờ, nhập bù, hàng đợi offline | Thiết kế chỉ có nút "Check-in chặng" trên header. **Giữ nguyên logic** (xác nhận giờ, nhập bù, `pendingStore`, xử lý 409), chỉ chuyển nút lên header |
| Nhật ký ngựa | [HorseLogForm.tsx](../apps/web/src/features/tracking/driver/HorseLogForm.tsx) | Thiết kế **không có** form nhật ký, chỉ hiện "Ghi chú từ hộ tống". Cần quyết định có bỏ chức năng này không (nghiệp vụ FR có yêu cầu) |
| D2 | [IncidentDialog.tsx](../apps/web/src/features/tracking/driver/IncidentDialog.tsx): **modal**, chọn loại bằng 3 nút, mô tả, chọn ngựa, ảnh, danh sách sự cố đã báo | Thiết kế là **trang riêng**, có mức độ 3 màu, dropdown loại, vị trí GPS, chọn đối tượng hư hại, ảnh có nhãn, cột phải "Trong lúc chờ" + "Liên hệ nhanh" + banner |

**Dùng lại được**
- [tracking.format.ts](../apps/web/src/features/tracking/tracking.format.ts): `currentLeg`, `nextAction`, `formatDateTime`, các bảng label.
- [driver-ui.ts](../apps/web/src/features/tracking/driver/driver-ui.ts): `tripProgress`, `routeStops`, `ORDER_TAG`, `LEG_TAG`.
- [useDraft.ts](../apps/web/src/features/tracking/driver/useDraft.ts): `useDraft` để giữ bản nháp D2 hoặc checklist, `pendingStore` cho mốc gửi khi offline.
- [PhotoPicker.tsx](../apps/web/src/features/tracking/driver/PhotoPicker.tsx): chọn ảnh (cần thêm nhãn).
- [MapView.tsx](../apps/web/src/features/trackmap/MapView.tsx), [BaseMap.tsx](../apps/web/src/features/trackmap/BaseMap.tsx), [MapFallback.tsx](../apps/web/src/features/trackmap/MapFallback.tsx): khung bản đồ có fallback khi chưa có token hoặc không có WebGL.
- [NotificationsPanel.tsx](../apps/web/src/features/notifications/NotificationsPanel.tsx), `errorMessage` / `isNetworkError` trong `tracking.api.ts`.

**Component còn thiếu (đề xuất)**

| Component | Màn | Ghi chú |
|---|---|---|
| `DriverShell` (hoặc biến thể của `DashboardShell`) | Chung | Sidebar và topbar theo thiết kế |
| `TripHeaderCard` | D1, D1b | Mã đơn, badge, tuyến, 4 ô thông tin, nút theo trạng thái |
| `StopTimeline` | D1, D1b | Chuyển legs thành danh sách điểm dừng, 3 trạng thái icon |
| `PreDepartureChecklist` | D1 | 5 mục cố định |
| `DriverRouteMap` | D1, D1b | Lazy chunk như `LocationPickerMap`, bọc trong `MapView` |
| `LiveStatsCards` | D1b | Chặng tiếp / Tốc độ / Đã chạy |
| `EscortNoteCard` | D1b | Ghi chú mới nhất |
| `useGpsSharing` | D1b | `watchPosition`, gửi theo lô, hàng đợi offline |
| `IncidentReportPage` | D2 | Thay cho `IncidentDialog` |
| `SeverityPicker`, `DamageTargetChips`, `LabeledPhotoGrid` | D2 | |
| `WaitingChecklist`, `QuickContactCard` | D2 | |

---

## 4. Thứ tự làm đề xuất

### Bước 1. Nền chung (không phụ thuộc BE mới)
1. Đưa kiểu `IDriverTripDetail` vào `packages/shared`, cho cả BE và FE cùng dùng.
2. Dựng `DriverShell` (sidebar + topbar) và đổi nav của driver thành 2 mục `?view=trip` / `?view=incident`.
3. Bỏ thẻ thống kê, danh sách và tabs. Mặc định chọn chuyến `IN_TRANSIT`, nếu không có thì chọn `READY`, giống logic hiện tại trong `DriverWorkspace`. Nếu tài xế có nhiều chuyến, đặt một dropdown nhỏ trên header.

### Bước 2. D1: Chuyến vận chuyển
1. **BE**: mở rộng `GET /tracking/trips/:id` (crew, khách hàng/người nhận, điều phối viên + SĐT, thông tin xe). Thêm test vào `apps/api/test/tracking.test.cjs` / `flow4-tracking.mysql.cjs`.
2. **FE**: `TripHeaderCard`, `StopTimeline`, `PreDepartureChecklist` (giai đoạn đầu lưu bằng `useDraft`). Nút "Bắt đầu chuyến đi" dùng lại luồng xác nhận giờ của `MilestonePanel`.
3. Bản đồ: tạm hiện `MapFallback` hoặc ảnh tĩnh cho đến khi có API `/map`.

*Phụ thuộc*: không có. *Rủi ro*: chưa rõ "Người nhận" là ai.

### Bước 3. D2: Báo cáo sự cố
1. Chốt mô hình dữ liệu (severity, vị trí, hư hại, nhãn ảnh). Viết migration, cập nhật `createIncidentSchema`, enum shared, `IIncident`, `INCIDENT_LABELS`.
2. FE: `IncidentReportPage` thay cho modal, dùng lại `useDraft` + `PhotoPicker`. Thêm `QuickContactCard` (dữ liệu điều phối viên có từ Bước 2) và `WaitingChecklist` tĩnh.
3. Ô vị trí: giai đoạn đầu lấy `getCurrentPosition` và hiện tọa độ thô, reverse geocode làm sau cùng với Bước 4.

*Phụ thuộc*: Bước 2 (thông tin điều phối viên). *Rủi ro*: đổi `urgency` sẽ ảnh hưởng màn Ops (`IncidentsTab`, `activeTrips.highUrgencyOpenIncidents`).

### Bước 4. D1b: Chuyến đang chạy
1. Làm trước phần **không cần GPS**: nút "Check-in chặng" trên header, `StopTimeline` 3 trạng thái, thẻ "Đã chạy", tên và giờ "Chặng tiếp", `EscortNoteCard`.
2. Làm tiếp Bước 4 GPS theo [tien-do-ban-do-gps.md](tien-do-ban-do-gps.md): `GET /tracking/trips/:tripId/map`, `POST /tracking/trips/:tripId/positions`, `useGpsSharing`, `DriverRouteMap`. Sau đó mới có km còn lại, ETA, tốc độ, vị trí xe. Bản đồ D1 cũng dùng chung phần này.

*Phụ thuộc*: Bước 1–2, và `MAPBOX_ACCESS_TOKEN` cho API. *Rủi ro*: quyền vị trí trên trình duyệt, pin/mạng yếu khi đang chạy, thời hạn lưu dữ liệu cá nhân (`TRACK_POSITION_RETENTION_DAYS`).

---

## 5. Quyết định đã chốt (22/10/2026)

Mỗi mục ghi: quyết định, việc phải làm, và thời điểm làm (theo các bước ở mục 4).

### 5.1 Mức độ sự cố → thêm `severity`, giữ `urgency`
- **Quyết định**:
  - Thêm cột `incidents.severity` enum `RED | ORANGE | YELLOW`, do tài xế chọn.
  - Giữ nguyên `urgency`, server vẫn tự suy theo thứ tự ưu tiên:
    1. `severity = RED` → `HIGH`
    2. `incidentType = HORSE_MEDICAL` → luôn `HIGH`
    3. Còn lại → `NORMAL`
- **Việc phải làm**:
  - Migration thêm cột `severity`.
  - `createIncidentSchema` ([tracking.validation.ts](../apps/api/src/features/tracking/tracking.validation.ts)) nhận `severity` (bắt buộc).
  - Shared: thêm enum `IncidentSeverity` vào [tracking.enum.ts](../packages/shared/src/enums/tracking.enum.ts), thêm trường `severity` vào `IIncident` và `IIncidentCreateInput`.
  - [tracking.service.ts](../apps/api/src/features/tracking/tracking.service.ts): sửa dòng tính `urgency` trong `createIncident`.
  - Cập nhật [openapi.tracking.ts](../apps/api/src/shared/config/openapi.tracking.ts) và test `tracking.test.cjs`, `flow4-tracking.mysql.cjs`.
  - Mức RED cho ra `urgency = HIGH`, nên thông báo tự có tiền tố `[KHẨN]` như hiện tại.
- **Màn Ops không phải sửa**: `IncidentsTab` và `highUrgencyOpenIncidents` vẫn đọc theo `urgency`.
- **Thời điểm**: Bước 3 (D2).

### 5.2 Người nhận → người riêng ở điểm đến, thêm cột vào `orders`
- **Quyết định**: Người nhận là một người riêng ở điểm đến, không phải khách hàng đặt đơn. Thêm cột vào `orders`, đề xuất `recipient_name` và `recipient_phone`.
- **Phân công**:
  - Form nhập người nhận thuộc **flow 1**, do bạn trong nhóm làm giao diện.
  - Phần driver chỉ đọc thêm các cột này trong `GET /tracking/trips/:id`.
- **Thời điểm**: Bước 2 (D1), sau khi flow 1 đã thêm cột. Trước khi có cột thì ô "Người nhận" hiện "—".

### 5.3 Checklist trước khi chạy → lưu ở client, không chặn cứng
- **Quyết định**:
  - Lưu bằng `useDraft` ([useDraft.ts](../apps/web/src/features/tracking/driver/useDraft.ts)) với khóa theo `tripId`.
  - Không khóa nút "Bắt đầu chuyến đi". Nếu chưa tick đủ, modal xác nhận hiện thêm cảnh báo **"Còn X mục chưa kiểm tra"**.
- **Để sau**: lưu checklist lên BE để điều phối xem được.
- **Thời điểm**: Bước 2 (D1).

### 5.4 Báo sự cố khi `READY` → cho phép
- **Lý do**: sự cố hay xảy ra lúc chất ngựa lên xe hoặc trước giờ chạy.
- **Việc phải làm**:
  - BE: trong `createIncident` ([tracking.service.ts](../apps/api/src/features/tracking/tracking.service.ts)), đổi điều kiện `orderStatus !== IN_TRANSIT` thành "không thuộc `READY | IN_TRANSIT`", và sửa câu lỗi 409 cho khớp.
  - FE: trong [DriverWorkspace.tsx](../apps/web/src/features/tracking/driver/DriverWorkspace.tsx), cho `canReport` nhận `READY | IN_TRANSIT` và sửa tooltip.
  - Test: các ca 409 hiện có dùng đơn `DELIVERED` nên vẫn đúng. Thêm một ca `READY` → 201.
- **Đã kiểm tra màn Ops: không lọc sự cố theo trạng thái đơn, không phải sửa gì.**
  - `getActiveTrips` ([tracking.repository.ts](../apps/api/src/features/tracking/tracking.repository.ts)) lấy chuyến `IN_TRANSIT` **hoặc** có sự cố chưa đóng, nên chuyến `READY` có sự cố vẫn hiện trên dashboard.
  - `getOpenIncidentCounts` chỉ lọc theo `status <> 'CLOSED'`.
  - [TripDetailPanel.tsx](../apps/web/src/features/tracking/ops/TripDetailPanel.tsx) cho thao tác với chuyến `READY`, và tab sự cố không lọc theo trạng thái đơn.
  - Lưu ý: thẻ tổng `inTransit` chỉ đếm chuyến `IN_TRANSIT`, còn `openIncidents` đếm cả sự cố của chuyến `READY`. Hai con số này đúng nghĩa, giữ nguyên.
- **Thời điểm**: làm được ngay, độc lập với các bước khác.

### 5.5 Nhật ký ngựa → chuyển sang actor Escort (lên kế hoạch sau)
- **Quyết định**: Nhóm sẽ thêm actor **Escort (hộ tống)** đi cùng tài xế. Escort chuyên quản lý ngựa và cập nhật trạng thái ngựa (nhật ký).
- **Ảnh hưởng tới màn tài xế**:
  - Không làm form nhật ký.
  - [HorseLogForm.tsx](../apps/web/src/features/tracking/driver/HorseLogForm.tsx) giữ nguyên cho tới khi có kế hoạch Escort.
  - Khi có actor này, thẻ "Ghi chú từ hộ tống" ở D1b sẽ lọc được chính xác. Hiện tại thì chưa (xem mục 3.1).
- **Thời điểm**: kế hoạch riêng, sau.

### 5.6 Giới hạn tốc độ và số cứu hộ → `system_parameters`
- **Quyết định**:
  - Giới hạn tốc độ: mã **`VMAX`**, giá trị mặc định `80` (km/h).
  - Số cứu hộ 24/7 ("Cứu hộ 24/7: 1900 1080" ở D2): mã **`HOTLINE`**.
- **Lý do đổi tên mã** (trước đây đề xuất `SPEED_LIMIT_KMH`): cột `system_parameters.param_code` là `varchar(10)`, không chứa được tên dài. Đặt mã ngắn giống `LEG_BACK` đang dùng.
- **Thời điểm**:
  - `HOTLINE` làm ở Bước F (D2).
  - `VMAX` không gấp, làm cùng Bước H (GPS), vì phải có GPS mới hiện được tốc độ.

### 5.7 Cỡ xe "Medium" → hiển thị số chuồng
- **Quyết định**: hiển thị `capacity_stalls`, ví dụ **"51C-482.19 · 4 chuồng"**. Không cần migration.
- **Việc phải làm**:
  - Trả `capacityStalls` trong thông tin xe của `GET /tracking/trips/:id`.
  - **Báo nhóm thiết kế** đổi chữ "Medium" trên Figma.
- **Thời điểm**: Bước 2 (D1).

### 5.8 "Cuộc gọi tự động" → sửa câu chữ, đưa tính năng vào backlog
- **Quyết định**: banner D2 đổi thành **"Mức đỏ sẽ gửi thông báo khẩn ngay tới điều phối viên."**, đúng với hành vi hiện tại (thông báo `IN_APP` có tiền tố `[KHẨN]`).
- **Backlog**: tính năng gọi tự động.
- **Báo nhóm thiết kế** sửa câu này trên Figma.
- **Thời điểm**: Bước 3 (D2).

### 5.9 Loại con của sự cố → cột `sub_type` varchar, danh sách ở shared
- **Quyết định**:
  - Thêm cột `incidents.sub_type` `varchar` nullable.
  - Danh sách loại con cố định đặt trong `packages/shared` (ví dụ hằng `INCIDENT_SUB_TYPES`, theo từng `incidentType`).
  - **Không mở rộng enum trong DB**, để sau này thêm loại con không phải viết migration.
- **Danh sách ban đầu**:

  | `incidentType` | Loại con |
  |---|---|
  | `VEHICLE_BREAKDOWN` (Hỏng xe) | Nổ lốp, Hỏng máy, Hết nhiên liệu, Khác |
  | `LONG_TRAFFIC_JAM` (Tắc đường) | *Đề xuất, cần xác nhận*: Tai nạn phía trước, Thi công / cấm đường, Ùn tắc giờ cao điểm, Khác |
  | `HORSE_MEDICAL` (Y tế ngựa) | *Đề xuất, cần xác nhận*: Chấn thương, Bỏ ăn / mất nước, Đau bụng (colic), Khác |

- **Việc phải làm**:
  - DB lưu **mã** (ví dụ `TIRE_BURST`), nhãn tiếng Việt đặt ở shared.
  - `createIncidentSchema` kiểm tra `subType` có thuộc danh sách của `incidentType` không.
  - Thêm `subType` vào `IIncident` và `IIncidentCreateInput`.
- **Thời điểm**: Bước 3 (D2), **gộp chung một migration với `severity`** (5.1).

### 5.10 Ảnh hưởng tới thứ tự làm (mục 4)

| Bước | Thay đổi sau khi chốt |
|---|---|
| Làm ngay | 5.4: cho báo sự cố khi `READY` (BE + FE + test), thay đổi nhỏ |
| Bước 2 (D1) | Checklist có cảnh báo trong modal (5.3). Hiện `capacity_stalls` (5.7). Đọc người nhận sau khi flow 1 thêm cột (5.2) |
| Bước 3 (D2) | Một migration cho `severity` + `sub_type` (5.1, 5.9). Danh sách loại con ở shared. Sửa câu banner (5.8) |
| Bước 4 (D1b/GPS) | Thêm tham số `VMAX` (5.6) |
| Để sau / backlog | Lưu checklist lên BE (5.3), actor Escort + nhật ký ngựa (5.5), cuộc gọi tự động (5.8) |

**Cần báo nhóm thiết kế**:
- Đổi "Medium" thành số chuồng (5.7).
- Sửa câu banner mức đỏ (5.8).
- Thêm ô chọn loại con trong D2 nếu dropdown hiện tại chưa thể hiện (5.9).

---

## 6. Kế hoạch thực hiện (chốt 22/10/2026)

### 6.1 Các bước

| # | Việc | Phụ thuộc | Ước lượng | Trạng thái |
|---|---|---|---|---|
| **A** | **Làm ngay**: cho báo sự cố khi `READY` (5.4): BE, FE, thêm test ca `READY` → 201 | – | Nhỏ | ✅ Xong 22/10 |
| **B** | **Nền dữ liệu**: 1 migration (`incidents`: severity, sub_type, lat/lng/location_text, damage_target · `attachments.caption` · `orders`: recipient_name/phone). Shared: enum `IncidentSeverity`, `DamageTarget`, hằng `INCIDENT_SUB_TYPES`, kiểu `IDriverTripDetail`. FE bỏ `TripDetail` tự khai báo | – | Vừa | ✅ Xong 22/10 (CI flow4 pass, PR #6) |
| **C** | **API trip detail**: `GET /tracking/trips/:id` trả thêm `crew[]`, `customer`, `recipient`, `coordinator {name, phone}`, `vehicles[] {id, code, type, capacityStalls}` + test + openapi | B | Vừa | ✅ Xong 22/10 (CI flow4 pass, PR #6) |
| **D** | **DriverShell** + nav `?view=trip` / `?view=incident`, bỏ thẻ thống kê, danh sách, tabs, thêm dropdown chọn chuyến | B | Vừa | ✅ Xong 23/10 (PR #7, CI #26 pass) |
| **E** | **D1**: `TripHeaderCard`, `StopTimeline`, `PreDepartureChecklist` (cảnh báo trong modal), bản đồ tạm `MapFallback` | C, D | Vừa | ✅ Xong 23/10 (PR #7, CI #26 pass) |
| **F** | **D2**: BE nhận các trường mới + suy `urgency` theo 5.1. FE `IncidentReportPage` + vị trí tọa độ thô + liên hệ nhanh + sửa banner | B, C | Lớn | ✅ Xong 23/10 (PR #7, CI #26 pass) |
| **G** | **D1b không GPS**: nút Check-in trên header, timeline 3 trạng thái, "Đã chạy", "Chặng tiếp", `EscortNoteCard` | E | Vừa | 🟡 Xong code 23/10, chờ review UI + CI |
| **H1** | **Backend bản đồ + GPS** (= Bước 4 trong [tien-do-ban-do-gps.md](tien-do-ban-do-gps.md)): `GET /trips/:tripId/map`, `POST/GET /trips/:tripId/positions`, dọn vị trí cũ, `VMAX` | G | Vừa | 🟡 Xong code 23/10, chờ CI + chạy migration 1800000009000 trên Aiven |
| **H2** | **FE bản đồ + chia sẻ GPS**: `useGpsSharing`, `DriverRouteMap` (bản đồ thật thay `MapFallback`), km còn lại, tốc độ/VMAX trên D1b. **Không** reverse geocode (điều khoản Mapbox) | H1 | Lớn | 🟡 Xong code 23/10, chờ review UI + thử GPS thật |
| **UI-1** | **Chỉnh giao diện tài xế theo phản hồi (trước H3)**: màn chuyến chỉ hiện chuyến đang hoạt động (bỏ dropdown), trang **Lịch sử giao hàng** + chi tiết chỉ xem, ô Xe 1 xe, thu gọn phần trên để thấy bản đồ ngay, sửa số km/nhãn tràn khung bản đồ | E | Vừa | 🟡 Xong code 23/10, chờ review UI + CI |
| – | **Backlog**: checklist lên BE, actor Escort + nhật ký, cuộc gọi tự động | – | – | — |

Ký hiệu trạng thái: ⬜ Chưa làm · 🟡 Đang làm · ✅ Xong.

**Ghi chú bước A (22/10/2026)**
- BE `createIncident` ([tracking.service.ts](../apps/api/src/features/tracking/tracking.service.ts)): nhận `READY | IN_TRANSIT`, câu lỗi 409 mới: "Chỉ báo sự cố khi chuyến sẵn sàng khởi hành (READY) hoặc đang vận chuyển (IN_TRANSIT)."
- FE `canReport` + tooltip ([DriverWorkspace.tsx](../apps/web/src/features/tracking/driver/DriverWorkspace.tsx)).
- OpenAPI: mô tả `POST /tracking/trips/:tripId/incidents` đổi thành "Order phải READY hoặc IN_TRANSIT (409)".
- Test `tracking.test.cjs`: thêm ca READY → tạo được, urgency NORMAL, có gửi thông báo. Ca 409 (đơn `DELIVERED`) giữ nguyên.
- Browser test `apps/web/test/driver.browser.cjs`: đảo assertion khi đơn READY (trước đây kiểm tra nút "Báo sự cố khẩn cấp" bị khóa, nay kiểm tra nút bật).
- `flow4-tracking.mysql.cjs` chưa thêm ca READY, vì thêm sự cố vào chuyến 101 sẽ làm đổi các số đếm dashboard ở các check sau.

**Ghi chú bước B (22/10/2026)**
- Migration [1800000007000-DriverIncidentDetails.ts](../apps/api/src/database/migrations/1800000007000-DriverIncidentDetails.ts):
  - `incidents`: thêm `severity`, `sub_type`, `damage_target`, `latitude`, `longitude`, `location_text`, cùng 3 CHECK cho tọa độ.
  - `attachments`: thêm `caption`.
  - `orders`: thêm `recipient_name`, `recipient_phone`.
  - Mọi cột đều NULLABLE, không DEFAULT. Đã thêm vào `test/load-schema.cjs`.
  - **Chưa chạy `migration:run`**, vì `.env` đang trỏ tới DB Aiven dùng chung.
- Shared:
  - Thêm enum `IncidentSeverity`, `DamageTarget`.
  - Thêm `constants/incident.constants.ts` (`INCIDENT_SUB_TYPES`, `isValidSubType`).
  - `IIncident`, `ILogAttachment` có thêm các trường mới (nullable). `IIncidentCreateInput` thêm các trường tùy chọn.
  - Thêm `ITripHorse`, `IDriverTripDetail`.
- BE:
  - `TrackingTripDetail` / `HorseInTrip` giờ là alias của kiểu shared.
  - Câu SELECT sự cố và ảnh trả thêm các cột mới. Tọa độ đổi sang number.
  - OpenAPI cập nhật schema `Incident` và `LogAttachment`.
  - **Chưa đổi** `createIncident` và `createIncidentSchema` (để Bước F).
- FE: bỏ `TripDetail` / `TripHorse` tự khai báo. 5 file driver dùng `IDriverTripDetail` / `ITripHorse`, giao diện không đổi.
- CI: thêm bước chạy `flow4-tracking.mysql.cjs`.
- Còn lại để chuyển ✅:
  - Chạy migration trên Aiven.
  - Xem kết quả CI flow4 (máy local không có MySQL nên chưa chạy test MySQL).

**Ghi chú bước C (22/10/2026)**
- Shared: thêm `ITripCrewMember`, `ITripContact`, `ITripVehicle`. `IDriverTripDetail` có thêm `crew`, `customer`, `recipient`, `coordinator`, `vehicles` (bắt buộc).
- Repository ([tracking.repository.ts](../apps/api/src/features/tracking/tracking.repository.ts)): 3 query mới, chỉ JOIN, không migration.
  - `getTripCrew`: `trip_assignments` JOIN `users`, DRIVER trước ESCORT.
  - `getTripContacts`: khách (`orders.customer_id`), người nhận (`orders.recipient_*`), điều phối (`trips.planned_by`, LEFT JOIN).
  - `getTripVehicles`: các xe khác nhau trong `legs`, theo chặng đầu tiên dùng xe.
- Phân quyền giữ nguyên. `getTripDetail` **không dùng** `authorizeTrip` mà tự kiểm tra:
  - Customer, Admin → 403.
  - Driver/Escort chưa được phân công → 404. Coordinator không phải người lập → 404.
  - Manager, Specialist → xem được mọi chuyến.
  - **Specialist** nhận `phone: null` cho crew, coordinator và người nhận (tên vẫn trả).
- `recipient`: null khi cả tên và SĐT đều trống. Chỉ có SĐT → `name: ""`.
- `coordinator`: null khi không JOIN được user (thực tế `planned_by` NOT NULL nên luôn có).
- OpenAPI: schema `TrackingCrewMember`, `TrackingVehicle`, `recipient`/`coordinator` inline (nullable) + ví dụ đầy đủ.
- Test: 3 unit test mới trong `tracking.test.cjs`. `flow4-tracking.mysql.cjs` thêm check GET `/trips/100` với tài xế (crew DRIVER+ESCORT kèm SĐT, `vehicles[0].capacityStalls = 4`, coordinator "Điều Phối A" kèm SĐT, recipient đúng giá trị fixture) và Specialist (phone của crew/coordinator/recipient đều null). Fixture thêm SĐT cho user 3, 6 và người nhận cho order 50.
- Còn lại để chuyển ✅: xem kết quả CI flow4.

**Ghi chú bước D + E (22/10/2026)**
- Khung riêng cho Driver/Escort ([DriverShell.tsx](../apps/web/src/features/tracking/driver/DriverShell.tsx), `driver-shell.css`). `DashboardShell` của các vai trò khác giữ nguyên.
  - Sidebar 2 mục `?view=trip` / `?view=incident`. View cũ (`assignments`, `milestones`, `horse-logs`, `overview`…) tự chuyển về `trip`.
  - Topbar: breadcrumb, tiêu đề đổi theo trạng thái ("Chuyến vận chuyển" / "Chuyến đang chạy" / "Báo cáo sự cố"), ô tìm kiếm lọc client theo mã đơn hoặc tên khách, chuông mở `NotificationsPanel` trong Drawer, ngày hôm nay.
  - Bảng màu teal/gold của Figma khai báo một lần thành biến `--drs-*`, chỉ có hiệu lực trong `.drs`.
- Màn D1: `TripHeaderCard`, `StopTimeline`, `PreDepartureChecklist`, bản đồ tạm là `MapFallback` cao 400px.
  - Logic ghi mốc của `MilestonePanel` tách thành hook [useLegAction.tsx](../apps/web/src/features/tracking/driver/useLegAction.tsx). Nút "Bắt đầu chuyến đi" và `MilestonePanel` đều dùng hook này.
  - Checklist lưu bằng `useDraft` theo `tripId`. Thiếu mục thì hộp thoại hiện "Còn X mục chưa kiểm tra", không khóa nút.
  - `IN_TRANSIT`: giữ nút hành động của chặng hiện tại và các chặng. Phần còn lại của D1b làm ở bước G.
  - `?view=incident`: tạm mở `IncidentDialog`, đóng hoặc gửi xong thì về `trip`.
- Đã bỏ: thẻ thống kê, `TripList`, `TripOverview`, Tabs. `HorseLogForm` giữ file nhưng không hiện (5.5).
- `apps/web/test/flow2.browser.cjs` hỏng ở dòng 15 (phần upload hồ sơ, `DocumentsWorkspace`): **lỗi có sẵn, không sửa**. Đã chạy trên `origin/dev` (8b2e241) bằng worktree riêng: cũng hỏng ở dòng 15, mỗi lần dừng ở một bước khác nhau. Code documents và `flow2-harness` của dev và `long` giống hệt nhau.
- Còn lệch Figma: khoảng cách km, nhãn tuyến, bản đồ thật, ghi chú "Nghỉ đêm" (không có dữ liệu); font Be Vietnam Pro chưa nạp; icon dùng `@ant-design/icons` thay vì SVG của Figma; khung cảnh báo của điều phối viên không có trên Figma.

**Ghi chú bước F (23/10/2026)**
- Migration [1800000008000-HotlineParam.ts](../apps/api/src/database/migrations/1800000008000-HotlineParam.ts) **đã chạy trên Aiven** (dòng `HOTLINE = '1900 1080'`; `down` xóa đúng dòng đó). CI flow4 pass (CI #26, PR #7).
- BE `POST /tracking/trips/:tripId/incidents`:
  - Bắt buộc `severity` (RED/ORANGE/YELLOW) và `damageTarget` (VEHICLE/HORSE/BOTH).
  - Tùy chọn: `subType` (phải thuộc `INCIDENT_SUB_TYPES` của loại, sai → 400), `latitude` + `longitude` (đủ cặp, đúng phạm vi), `locationText` (≤ 255), `captions[]` (≤ 100 ký tự, số nhãn ≤ số ảnh, gắn theo thứ tự ảnh).
  - `urgency` theo 5.1: RED hoặc `HORSE_MEDICAL` → HIGH, còn lại NORMAL. Audit ghi thêm `severity`, `subType`, `damageTarget`.
  - Multer nâng giới hạn số field chữ từ 10 lên 20 (form sự cố có tới 13 field).
  - **Client cũ không gửi `severity`/`damageTarget` sẽ nhận 400.** Trong repo chỉ còn màn D2 gọi API này.
- `GET /tracking/trips/:id` trả thêm `emergencyHotline` (đọc `system_parameters.HOTLINE`, không có dòng → `null`).
- FE: trang riêng [IncidentReportPage.tsx](../apps/web/src/features/tracking/driver/IncidentReportPage.tsx) ở `?view=incident` thay cho modal `IncidentDialog` (đã xóa).
  - Thành phần: `SeverityPicker`, `DamageTargetChips`, `LabeledPhotoGrid` (dùng lại `PhotoPicker`, thêm kiểu ô lớn + nhãn ảnh), `IncidentSidePanel` (Trong lúc chờ, Liên hệ nhanh, banner đỏ, sự cố đã báo).
  - Vị trí: GPS tự điền `lat, lng`; người dùng sửa ô thành chữ thì gửi `locationText`. Không có GPS thì để trống, không chặn gửi.
  - Ô chọn ngựa hiện khi chọn "Ngựa"/"Cả hai" hoặc loại "Y tế ngựa" (Figma thiếu ô này, xem 2.3).
  - Nháp (trừ ảnh) lưu theo chuyến; gửi xong xóa nháp, về `?view=trip` và hiện thông báo khẩn/thường.
- flow4: các POST sự cố đều gửi thêm `severity` + `damageTarget`. Ca sự cố của hộ tống đổi thành ca có vị trí + 2 ảnh có nhãn (thay vì thêm sự cố mới, để không làm lệch số đếm dashboard ở các check sau). Thêm các ca 400 và kiểm tra `emergencyHotline` (có dòng / không có dòng).
- **Màn Ops chưa sửa**: [IncidentsTab.tsx](../apps/web/src/features/tracking/ops/IncidentsTab.tsx) và [TripDetailPanel.tsx](../apps/web/src/features/tracking/ops/TripDetailPanel.tsx) chưa hiện mức độ, loại con, đối tượng hư hại, vị trí và nhãn ảnh. Dữ liệu đã có trong `IIncident`, cần làm ở một bước sau.
- Còn lệch Figma: font Be Vietnam Pro chưa nạp; icon dùng `@ant-design/icons`; ô ảnh dùng ảnh thật kèm ô nhãn thay vì ô màu có icon camera; dropdown "Loại sự cố" cho gõ để tìm.

**Ghi chú bước G (23/10/2026)**
- Chỉ FE, không đổi API. Khi `orderStatus = IN_TRANSIT`:
  - Topbar "Chuyến đang chạy" / "Bấm Check-in mỗi khi tới một chặng"; badge "Đang di chuyển".
  - Nút chung **"Check-in chặng"** (navy, đứng trước "Báo cáo sự cố") dùng lại `useLegAction` (xác nhận giờ, nhập bù, `pendingStore`, 409). Hook có thêm tùy chọn `title`: hộp thoại ghi rõ hành động, ví dụ "Xác nhận: Đã đến Trạm Đồng Nai", "Thông quan xong tại Cửa khẩu Mộc Bài", "Hoàn thành chặng tới …", "Xác nhận: Đã giao ngựa tại …". Không có hành động tiếp theo → nút khóa kèm tooltip.
  - Thẻ "Lộ trình chuyến đi": góc phải "ETA dd/MM HH:mm" (giờ đến dự kiến chặng cuối). Bản đồ vẫn `MapFallback`.
  - [LiveStatsCards.tsx](../apps/web/src/features/tracking/driver/LiveStatsCards.tsx): "Chặng tiếp" (điểm đến chặng hiện tại + giờ dự kiến), "Tốc độ" ("—", "Có ở bước bật GPS"), "Đã chạy" (từ giờ xuất phát thực tế chặng 1; dòng phụ "nghỉ tiếp sau …" hoặc "trễ …" màu cảnh báo). Tự cập nhật mỗi 60 giây.
  - `StopTimeline` 3 trạng thái: ✓ đã qua, 🚚 đang tới (điểm đến của chặng hiện tại), ○ chưa tới.
  - [EscortNoteCard.tsx](../apps/web/src/features/tracking/driver/EscortNoteCard.tsx): nhật ký ngựa mới nhất có ghi chú của **người khác** tài khoản đang đăng nhập (5.5: chưa lọc được theo vai trò escort). Không có thì ẩn.
- Mốc DELIVERED cuối cùng giữ luồng cũ; xong thì trang quay về "Chuyến vận chuyển", badge "Đã giao xong", thông báo "Tất cả các chặng đã hoàn thành".
- Còn lệch Figma: không có "Còn … km", badge GPS, tốc độ thật (bước H); ghi chú "Nghỉ đêm" (không có dữ liệu); font và icon như D1; khung "Cảnh báo từ điều phối viên" không có trên Figma.

**Ghi chú bước H1 (23/10/2026)**
- Chi tiết ở [tien-do-ban-do-gps.md](tien-do-ban-do-gps.md) mục "Bước 4". Chỉ backend; màn tài xế chưa đổi.
- **Cần làm trước khi chuyển ✅**: chạy migration [1800000009000-VmaxParam.ts](../apps/api/src/database/migrations/1800000009000-VmaxParam.ts) trên Aiven (`INSERT IGNORE` dòng `VMAX = 80`; `down` xóa đúng dòng đó); đặt `MAPBOX_ACCESS_TOKEN` cho API nếu muốn tuyến đường bộ thật (thiếu token → đường thẳng ước lượng, không lỗi); xem kết quả CI flow4.
- **Đổi so với dự kiến ở mục 5.6/2.3**: không reverse geocode và không lưu địa chỉ Mapbox vào DB (điều khoản Mapbox). `incidents` chỉ lưu `latitude/longitude`; `location_text` chỉ là chữ người dùng gõ.

**Ghi chú bước H2 (23/10/2026)**
- Chi tiết ở [tien-do-ban-do-gps.md](tien-do-ban-do-gps.md) mục "Bước 5–6 (phần tài xế)". Không sửa API.
- Bản đồ thật thay `MapFallback` ở thẻ "Lộ trình chuyến đi" (D1 + D1b); km trên header và góc thẻ; "còn X km" ở thẻ Chặng tiếp; thẻ Tốc độ dùng GPS + `VMAX`.
- Chia sẻ GPS: công tắc "Chia sẻ vị trí" + hộp thoại đồng ý lần đầu (thiết kế mục 10), gửi lô 30 giây, hàng đợi offline, Wake Lock. **Chỉ chia sẻ khi trang đang mở** (giới hạn của web), tự dừng khi chuyến giao xong hoặc ở chặng bay.
- Còn thiếu so với thiết kế: audit bật/tắt chia sẻ (cần API mới, đã chọn không làm ở bước này).
- **Cải tiến bản đồ tài xế (23/10)**: tuyến bám đường (`overview=full` + giản lược 8 m), màu bản đồ theo Figma, viền trắng cho tuyến. **Cần chạy migration `1800000010000-RouteCacheFull` trên Aiven** (xóa cache tuyến ROAD cũ). Chi tiết ở [tien-do-ban-do-gps.md](tien-do-ban-do-gps.md) Bước 4 và Bước 5–6.

**Ghi chú bước UI-1 (23/10/2026)**
- Chuyến hiển thị: IN_TRANSIT, không có thì READY khởi hành sớm nhất. Chuyến READY/IN_TRANSIT khác (nếu có) chỉ hiện một dòng "Còn N chuyến sắp tới: …" dưới header. **Quy tắc "một tài xế một chuyến hoạt động" cần chặn ở Flow 3 (phân công/duyệt kế hoạch)**; UI-1 không sửa Flow 3, cần hỏi người phụ trách Flow 3.
- Không có chuyến hoạt động: trạng thái trống "Bạn chưa có chuyến được phân công" + nút sang Lịch sử giao hàng.
- `?view=history`: bảng chuyến DELIVERED (API `driver/trips` hiện chỉ trả READY/IN_TRANSIT/DELIVERED nên chưa có CANCELLED; code đã chịu được nếu sau này API trả), phân trang 10 dòng, lọc bằng ô tìm kiếm trên topbar (mã đơn, khách hàng, tên điểm). Km lấy từ `/map`, số sự cố từ `/incidents`, chỉ gọi cho các dòng đang hiện (tối đa 20 request mỗi trang, trong giới hạn 60/phút của `/map`). "Giao thực tế" = giờ đến thực tế của chặng cuối (— nếu chưa có).
- `?view=history&trip=ID`: chi tiết chỉ xem, dùng lại thẻ bản đồ nhưng không GPS và không nút hành động.
- Ô "Xe": xe của chặng đang chạy / chặng đầu / chặng cuối, dạng "{biển số} · {n} chuồng".
- Bỏ banner "Tất cả các chặng đã hoàn thành" và khung "Cảnh báo từ điều phối viên" khỏi trang; hook `useTripAlerts` và component `DispatcherAlerts` được giữ lại để chuyển thành thông báo nổi.
- D1b: ba thẻ Chặng tiếp / Tốc độ / Đã chạy nằm ở cột phải ngay dưới "Các chặng" (màn < 1200px về lại dưới bản đồ). Bản đồ fit với lề 80px, nhãn điểm gửi/nhận tự đổi sang bên trái khi chấm sát mép phải; chuyến đã giao (xem lại lịch sử) không hiện marker xe.
- Bản đồ (mọi nơi dùng `BaseMap`): `projection="mercator"` (Mapbox GL v3 mặc định là globe, kiểm chứng bằng test), `minZoom` 3, góc nhìn mặc định Việt Nam (106,7; 10,8; zoom 6). Góc nhìn do `trackmap/map-view-plan.ts` quyết định: không điểm → Việt Nam; một điểm → zoom 10; nhiều điểm → fit lề 80 px (lề tự co khi khung nhỏ để fitBounds không thất bại); tọa độ hỏng hoặc (0, 0) bị bỏ. Điểm thiếu tọa độ hiện dòng "Điểm X chưa có tọa độ — nhờ Specialist ghim trên màn Địa điểm"; `/map` lỗi: giữ góc nhìn Việt Nam + thông báo nhỏ có nút "Thử lại" trong khung.
- Quyền hộ tống: API ghi mốc/hoàn thành chặng/gửi vị trí/báo sự cố cho mọi người được phân công chuyến (cả DRIVER và ESCORT), không phân biệt `assignment.role`; FE hiện nút Bắt đầu/Check-in/chia sẻ GPS cho cả hai vai trò. Chưa đổi; cần chốt với chủ nghiệp vụ.
- Mọi số km của màn tài xế dùng `formatKm` (tự ghép dấu chấm nghìn, không phụ thuộc locale của trình duyệt).

### 6.2 Bổ sung để không vướng D2

**1. Chốt thêm các cột D2 cần.** Mục 5 mới chốt `severity` và `sub_type`. D2 còn cần thêm các cột sau:

| Cột | Dùng cho |
|---|---|
| `incidents.latitude`, `incidents.longitude`, `incidents.location_text` | Ô "Vị trí (GPS tự động)" |
| `incidents.damage_target` (`VEHICLE \| HORSE \| BOTH`) | "Hư hại liên quan tới: Xe / Ngựa / Cả hai" |
| `attachments.caption` | Nhãn ảnh ("Lốp sau", "Toàn xe", "Khoang ngựa") |

Các cột này gộp vào **cùng migration** với `severity` + `sub_type` (bước B), để chỉ phải đụng bảng `incidents` một lần.

**2. Cột người nhận không phải chờ flow 1.**
- API driver không SELECT được cột chưa tồn tại, nên phải chốt tên cột **ngay hôm nay** với bạn làm flow 1: `recipient_name`, `recipient_phone`.
- Migration thêm 2 cột này (nullable) do người làm lô driver viết luôn trong bước B. Bạn làm flow 1 chỉ cần làm form.
- Như vậy không ai phải chờ ai.
