# Gap analysis: giao diện Hộ tống / Escort (Figma) so với code hiện tại

> Ngày lập: 26/10/2026 · Nhánh: `long` · Chưa sửa code (chỉ tài liệu).
> Thiết kế: Figma "Vận chuyển ngựa" (`XvYelFeTRkb5CFamqUHNak`), node `57:5425` (E1 Quản lý ngựa), `57:5637` (E2 Trạng thái ngựa).
> Cấu trúc theo [gap-analysis-driver.md](gap-analysis-driver.md). Phần chia quyền Tài xế / Hộ tống đã làm xong ở mục 5.5 của tài liệu đó.

## 0. Tóm tắt

- Thiết kế có **2 màn** cho hộ tống: **E1** Quản lý ngựa (nhật ký chăm sóc: cho ăn / uống nước / nghỉ chân) và **E2** Trạng thái ngựa (báo cáo sức khỏe bằng ảnh gửi khách hàng). Hai màn **thay chế độ "chỉ xem màn tài xế"** đang dùng tạm cho `crewRole = ESCORT`.
- Nhóm đã chốt 7 quyết định (mục 5): E1 là **nhật ký thực tế, không có lịch chăm sóc theo giờ**; E2 dùng **đúng 4 trạng thái** của `horse_logs`; báo cáo sức khỏe là **mở rộng `horse_logs`**; gửi khách theo cách đơn giản (bấm gửi là tới khách, không duyệt).
- **Đã có sẵn** (khoảng 40%): quyền theo `trip_assignments.role` (chỉ hộ tống ghi nhật ký ngựa), bảng `horse_logs` + ảnh (`attachments`, có `caption`), `POST /legs/:id/horse-logs`, luồng sự cố `HORSE_MEDICAL` (báo khẩn cho điều phối + quản lý), socket tới phòng `user:{id}`, `DriverShell`, `NotificationsPanel`, `useDriverRealtime`, `PhotoPicker`/`LabeledPhotoGrid`, `useDraft`.
- **Thiếu lớn**:
  1. Không có nơi lưu hoạt động chăm sóc (cho ăn / uống / nghỉ): cần **bảng mới `horse_care_activities`** + API.
  2. `horse_logs` chưa có nhiệt độ, nhịp tim, ăn uống, ghi chú cho khách, nháp/đã gửi, gửi khách, khách đã xem: cần **thêm cột nullable**.
  3. **Khách chưa có đường xem** báo cáo: không có API theo đơn, không xem được ảnh (`GET /attachments/:id` chặn khách), không có sự kiện socket cho khách. Phần hiển thị bên khách do Bảo làm, cần chốt hợp đồng API (mục 7.7).
  4. Khung hộ tống (sidebar 2 mục, màn trống, không tìm kiếm) chưa có; `DriverShell` đang cố định menu của tài xế.
- Đổi so với Figma: bỏ "Bữa tiếp theo / Sắp tới / Xác nhận / mục tiêu 120 L", bỏ trạng thái Mệt mỏi / Cần theo dõi / Bị thương (thay bằng 4 trạng thái FR + nút "Báo sự cố y tế").

Ký hiệu: ✅ đã có, dùng được ngay · ⚠️ có nhưng lệch hoặc chỉ suy ra một phần · ❌ chưa có.

---

## 1. Danh sách màn hình và phần dùng chung

| Mã | Tên màn | Khi nào hiển thị | Figma node | Nút chính |
|---|---|---|---|---|
| E1 | Quản lý ngựa | Hộ tống có chuyến `READY` / `IN_TRANSIT` | `57:5425` | "Lưu nhật ký" (Ghi nhận nhanh), "Báo sự cố y tế" trên thẻ ngựa (mới) |
| E2 | Trạng thái ngựa | Như E1 | `57:5637` | "Lưu nháp", "Gửi báo cáo cho khách hàng", "Báo sự cố y tế" (mới) |
| E0 | Màn trống | Hộ tống chưa có chuyến được phân công | (chưa có Figma, giống màn trống tài xế) | "Tải lại" |

**Phần dùng chung**
- **Sidebar**: logo "Vận chuyển ngựa", badge "ESCORT · Hộ tống", nhóm "Điều hướng" **2 mục**: *Quản lý ngựa* (icon thức ăn), *Trạng thái ngựa* (icon máy ảnh). Thẻ người dùng ở đáy (tên, "Hộ tống", đăng xuất).
- **Topbar**: breadcrumb "Hộ tống / …", tiêu đề, mô tả, nút "Báo sự cố" nhỏ (đã chốt 6.7), chuông thông báo, ô ngày. Ô tìm kiếm "Tìm mã đơn, khách hàng…" trên Figma **bỏ** (hộ tống chỉ có một chuyến đang hoạt động, giống quyết định UI-1 của tài xế).
- **Thông báo nổi + chuông**: dùng lại nguyên bộ UI-2 (cảnh báo điều phối, "+N cảnh báo khác", sự cố được tiếp nhận, `notification:new`).

---

## 2. Dữ liệu và API theo từng màn

Thiết kế dưới đây là **bản đã điều chỉnh** theo quyết định 1 (E1) và 3 (E2).

### 2.1 E1: Quản lý ngựa

| Khối UI | Dữ liệu hiển thị | Nguồn API | TT |
|---|---|---|---|
| Tiêu đề / mô tả | "Quản lý ngựa", "Nhật ký chăm sóc · chuyến {orderCode}" (Figma ghi "Lịch cho ăn và uống nước") | `GET /tracking/driver/trips` → `orderCode`, `crewRole` | ✅ |
| Thẻ mỗi ngựa: tên | `horses[].name` | `GET /tracking/trips/:id` | ✅ |
| Thẻ mỗi ngựa: "Thoroughbred · 5 tuổi" | `breed`, tuổi từ `birth_date` (cột có ở bảng `horses`) | `GET /tracking/trips/:id` chỉ trả `id, name, passportNo, orderStatus` | ⚠️ cần thêm `breed`, `birthDate` vào `ITripHorse` |
| Thẻ mỗi ngựa: "khoang 1" | Vị trí ngựa trong xe | Không có cột gán ngựa ↔ khoang (`vehicles.capacity_stalls` chỉ là số chuồng) | ❌ bỏ khỏi dòng phụ (hoặc đặt sau khi có bảng gán khoang) |
| Thẻ mỗi ngựa: ảnh đại diện | Ảnh ngựa | Không có ảnh ngựa trong DB | ❌ dùng ô chữ cái đầu / placeholder |
| Thẻ mỗi ngựa: badge tình trạng | Trạng thái báo cáo sức khỏe **mới nhất** đã gửi của ngựa ("Sức khỏe ổn định"…); chưa có thì "Chưa có báo cáo" | `GET /tracking/trips/:id/horse-logs` (lọc báo cáo, mới nhất theo ngựa) | ⚠️ có `conditionStatus` nhưng chưa phân biệt báo cáo và nhật ký cũ, chưa có nháp/đã gửi |
| Dải "Lần cho ăn gần nhất: X giờ trước" (thay "Bữa tiếp theo lúc 12:00") | Hoạt động `FEED` mới nhất của ngựa | **Mới**: `GET /tracking/trips/:id/care-activities` | ❌ |
| Danh sách hoạt động **đã ghi hôm nay**, mới nhất trên | Giờ, loại (cho ăn / uống nước / nghỉ chân), khẩu phần hoặc lượng, người ghi | như trên | ❌ |
| Nút "Xác nhận" / nhãn "Sắp tới" / "Đã xong" | **Bỏ** (không có lịch) | – | – |
| Nút "Báo sự cố y tế" trên thẻ ngựa (mới) | Mở form sự cố `HORSE_MEDICAL` đã chọn sẵn ngựa | `POST /tracking/trips/:id/incidents` | ✅ API; ⚠️ FE cần nhận tham số ngựa/loại |
| "Ghi nhận nhanh": Ngựa | Chọn một ngựa (hoặc "Cả đoàn" cho nghỉ chân) | `horses[]` | ✅ |
| "Ghi nhận nhanh": Hoạt động | Cho ăn / Uống nước / Nghỉ chân | **Mới** enum `FEED / WATER / REST` | ❌ |
| "Ghi nhận nhanh": Khẩu phần / lượng | Cho ăn: chữ ("Cỏ khô 3 kg + cà rốt"); Uống nước: số lít; Nghỉ chân: số phút. Figma chỉ có 1 ô chữ, nhưng "Hôm nay" cần cộng số lít và số phút nên ô đổi theo loại | **Mới** | ❌ |
| "Ghi nhận nhanh": Giờ thực hiện | Mặc định bây giờ, cho lùi giờ (cùng ngưỡng `LEG_BACK` như mốc) | `getMaxRetroactiveMinutes()` có sẵn | ⚠️ tái dùng ngưỡng, chưa áp cho hoạt động |
| "Ghi nhận nhanh": nút "Lưu nhật ký" | Tạo một hoạt động | **Mới** `POST /tracking/trips/:id/care-activities` | ❌ |
| Thẻ "Hôm nay" | **Chỉ tổng thực tế**: lít nước, số bữa ăn, số lần nghỉ + tổng phút. Bỏ "/ 120 L", "/ 6 bữa" và thanh tiến độ mục tiêu | Tính từ danh sách hoạt động trong ngày (client gửi `from`, `to`) | ❌ |

### 2.2 E2: Trạng thái ngựa

| Khối UI | Dữ liệu hiển thị | Nguồn API | TT |
|---|---|---|---|
| Ngựa (select) | Danh sách ngựa của đơn | `horses[]` | ✅ |
| Thời điểm | Giờ ghi nhận (mặc định bây giờ) | `horse_logs.logged_at` (`loggedAt`, không quá +60 giây, lùi theo ngưỡng mốc) | ✅ |
| Tình trạng chung | **4 chip**: Sức khỏe ổn định / Bỏ ăn / Căng thẳng / Khí hậu thay đổi (thay Khỏe mạnh / Mệt mỏi / Cần theo dõi / Bị thương) | `horse_logs.condition_status` enum `STABLE / OFF_FEED / STRESSED / CLIMATE_CHANGE` | ✅ DB và API; ⚠️ FE: nhãn `CONDITIONS` hiện là "Ổn định / … / Thời tiết", cần đổi nhãn cho khớp |
| Nút "Báo sự cố y tế" (thay trạng thái "Bị thương") | Mở form sự cố y tế gắn đúng ngựa; báo khẩn cho điều phối + quản lý | `POST /tracking/trips/:id/incidents` (`HORSE_MEDICAL`, `horseId`) | ✅ API (đã tự `urgency = HIGH` và `notifyManagersAndCoordinators`) |
| Nhiệt độ ("37,8 °C") | Số thập phân | Chưa có cột | ❌ `horse_logs.body_temp_c` |
| Nhịp tim ("38 lần/phút") | Số nguyên | Chưa có cột | ❌ `horse_logs.heart_rate_bpm` |
| Ăn uống ("Bình thường") | Bình thường / Giảm / Bỏ | Chưa có cột (`condition_status` là tình trạng chung, không thay được) | ❌ `horse_logs.appetite` |
| Ảnh tình trạng (Toàn thân / Chân & móng / Trong khoang / Chụp ảnh) | Ảnh có nhãn, đi cùng báo cáo; **bắt buộc ≥ 1 ảnh khi gửi** với `OFF_FEED / STRESSED / CLIMATE_CHANGE` (đã chốt 6.9) | `attachments` có `caption`, `POST horse-logs` nhận `photos` nhưng **chưa nhận `captions`** (sự cố thì có) | ⚠️ |
| Ghi chú cho khách hàng | Văn bản tối đa 1000 ký tự | `horse_logs.note` hiện là ghi chú nội bộ | ⚠️ thêm `customer_note` riêng (xem 4.1) |
| Tick "Gửi thông báo đến khách hàng {tên}" | Quyết định có thông báo cho khách không | Chưa có | ❌ `horse_logs.send_to_customer` |
| "Áp dụng cho tất cả ngựa" (mới, đã chốt 6.4) | Sao chép nội dung form sang từng ngựa còn lại, mỗi ngựa một báo cáo riêng | Chỉ FE (tạo nhiều báo cáo qua `POST /legs/:id/horse-logs`) | ❌ |
| "Lưu nháp" | Lưu báo cáo chưa gửi, sửa tiếp được | Chưa có (`horse_logs` hiện chỉ thêm mới) | ❌ `report_status = DRAFT` + API sửa nháp |
| "Gửi báo cáo cho khách hàng" | Gửi ngay tới khách, không duyệt; điều phối luôn thấy | Chưa có | ❌ `report_status = SENT`, `sent_at`, socket + thông báo |
| Cột "Báo cáo đã gửi hôm nay" | Mỗi báo cáo: tên ngựa, badge trạng thái, ảnh thu nhỏ, giờ, "Khách đã xem" / "Đã gửi". Bản "Lúc lên xe — cả 2 ngựa" trên Figma = một báo cáo cho nhiều ngựa | Chưa có `customer_viewed_at`; chưa có truy vấn theo ngày | ❌. **Quy ước**: mỗi báo cáo ứng với **một ngựa** (không có báo cáo cả đoàn; có nút "Áp dụng cho tất cả ngựa", đã chốt 6.4) |
| Nhãn "Khách đã xem" | Thời điểm khách mở báo cáo | `horse_logs.customer_viewed_at` + API khách | ❌ |

### 2.3 E0: Màn trống (hộ tống chưa có chuyến)

| Khối UI | Nguồn | TT |
|---|---|---|
| "Bạn chưa có chuyến được phân công" + nút "Tải lại" | `GET /tracking/driver/trips` rỗng | ✅ (dùng lại `DriverWorkspace` phần empty state) |
| Nút "Xem lịch sử giao hàng" của tài xế | Hộ tống chưa có màn lịch sử | ❌ để sau (đã chốt 6.6) |

### 2.4 Phần dùng chung

| Khối UI | Nguồn API | TT |
|---|---|---|
| Thẻ user, đăng xuất | `useAuth()` | ✅ |
| Chuông thông báo (compact) | `GET /notifications`, `POST /notifications/:id/read`, `notification:new` | ✅ (UI-2) |
| Cảnh báo điều phối nổi + "+N cảnh báo khác" | `GET /tracking/trips/:id/alerts`, `tracking:alert` | ✅ (UI-2, hộ tống cũng là crew nên nhận cùng sự kiện) |
| Sự cố được tiếp nhận / đóng | `tracking:incident_updated` | ✅ |
| Ô ngày hôm nay | FE tự tạo | ✅ |

---

## 3. Đối chiếu với code hiện có

### 3.1 API và bảng

**Đã có, dùng lại**

| Hạng mục | Chi tiết | File |
|---|---|---|
| Chia quyền theo vai trò crew | `trip_assignments.role`; hộ tống mới được `POST /legs/:id/horse-logs`, tài xế 403; hộ tống 403 ở mốc/hoàn thành/GPS; đọc nhật ký và báo sự cố cả hai | [tracking.service.ts](../apps/api/src/features/tracking/tracking.service.ts) |
| `POST /tracking/legs/:legId/horse-logs` | Ghi nhật ký + ảnh (multipart `photos`), `correctsLogId` để đính chính, chỉ khi `IN_TRANSIT` và chặng đã xuất phát | như trên |
| `GET /tracking/trips/:tripId/horse-logs` | Trả `IHorseLog` có `attachments` và `createdByCrewRole` | như trên |
| Bảng `horse_logs` | `horse_id, leg_id, condition_status, note, logged_at, created_by, corrects_log_id`; **chỉ thêm mới** | `apps/api/test/fixtures/schema.sql` |
| Bảng `attachments` | `horse_log_id`, `incident_id`, `caption` (đã có từ migration `1800000007000`) | `apps/api/src/database/migrations/1800000007000-DriverIncidentDetails.ts` |
| Sự cố `HORSE_MEDICAL` | Bắt buộc `horseId`, `urgency = HIGH`, thông báo quản lý + điều phối | [tracking.service.ts](../apps/api/src/features/tracking/tracking.service.ts) |
| Socket | `SocketService.emitToUsers` tới `user:{id}`; `TrackingService` có cổng `TrackingRealtime` phát sau commit, lỗi chỉ ghi log | [socket.service.ts](../apps/api/src/shared/socket/socket.service.ts) |
| Timeline cho khách | `GET /tracking/orders/:orderId/timeline` (chỉ khách sở hữu, chỉ khi kế hoạch đã duyệt) | như trên |

**Còn thiếu**

| Endpoint / thay đổi | Phục vụ | Ghi chú |
|---|---|---|
| `GET /tracking/trips/:id` thêm `breed`, `birthDate` cho `horses[]` | E1 dòng phụ thẻ ngựa | JOIN có sẵn, thêm cột vào `ITripHorse` |
| `POST /tracking/trips/:tripId/care-activities` | E1 "Lưu nhật ký" | Chỉ ESCORT |
| `GET /tracking/trips/:tripId/care-activities?from&to` | E1 danh sách + tổng "Hôm nay" + "lần cho ăn gần nhất" | Đọc: cả 2 vai trò + điều phối / quản lý / chuyên viên |
| Mở rộng `POST /legs/:legId/horse-logs` (+ `captions`, `bodyTempC`, `heartRateBpm`, `appetite`, `customerNote`, `sendToCustomer`, `reportStatus`) | E2 lưu nháp / gửi | Giữ tương thích: trường mới đều tùy chọn, bản cũ không gửi thì như cũ |
| `PATCH /tracking/horse-logs/:id` (chỉ nháp, chỉ người tạo) và `POST /tracking/horse-logs/:id/send` | E2 sửa nháp, gửi nháp | Báo cáo đã gửi bất biến, sửa = tạo bản đính chính (`correctsLogId`) |
| `DELETE /tracking/horse-logs/:id` (chỉ nháp) | E2 bỏ nháp | Xóa cả ảnh của nháp |
| `GET /tracking/orders/:orderId/horse-reports` (khách) | Khách xem danh sách báo cáo đã gửi | Hợp đồng ở mục 7.7 |
| `POST /tracking/orders/:orderId/horse-reports/:id/view` (khách) | Đánh dấu "khách đã xem" | Phát socket cho hộ tống |
| `GET /tracking/attachments/:id` cho khách | Xem ảnh báo cáo | Hiện chặn khách. Chỉ mở cho ảnh của báo cáo `SENT` + `send_to_customer`, đơn của chính khách |
| Sự kiện socket `tracking:horse_report`, `tracking:horse_report_viewed` | Khách nhận báo cáo; hộ tống thấy "Khách đã xem" ngay | Phát sau commit, tới `user:{customerId}` / `user:{createdBy}` |

**Chỗ lệch cần sửa**

| Vấn đề | Chi tiết |
|---|---|
| Nhãn trạng thái FE khác FR | `CONDITIONS` ([tracking.api.ts](../apps/web/src/features/tracking/tracking.api.ts)) dùng "Ổn định / Bỏ ăn / Căng thẳng / Thời tiết"; cần "Sức khỏe ổn định / Bỏ ăn / Căng thẳng / Khí hậu thay đổi" (cả `CONDITION_LABEL` trong `tracking.format.ts` và màn Ops) |
| `horse_logs` "chỉ thêm mới" | Nháp cần sửa/xóa được. Quy tắc bất biến chỉ áp cho báo cáo `SENT` và nhật ký cũ (`report_status IS NULL`) |
| `note` dùng chung ý nghĩa | Hiện là ghi chú nội bộ và nguồn của thẻ "Ghi chú từ hộ tống" ở màn tài xế. Ghi chú gửi khách phải tách cột để không lộ ghi chú nội bộ cho khách |
| Chặn xem ảnh với khách | `getAttachmentFile` chỉ cho Manager/Coordinator/Specialist/Driver; khách nhận 404 |
| Ops chưa biết báo cáo nháp | `GET /trips/:id/timeline` có `horseLogs`; phải **lọc bỏ nháp** (điều phối chỉ thấy `SENT` và nhật ký cũ) |
| Quy tắc ghi nhật ký | Hiện chỉ khi `IN_TRANSIT` và chặng đã xuất phát. **Đã chốt 6.2**: cho ghi khi `READY` và `IN_TRANSIT`, chặn `DELIVERED` (khi `READY` dùng chặng đầu làm `leg_id`) |

### 3.2 Frontend

**Dùng lại được**

| Thành phần | Dùng cho |
|---|---|
| [DriverShell.tsx](../apps/web/src/features/tracking/driver/DriverShell.tsx) | Khung (sidebar, topbar, chuông, drawer). Cần tham số hóa `DRIVER_NAV`, `ROLE_LABEL`, ẩn tìm kiếm, `heading` |
| [DriverNotices.tsx](../apps/web/src/features/tracking/driver/DriverNotices.tsx), `useAlertToasts`, `useDriverRealtime` | Toast, "+N cảnh báo khác", socket 3 sự kiện; thêm lắng nghe `tracking:horse_report_viewed` |
| [NotificationsPanel.tsx](../apps/web/src/features/notifications/NotificationsPanel.tsx) (`compact`) | Chuông của hộ tống, không đổi |
| [PhotoPicker.tsx](../apps/web/src/features/tracking/driver/PhotoPicker.tsx), [LabeledPhotoGrid.tsx](../apps/web/src/features/tracking/driver/LabeledPhotoGrid.tsx) | Ảnh có nhãn của E2 (đã làm cho sự cố D2: nhãn gợi ý, tối đa số ảnh, kiểm kích thước) |
| [useDraft.ts](../apps/web/src/features/tracking/driver/useDraft.ts) | Nháp phía client cho form "Ghi nhận nhanh" (không cần lên server) |
| [IncidentReportPage.tsx](../apps/web/src/features/tracking/driver/IncidentReportPage.tsx) | Form sự cố (mặc định đã là "Y tế ngựa" cho ESCORT); thêm nhận `horseId` / loại từ nút "Báo sự cố y tế" |
| [AttachmentImage.tsx](../apps/web/src/features/tracking/AttachmentImage.tsx) | Hiện ảnh báo cáo (tải qua API có token) |
| [DriverWorkspace.tsx](../apps/web/src/features/tracking/driver/DriverWorkspace.tsx), [useDriverTrips.ts](../apps/web/src/features/tracking/driver/useDriverTrips.ts), [DriverDashboard.tsx](../apps/web/src/features/auth/pages/Driver/DriverDashboard.tsx) | Tải chuyến, màn trống, lỗi + "Thử lại"; `crewRole` của chuyến đang hoạt động quyết định hiện shell tài xế hay hộ tống |
| [HorseLogForm.tsx](../apps/web/src/features/tracking/driver/HorseLogForm.tsx) | Giữ file, **lấy logic** (tải nhật ký, đính chính, mất mạng); không hiện lại nguyên bản |

**Cần dựng mới**: `EscortShell` (hoặc `DriverShell` tham số hóa), `EscortDashboard`, `CareLogPage` (E1: thẻ ngựa, danh sách hoạt động, `QuickLogCard`, `TodaySummaryCard`), `HorseReportPage` (E2: form + `SentReportsFeed`), hook `useCareActivities`, `useHorseReports`, nút "Báo sự cố y tế".

**Vào màn hộ tống**: [HomePage.tsx](../apps/web/src/features/home/HomePage.tsx) trả `DriverDashboard` cho `DRIVER_ESCORT`; `DriverDashboard` rẽ nhánh theo `crewRole` của chuyến đang hoạt động (hoặc chuyến lịch sử gần nhất khi chưa có chuyến). Tài xế không vào được màn hộ tống và ngược lại (API vẫn là chốt chặn cuối).

---

## 4. Mô hình dữ liệu mới

Migration đánh số **từ `1800000013000`** theo quy ước chung (không dùng lại số đã có; kiểm `migration:show` trước khi đặt tên). Đề xuất một migration `1800000013000-EscortHorseCare`. **Mọi cột mới nullable hoặc có mặc định** để nhật ký cũ giữ nguyên và không phải backfill.

### 4.1 Cột thêm cho `horse_logs`

| Cột | Kiểu | Nullable | Ý nghĩa |
|---|---|---|---|
| `body_temp_c` | `decimal(3,1)` | có | Nhiệt độ (°C), kiểm khoảng 30,0–45,0 |
| `heart_rate_bpm` | `smallint unsigned` | có | Nhịp tim (lần/phút), kiểm 10–200 |
| `appetite` | `enum('NORMAL','REDUCED','REFUSED')` | có | Ăn uống: Bình thường / Giảm / Bỏ |
| `customer_note` | `varchar(1000)` | có | Ghi chú gửi cho khách (tách khỏi `note` nội bộ) |
| `report_status` | `enum('DRAFT','SENT')` | có (`NULL` = nhật ký cũ / không phải báo cáo) | Nháp / đã gửi |
| `send_to_customer` | `tinyint(1)` | có (mặc định `0`) | Có gửi thông báo cho khách không (tick E2) |
| `sent_at` | `datetime` | có | Lúc bấm gửi (UTC) |
| `customer_viewed_at` | `datetime` | có | Lúc khách mở báo cáo lần đầu |

Chỉ mục: `(report_status, sent_at)` hoặc `(horse_id, report_status, logged_at)` để lấy "báo cáo mới nhất của ngựa". Ràng buộc: `report_status = 'SENT'` thì `sent_at` không null (kiểm ở service, không cần CHECK).

**Cột và ràng buộc chi tiết (Bước 1)**: `body_temp_c DECIMAL(3,1)`, `heart_rate_bpm SMALLINT UNSIGNED`, `appetite ENUM('NORMAL','REDUCED','REFUSED')`, `customer_note VARCHAR(1000)`, `report_status ENUM('DRAFT','SENT')`, `send_to_customer TINYINT(1) NOT NULL DEFAULT 0` (cột duy nhất không nullable, có DEFAULT nên dòng cũ tự bằng 0), `sent_at`, `customer_viewed_at` (`DATETIME`, UTC). CHECK: `ck_horse_logs_temp` (30,0–45,0), `ck_horse_logs_hr` (10–200), `ck_horse_logs_sent` (đã gửi thì có `sent_at`), `ck_horse_logs_viewed` (chỉ `SENT` mới có `customer_viewed_at`). Chỉ mục `idx_horse_logs_report (horse_id, report_status, logged_at)`.

**Quy tắc**: nhật ký cũ (`report_status IS NULL`) và báo cáo `SENT` bất biến; chỉ `DRAFT` được sửa / xóa, và chỉ người tạo. Ảnh dùng `attachments.horse_log_id` + `caption`.

### 4.2 Bảng mới `horse_care_activities` (ghi nhận hoạt động chăm sóc)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | `bigint unsigned` PK | |
| `trip_id` | `bigint unsigned` FK `trips` | Lọc theo chuyến |
| `leg_id` | `bigint unsigned` FK `legs`, null | Chặng đang chạy lúc ghi (suy ra, không bắt buộc) |
| `horse_id` | `bigint unsigned` FK `horses`, **null** | `NULL` = cả đoàn (dùng cho "Nghỉ chân") |
| `activity_type` | `enum('FEED','WATER','REST')` | Cho ăn / Uống nước / Nghỉ chân |
| `feed_description` | `varchar(200)`, null | Khẩu phần ("Cỏ khô 3 kg + cà rốt"), chỉ `FEED` |
| `amount_liters` | `decimal(5,1)`, null | Lượng nước, chỉ `WATER` |
| `duration_minutes` | `smallint unsigned`, null | Thời gian nghỉ, chỉ `REST` |
| `note` | `varchar(255)`, null | Ghi chú ngắn |
| `performed_at` | `datetime` | Giờ thực hiện (UTC) |
| `created_by` | `bigint unsigned` FK `users` | Hộ tống ghi |
| `created_at` | `datetime` default `utc_timestamp()` | |
| `corrects_activity_id` | `bigint unsigned`, null FK chính nó | Đính chính (bảng chỉ thêm mới như `horse_logs`) |

Chỉ mục `(trip_id, performed_at)`, `(horse_id, performed_at)`. Ràng buộc: service kiểm trước để trả 400, DB có CHECK phòng thủ: `ck_care_horse` (chỉ `REST` được `horse_id` NULL), `ck_care_feed`, `ck_care_water` (`amount_liters` 0,1–200 bắt buộc), `ck_care_rest` (`duration_minutes` 1–720 bắt buộc); FK tới `trips`, `legs`, `horses`, `users` và chính bảng (`corrects_activity_id`); `trips.repository.hasHistory` cũng khóa theo bảng này. **Không** có bảng lịch / mục tiêu (quyết định 1).

### 4.3 Chỉ số "Hôm nay" và "Lần cho ăn gần nhất"

Không lưu, tính khi đọc: lít nước = `SUM(amount_liters)` của `WATER`; số bữa = `COUNT` của `FEED`; số lần nghỉ = `COUNT` + `SUM(duration_minutes)` của `REST`; "lần cho ăn gần nhất" = `MAX(performed_at)` của `FEED` theo ngựa. Khoảng "hôm nay" do client gửi `from`/`to` (00:00–24:00 theo máy hộ tống), tránh quy ước múi giờ cứng khi chuyến qua nhiều nước.

---

## 5. Quyết định đã chốt (26/10/2026)

### 5.1 E1 là nhật ký thực tế, không có lịch chăm sóc
- Thẻ mỗi ngựa liệt kê **hoạt động đã ghi hôm nay** (cho ăn / uống nước / nghỉ chân + khẩu phần / lượng + giờ), mới nhất trên.
- "Lần cho ăn gần nhất: X giờ trước" thay cho "Bữa tiếp theo". Bỏ nhãn Sắp tới / Đã xong và nút Xác nhận.
- "Ghi nhận nhanh" là nơi nhập chính. "Hôm nay" chỉ tổng thực tế (lít nước, số bữa, số lần nghỉ + phút), không mục tiêu.
- **Việc phải làm**: bảng `horse_care_activities` (4.2), API ghi / đọc, FE E1.

### 5.2 Hộ tống chỉ có 2 màn E1/E2
- Sidebar ESCORT 2 mục, **thay** chế độ "chỉ xem màn tài xế" tạm thời. Tài xế không vào màn hộ tống.
- Quyền theo `trip_assignments.role` (đã chặn ở API).
- **Việc phải làm**: bỏ nhánh chỉ-xem trong `DriverWorkspace` khi E1/E2 xong; `DriverDashboard` rẽ theo `crewRole`.

### 5.3 E2 dùng đúng 4 trạng thái FR
- Sức khỏe ổn định / Bỏ ăn / Căng thẳng / Khí hậu thay đổi (`STABLE / OFF_FEED / STRESSED / CLIMATE_CHANGE`). **Bỏ** "Bị thương".
- Thay bằng nút **"Báo sự cố y tế"** → luồng `incidents` `HORSE_MEDICAL` gắn đúng ngựa, báo khẩn cho điều phối + quản lý như hiện có.
- **Việc phải làm**: đổi nhãn FE; FE nhận `horseId` + loại cho form sự cố.

### 5.4 Báo cáo sức khỏe = mở rộng `horse_logs`
- Không tạo hệ thống trạng thái riêng. Thêm cột (4.1). Nhật ký cũ giữ nguyên.

### 5.5 Gửi khách theo cách đơn giản
- Hộ tống bấm gửi → báo cáo tới khách **ngay** (có tick "Gửi thông báo đến khách hàng"). **Không** có bước duyệt.
- Điều phối viên của chuyến **luôn thấy** mọi báo cáo đã gửi.
- Báo cáo có trạng thái **Bỏ ăn / Căng thẳng / Khí hậu thay đổi** → gửi thêm **thông báo nổi bật cho điều phối** (để chủ động liên hệ khách).

### 5.6 Khách xem báo cáo
- Phía mình: API danh sách báo cáo đã gửi theo đơn, đánh dấu "khách đã xem", sự kiện socket cho khách, quyền xem ảnh.
- Phần hiển thị bên khách do Bảo làm; hợp đồng API ở mục 7.7.

### 5.7 Hộ tống chưa có chuyến
- Màn trống giống tài xế (E0). Lịch sử: chưa làm (đã chốt 6.6).

### 5.8 Bảng quyền cho API mới

| API | DRIVER | ESCORT | COORDINATOR (chuyến mình lập) | CUSTOMER (đơn của mình) | MANAGER / SPECIALIST |
|---|---|---|---|---|---|
| `POST /trips/:id/care-activities` | ❌ 403 | ✅ | ❌ 403 | ❌ 403 | ❌ 403 |
| `GET /trips/:id/care-activities` | ✅ | ✅ | ✅ | ❌ 403 | ✅ (Manager, Specialist) |
| `POST /legs/:id/horse-logs` (nhật ký / báo cáo, nháp hoặc gửi) | ❌ 403 | ✅ | ❌ 403 | ❌ 403 | ❌ 403 |
| `PATCH` / `DELETE /horse-logs/:id` (chỉ nháp, chỉ người tạo) | ❌ 403 | ✅ (người tạo) | ❌ 403 | ❌ 403 | ❌ 403 |
| `POST /horse-logs/:id/send` | ❌ 403 | ✅ (người tạo) | ❌ 403 | ❌ 403 | ❌ 403 |
| `GET /trips/:id/horse-logs` (đọc) | ✅ (không thấy nháp của người khác) | ✅ (thấy nháp của mình) | ✅ (chỉ `SENT` + nhật ký cũ) | ❌ 403 | ✅ Manager; Specialist như hiện có |
| `GET /orders/:orderId/horse-reports` | ❌ 403 | ❌ 403 | ❌ 403 | ✅ (chỉ `SENT` + `send_to_customer = 1`) | ❌ 403 |
| `POST /orders/:orderId/horse-reports/:id/view` | ❌ 403 | ❌ 403 | ❌ 403 | ✅ | ❌ 403 |
| `GET /attachments/:id` (ảnh báo cáo) | ✅ (không xem ảnh nháp) | ✅ (xem ảnh nháp của mình) | ✅ (không xem ảnh nháp) | ✅ chỉ ảnh báo cáo đã gửi cho đơn của mình, còn lại 404 | như hiện có (không xem ảnh nháp) |
| `POST /trips/:id/incidents` (kể cả `HORSE_MEDICAL`) | ✅ | ✅ | ❌ 403 | ❌ 403 | ❌ 403 |

Người không được phân công chuyến: 404 (như các API tracking hiện có). Khách không phải chủ đơn: 404.

---

## 6. Câu hỏi đã chốt (26/10/2026)

Mỗi mục giữ **đề xuất gốc** và ghi **quyết định** của nhóm.

### 6.1 Thẻ "Ghi chú từ hộ tống" của tài xế
- **Đề xuất gốc**: giữ `note` (nội bộ) hay hiện cả `customer_note`? Đề xuất hiện `COALESCE(note, customer_note)` của bản ghi mới nhất do ESCORT ghi.
- **Quyết định**: hiện `COALESCE(note, customer_note)` của nhật ký / báo cáo mới nhất có ghi chú do ESCORT ghi (`createdByCrewRole = ESCORT`). Làm ở Bước 3.

### 6.2 Khi nào hộ tống được ghi
- **Đề xuất gốc**: hiện chỉ khi đơn `IN_TRANSIT` và chặng đã xuất phát; cho phép cả `READY` (lúc chất ngựa), vẫn chặn `DELIVERED`.
- **Quyết định**: **cho ghi khi đơn `READY` và `IN_TRANSIT`, chặn `DELIVERED`**, áp cho hoạt động chăm sóc và báo cáo sức khỏe (cả `POST /legs/:id/horse-logs`). Khi `READY` chưa có chặng đã xuất phát nên `leg_id` lấy chặng đầu tiên của chuyến. Làm ở Bước 2/3.

### 6.3 Sửa sai hoạt động chăm sóc
- **Đề xuất gốc**: bảng chỉ thêm mới, sửa bằng bản đính chính (`corrects_activity_id`) giống `horse_logs`; hay cho xóa trong 5 phút.
- **Quyết định**: **đính chính bằng `corrects_activity_id`, không xóa.** Danh sách và tổng "Hôm nay" bỏ qua bản gốc đã bị đính chính.

### 6.4 Báo cáo cho cả đoàn
- **Đề xuất gốc**: 1 báo cáo = 1 ngựa; hộ tống tạo từng ngựa, có thể có nút "Áp dụng cho tất cả ngựa".
- **Quyết định**: **1 báo cáo = 1 ngựa + nút "Áp dụng cho tất cả ngựa"** trên E2: sao chép nội dung form (trạng thái, ghi chú, ảnh) sang từng ngựa còn lại, mỗi ngựa vẫn là một báo cáo riêng, hộ tống chỉnh số đo (nhiệt độ, nhịp tim) từng con trước khi gửi.

### 6.5 Báo cáo được đính chính, khách thấy gì
- **Đề xuất gốc**: chỉ bản mới nhất của mỗi lần đính chính, bản cũ ẩn với khách.
- **Quyết định**: **khách chỉ thấy bản mới nhất.** `GET /orders/:orderId/horse-reports` loại bản gốc đã bị bản `SENT` khác đính chính (`corrects_log_id`). Hộ tống và điều phối vẫn thấy cả chuỗi.

### 6.6 Lịch sử giao hàng của hộ tống
- **Đề xuất gốc**: bỏ ở đợt này.
- **Quyết định**: **chưa làm lịch sử hộ tống.** Màn trống E0 chỉ có "Tải lại".

### 6.7 Báo sự cố chung của hộ tống
- **Đề xuất gốc**: nút "Báo sự cố" nhỏ ở topbar bên cạnh "Báo sự cố y tế" trên thẻ ngựa.
- **Quyết định**: **nút "Báo sự cố" nhỏ trên topbar E1/E2** (mở form sự cố mặc định "Y tế ngựa · Khác"); nút "Báo sự cố y tế" trên thẻ ngựa / E2 mở cùng form với ngựa chọn sẵn.

### 6.8 Một tài khoản vừa DRIVER vừa ESCORT ở hai chuyến
- **Đề xuất gốc**: shell theo `crewRole` của chuyến đang hoạt động.
- **Quyết định**: **shell theo `crewRole` của chuyến đang hoạt động** (chưa có chuyến thì theo chuyến lịch sử gần nhất, mặc định tài xế). Không có bộ chọn vai trò.

### 6.9 Ảnh bắt buộc
- **Đề xuất gốc**: không bắt buộc với "Sức khỏe ổn định", bắt buộc ≥ 1 ảnh với 3 trạng thái còn lại.
- **Quyết định**: **bắt buộc ≥ 1 ảnh với `OFF_FEED / STRESSED / CLIMATE_CHANGE`** khi **gửi** (nháp được thiếu ảnh); API trả 400, FE chặn trước.

### 6.10 Ngưỡng nhiệt độ / nhịp tim
- **Đề xuất gốc**: chỉ kiểm khoảng hợp lệ, chưa cảnh báo tự động.
- **Quyết định**: **chỉ kiểm khoảng hợp lệ** (nhiệt độ 30,0–45,0 °C, nhịp tim 10–200 lần/phút, kiểm ở service và CHECK ở DB). Không cảnh báo tự động.

---

## 7. Thứ tự làm đề xuất

Ước lượng theo ngày làm việc của một người, đã gồm test API (unit + MySQL) và kiểm tra giao diện. Tổng **~11–13 ngày**.

### Bước 1. Nền dữ liệu (0,5–1 ngày)
1. Migration `1800000013000-EscortHorseCare`: cột mới của `horse_logs` + bảng `horse_care_activities` (mục 4). `down()` đầy đủ; kiểm trên DB trống và DB đã có dữ liệu.
2. Cập nhật `schema.sql` (fixture test), `IHorseLog` + kiểu mới trong `packages/shared`, `ITripHorse` thêm `breed`, `birthDate`, enum `CareActivityType`, `HorseAppetite`, `HorseReportStatus`, OpenAPI.
3. Hằng số / nhãn dùng chung ở shared: nhãn 4 trạng thái FR (thay `CONDITIONS` cục bộ).

*Phụ thuộc*: không. *Rủi ro*: trùng timestamp migration với nhóm; kiểm `migration:show` và hỏi Bảo trước khi đặt số.

### Bước 2. API hoạt động chăm sóc (1–1,5 ngày)

> **Đã làm (26/10/2026)**: `POST` / `GET /tracking/trips/:tripId/care-activities` (hộ tống ghi, đọc cho crew / điều phối / quản lý / chuyên viên), `summary`, đính chính ẩn bản cũ, test unit + flow4. Quy ước thêm: `feedDescription` bắt buộc với FEED; `summary` tính trên đúng các bản ghi trả về (bản gốc đã bị đính chính không được tính); không có `from`/`to` thì trả toàn bộ (tối đa 1000 dòng); đính chính bản đã bị đính chính trả 409 (đính chính bản mới nhất).
1. `POST /trips/:id/care-activities` (ESCORT, đơn `READY` hoặc `IN_TRANSIT`, chặn `DELIVERED`; kiểm trường theo loại, giờ như mốc, đính chính bằng `corrects_activity_id`, không xóa) và `GET` (+ `from`, `to`), kèm `summary` tùy chọn.
2. Test: unit từng vai trò (DRIVER 403, ESCORT, không phân công 404), flow4 MySQL (ghi, đọc, đính chính, rollback khi lỗi).
3. Dữ liệu demo: thêm hoạt động chăm sóc vào `seed-flow4-demo`.

*Phụ thuộc*: Bước 1.

### Bước 3. API báo cáo sức khỏe (2,5–3 ngày)

> **Đã làm (26/10/2026)**, không cần migration mới (`notifications.event_type` là `varchar(50)`, `related_type` là `varchar(30)`).
> - `POST /legs/:legId/horse-logs` giữ route cũ. Không có `reportStatus` = nhật ký cũ (bất biến); có `reportStatus` (`DRAFT` | `SENT`) = báo cáo sức khỏe với `customerNote`, `bodyTempC`, `heartRateBpm`, `appetite`, `sendToCustomer`, `captions[]` (nhãn ảnh). Đơn `READY` ghi vào **chặng đầu** của chuyến (chặng khác: 409); `IN_TRANSIT` giữ luật cũ (chặng đã xuất phát); `DELIVERED`: 409.
> - `PATCH /horse-logs/:id` (**thay toàn bộ nội dung**: trường vắng = xóa; thêm ảnh bằng `photos`, bỏ ảnh bằng `removeAttachmentIds`; tổng ≤ 3 ảnh), `DELETE /horse-logs/:id` (204, xóa cả ảnh và tệp), `POST /horse-logs/:id/send` (body tùy chọn `{ sendToCustomer }`). Chỉ nháp của chính hộ tống tạo: người khác cùng chuyến 403, ngoài chuyến 404, bản đã gửi / nhật ký cũ 409.
> - Luật gửi: `OFF_FEED` / `STRESSED` / `CLIMATE_CHANGE` cần ≥ 1 ảnh; `sendToCustomer` cần `customerNote` (400). Nháp thiếu cả hai vẫn lưu được. Sửa / gửi khi đơn không còn `READY` / `IN_TRANSIT`: 409 (xóa nháp vẫn được).
> - Khi gửi, trong cùng transaction: `sent_at`, thông báo `HORSE_REPORT` (liên kết `ORDER`) cho khách nếu `sendToCustomer`, thông báo `HORSE_REPORT_ALERT` (liên kết `TRIP`) cho điều phối viên lập chuyến nếu trạng thái bất thường (kể cả khi không gửi khách). Sau commit: socket `tracking:horse_report` + `notification:new` tới khách, `notification:new` tới điều phối; `tracking:horse_report_viewed` tới hộ tống khi khách mở lần đầu.
> - Đọc nội bộ (`GET /trips/:id/horse-logs`, `timeline`): nháp chỉ người tạo thấy; còn lại thấy nhật ký cũ + báo cáo đã gửi. Ảnh của nháp chỉ người tạo tải được. Thẻ "Ghi chú từ hộ tống" của tài xế dùng `note` rồi `customerNote` (web `latestEscortNote`, bỏ qua `DRAFT`).
> - Đính chính: bản gốc phải là báo cáo đã gửi (hoặc nhật ký cũ); báo cáo đã có bản đính chính không đính chính lại được (409); nháp thì sửa, không đính chính (400).
> - Khách: `GET /orders/:orderId/horse-reports`, `POST /orders/:orderId/horse-reports/:id/view`, `GET /attachments/:id` mở cho khách với ảnh báo cáo đã gửi cho đơn của họ. Quy ước: nếu bản gốc là `SENT` + gửi khách thì bản đính chính **bắt buộc** `sendToCustomer = true` khi gửi (gửi ngay hoặc gửi nháp; nháp vẫn lưu được) → 400; nhờ vậy chuỗi khách → nội bộ → khách không xảy ra và khách luôn thấy đúng một phiên bản. Khi gửi nháp đính chính, API khóa bản gốc rồi kiểm lại: bản gốc đã có bản đính chính khác đã gửi (hai nháp cùng sửa một bản) → 409.
> - Không sửa file của Bảo (`socket.service.ts`, `lib/socket.ts`): dùng `emitToUsers` đã có.
1. Mở rộng `POST /legs/:id/horse-logs` (trường mới, `captions`, nháp / gửi; cho `READY` và `IN_TRANSIT`; **gửi** các trạng thái `OFF_FEED / STRESSED / CLIMATE_CHANGE` phải có ≥ 1 ảnh; chỉ kiểm khoảng hợp lệ cho nhiệt độ / nhịp tim); `PATCH`, `DELETE` nháp, `POST /horse-logs/:id/send`.
2. Gửi khách: `send_to_customer`, `sent_at`, thông báo IN_APP cho khách (`HORSE_REPORT`, liên kết đơn), socket `tracking:horse_report` tới `user:{customerId}`; trạng thái bất thường → thông báo nổi bật cho điều phối (`HORSE_REPORT_ALERT`) + `notification:new`.
3. Khách: `GET /orders/:orderId/horse-reports` (chỉ bản mới nhất của chuỗi đính chính), `POST …/:id/view` (đặt `customer_viewed_at`, socket `tracking:horse_report_viewed` tới hộ tống), mở `GET /attachments/:id` cho ảnh báo cáo đã gửi.
4. Ops / tài xế: lọc nháp khỏi `timeline.horseLogs` và `GET /trips/:id/horse-logs` (trừ người tạo); thẻ "Ghi chú từ hộ tống" lấy `COALESCE(note, customer_note)` (đã chốt 6.1).
5. Test: unit + flow4 MySQL (nháp → sửa → gửi, quyền 2 chiều, khách của đơn khác 404, ảnh, thông báo / socket đúng phòng và chỉ sau commit, rollback).

*Phụ thuộc*: Bước 1, 2 (khung test). *Rủi ro*: chạm socket và thông báo của Bảo (chỉ thêm, liệt kê chỗ sửa để báo bạn ấy).

### Bước 4. Khung hộ tống + E1 (2 ngày)

> **Đã làm (27/10/2026)**, không migration, không sửa file của Bảo.
> - `DriverDashboard` chọn khung theo `crewRole` của chuyến đang hoạt động (chưa có thì chuyến lịch sử gần nhất, mặc định tài xế; trong lúc tải chỉ hiện spinner để không nhấp nháy): ESCORT → `escort/EscortArea` (dùng lại `DriverShell` qua `nav`, `topbarAction`, `showDescription`, `onHorseReportViewed`), DRIVER → `DriverArea` như cũ. View của vai trò kia quy về view mặc định (hộ tống: `care` / `incident`; tài xế: `trip` / `history` / `incident`).
> - E1 `CareLogPage`: thẻ ngựa (giống · tuổi, badge báo cáo đã gửi mới nhất, "Lần cho ăn gần nhất" toàn chuyến, hoạt động hôm nay), `QuickLogCard` (FEED / WATER / REST theo ràng buộc API, REST "Cả đoàn", "Áp dụng cho tất cả ngựa" với FEED/WATER, thử lại chỉ phần còn thiếu, nháp `useDraft`, giờ mặc định là giờ lúc gửi), "Sửa" = đính chính (khóa ngựa và loại; không có xóa), `TodayCard` (chỉ tổng thực tế), `CareHistoryList` (phân trang 10 dòng). Khác Figma có chủ đích: bỏ lịch "Bữa tiếp theo / Sắp tới / Xác nhận", bỏ "khoang n", ẩn mục E2 trong sidebar tới Bước 5, không dùng `TripHeaderCard`.
> - Realtime: `tracking:horse_report_viewed` thêm vào `useDriverRealtime` (một socket dùng chung) → toast "Khách đã xem báo cáo sức khỏe của …"; `notification:new` dùng chuông có sẵn.
> - Xóa nhánh hộ tống chỉ xem: `isDriver` và `drv-view-only` trong `DriverWorkspace` / `driver.css`; `IncidentScreen` tách riêng dùng chung cho cả hai vai trò.
> - Test: `apps/web/test/escort.browser.cjs` (17 nhóm) và bộ `apps/web/test/driver/` (harness + 6 file theo màn + `run-all.cjs`) thay `driver.browser.cjs`; cổng test mặc định 5181 (`WEB_TEST_PORT`).
1. Tham số hóa `DriverShell` (nav, nhãn vai trò, bỏ tìm kiếm, nút "Báo sự cố" nhỏ trên topbar, `heading`; shell theo `crewRole` chuyến đang hoạt động), `EscortDashboard`, màn trống E0.
2. `CareLogPage`: thẻ ngựa (badge tình trạng, "Lần cho ăn gần nhất"), danh sách hoạt động hôm nay, `QuickLogCard` (ô lượng đổi theo loại, lùi giờ, nháp `useDraft`), thẻ "Hôm nay", nút "Báo sự cố y tế".
3. Bỏ nhánh chỉ-xem của màn tài xế. Tách `driver.browser.cjs` thành `test/driver/*` và thêm `escort.browser.cjs`.

*Phụ thuộc*: Bước 2.

### Bước 5. E2 + "Báo sự cố y tế" (2–2,5 ngày)
1. `HorseReportPage`: chọn ngựa + thời điểm, nút "Áp dụng cho tất cả ngựa", 4 chip trạng thái, nhiệt độ / nhịp tim / ăn uống, `LabeledPhotoGrid` (nhãn Toàn thân / Chân & móng / Trong khoang), ghi chú cho khách, tick gửi khách, "Lưu nháp" / "Gửi báo cáo".
2. Cột "Báo cáo đã gửi hôm nay" (badge, ảnh thu nhỏ, "Khách đã xem" / "Đã gửi" cập nhật qua socket), mở lại nháp để sửa.
3. Nút "Báo sự cố y tế" mở `IncidentReportPage` với ngựa và loại chọn sẵn.
4. Test trình duyệt: gửi / nháp / sửa, 4 trạng thái, quyền, socket "khách đã xem" giả lập.

*Phụ thuộc*: Bước 3, 4.

### Bước 6. Hợp đồng API cho Bảo + bàn giao (0,5 ngày)
1. Chốt mục 7.7 với Bảo (payload, sự kiện socket, loại thông báo, quyền ảnh), gửi kèm ví dụ response trong OpenAPI.
2. Liệt kê chỗ đã sửa trong file của Bảo (socket, thông báo, `getAttachmentFile`) để bạn ấy review.

*Phụ thuộc*: Bước 3. Có thể làm song song với Bước 4–5.

### 7.7 Hợp đồng API cho phần khách (Bảo làm hiển thị)

**Danh sách báo cáo đã gửi theo đơn** (khách sở hữu đơn; kế hoạch đã duyệt và đơn `READY` / `IN_TRANSIT` / `DELIVERED`):

`GET /api/v1/tracking/orders/:orderId/horse-reports` → `200`

```json
[{
  "id": "601",
  "horseId": "21",
  "horseName": "Silver Moon",
  "conditionStatus": "OFF_FEED",
  "bodyTempC": 37.8,
  "heartRateBpm": 38,
  "appetite": "REDUCED",
  "customerNote": "Silver Moon ăn ít khẩu phần trưa, đã theo dõi thêm.",
  "photos": [{ "id": "801", "caption": "Toàn thân", "fileType": "JPG" }],
  "loggedAt": "2026-10-26T05:20:00.000Z",
  "sentAt": "2026-10-26T05:25:00.000Z",
  "viewedAt": null,
  "escortName": "Lê Thị Mai"
}]
```

- Mới nhất trước (`sentAt`), tối đa 200; chỉ báo cáo `SENT` với `send_to_customer = 1`. Bản gốc đã được đính chính bởi một bản `SENT` + gửi khách khác bị ẩn (khách chỉ thấy bản mới nhất). Bản đính chính của một báo cáo đã gửi khách luôn phải gửi khách (400 nếu không), hai nháp cùng đính chính một bản chỉ gửi được một (409). Gửi khách luôn có `customerNote`. `photos[].id` dùng với `GET /api/v1/tracking/attachments/:id` (có token, trả tệp) như ảnh của các màn khác.
- Đơn của người khác: `404`. Vai trò không phải khách: `403`.

**Đánh dấu đã xem**: `POST /api/v1/tracking/orders/:orderId/horse-reports/:id/view` → `200 { "viewedAt": "…" }` (idempotent: gọi lại giữ nguyên thời điểm đầu). Gọi khi khách **mở chi tiết** một báo cáo, không gọi khi chỉ tải danh sách.

**Socket** (kết nối chung `lib/socket.ts`, phòng `user:{customerId}`, phát sau khi hộ tống gửi và đã commit):
- `tracking:horse_report` → `{ reportId, orderId, horseId, horseName, conditionStatus, sentAt }`
- `notification:new` → `{ id, content, createdAt, eventType: "HORSE_REPORT" }` khi hộ tống tick "Gửi thông báo đến khách hàng". Thông báo IN_APP tương ứng có `related_type = 'ORDER'`, `related_id = orderId` nên nút "Xem đơn hàng" của `NotificationsPanel` mở đúng đơn.

**Phía hộ tống** (cho Bảo biết để không đụng): `tracking:horse_report_viewed` → `{ reportId, viewedAt }` tới `user:{escortId}`; sự kiện, bảng, route mới đều thuộc `tracking`, không đổi `payment:updated` / `order:status_updated`.

**Gợi ý hiển thị** (Bảo quyết định): thêm mục "Sức khỏe ngựa" trong chi tiết đơn / theo dõi, badge theo `conditionStatus` (xanh / vàng / cam / xanh dương), lưới ảnh có `caption`, nhãn "Chưa xem" cho báo cáo mới, tự tải lại khi nhận `tracking:horse_report`.
