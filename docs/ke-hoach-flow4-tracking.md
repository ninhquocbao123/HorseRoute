# Flow 4 — Cập nhật trạng thái và nhật ký lộ trình

**Cập nhật:** 19/10/2026 · **Trạng thái:** đã triển khai backend, giao diện và kiểm thử (còn các mục ở phần VII).
Tài liệu này thay bản kế hoạch ngày 18/10/2026. Bản cũ lệch schema ở vài điểm nên được sửa theo thực tế, xem phần VI.

## I. Phạm vi MVP

- Ghi tiến độ theo chặng bằng các mốc Driver nhập tay; không GPS, IoT hay bản đồ trực tiếp.
- Nhật ký sức khỏe từng con ngựa (chỉ thêm mới, có ảnh, có bản ghi đính chính).
- Báo sự cố khẩn cấp; Coordinator tiếp nhận và đóng kèm hướng xử lý; cảnh báo thủ công.
- Coordinator/Manager hiệu chỉnh chặng khi có sai sót thực tế (bắt buộc lý do, lưu audit cũ/mới).
- Timeline cho Customer (đơn của mình), timeline nội bộ và dashboard vận hành.
- Order tự đổi trạng thái theo chặng (FR-ORD-15): chặng 1 xuất phát `READY → IN_TRANSIT`; mốc `DELIVERED` ở chặng cuối `→ DELIVERED`.
- Ngoài phạm vi: đổi lộ trình và chi phí phát sinh (Flow 5), nghiệm thu điện tử (Flow 6), chế độ offline đầy đủ.

## II. Tiến độ triển khai

| Bước | Nội dung | Trạng thái |
|---|---|---|
| 0 | Dọn nền: bỏ bản đồ Mapbox demo, gỡ phụ thuộc, giải quyết xung đột | Xong |
| 1 | Backend chặng, mốc, hoàn thành chặng, hiệu chỉnh | Xong |
| 2 | Backend nhật ký ngựa, sự cố, cảnh báo, ảnh đính kèm | Xong |
| 3 | Backend timeline Customer, timeline nội bộ, dashboard vận hành | Xong |
| 4 | Giao diện Driver/Escort trên điện thoại | Xong |
| 5 | Giao diện Customer, Coordinator, Manager, Specialist | Xong |
| 6 | Kiểm thử MySQL thật, hồi quy, tài liệu | Xong |

## III. Quy tắc nghiệp vụ đã chốt

**Luồng chặng.** `NOT_STARTED →(DEPARTED)→ MOVING →(ARRIVED_AT_STOP)→ AT_STOP →(CUSTOMS_CLEARED nếu điểm đến là BORDER)→ COMPLETED`.
- Chặng trung gian hoàn tất bằng `POST /legs/{id}/complete`; **chặng cuối hoàn tất bằng mốc `DELIVERED`** (không có mốc `COMPLETED`).
- Chặng k+1 chỉ xuất phát khi chặng k đã `COMPLETED`. Mỗi loại mốc ghi một lần trên một chặng.
- DEPARTED chặng 1 yêu cầu Trip `APPROVED` và Order `READY`.

**Thời điểm (BR-LEG-03).** `occurredAt` là ISO UTC có `Z`, không ở tương lai (cho lệch đồng hồ 60 giây), không sớm hơn mốc trước của chặng, nhập bù tối đa **T phút**: mặc định 120, đổi bằng dòng `LEG_BACK` trong `system_parameters` (giá trị sai tự quay về 120). Không dùng mã `T` vì seed đã dùng mã này với nghĩa khác.

**Hiệu chỉnh chặng (BR-LEG-04).** Chỉ khi Trip `APPROVED` và Order `READY/IN_TRANSIT/DELIVERED`. Trạng thái đích phải khác hiện tại và giữ thứ tự (chặng đã/đang chạy thì mọi chặng trước phải `COMPLETED`). Trong cùng transaction: xoá mốc không còn phù hợp, thêm mốc còn thiếu, chỉnh giờ thực tế, đồng bộ Order, ghi audit giá trị cũ/mới kèm lý do, gửi thông báo.

**Nhật ký ngựa (BR-LOG-01).** Không có API sửa/xoá. Ghi nhầm thì tạo bản ghi mới với `correctsLogId` (cùng chuyến, cùng ngựa). Chỉ ghi khi Order `IN_TRANSIT` và chặng đã xuất phát.

**Sự cố.** Chỉ báo khi Order `IN_TRANSIT`. `HORSE_MEDICAL` bắt buộc `horseId` và tự đặt `urgency=HIGH`. Thông báo ngay cho Coordinator phụ trách và mọi Manager ACTIVE. Trạng thái một chiều `NEW → ACKNOWLEDGED → CLOSED` (đóng thẳng từ NEW được); đóng bắt buộc `handlingNote`. Sự cố **không tự đổi lộ trình/chặng** (BR-INC-03).

**Cảnh báo.** Coordinator phụ trách, khi Order `READY` hoặc `IN_TRANSIT`; thông báo cho Driver/Escort được phân công và mọi Manager (chưa gửi Customer).

**Ảnh đính kèm.** `multipart/form-data`, field `photos`, tối đa 3 ảnh, mỗi ảnh ≤ 5 MB, chỉ JPG/PNG (kiểm tra theo nội dung). Dùng lại kho tệp của Flow 2 (local hoặc Supabase). Ghi DB lỗi thì xoá ảnh đã lưu.

**Trạng thái Trip.** `trips.plan_status` chỉ có `DRAFT/PENDING_APPROVAL/APPROVED`, nên Flow 4 **chỉ đổi Order**; tiến độ vận hành suy ra từ `orders.status` và `legs.status`.

**Trễ hạn.** Chặng chưa `COMPLETED` mà đã quá `planned_arrival_at`. Dashboard chỉ tính cho chuyến `IN_TRANSIT`. Chưa có số phút đệm (tài liệu Flow 3 cũng chưa chốt).

## IV. API (`/api/v1/tracking`, đều cần JWT; chi tiết ở Swagger, nhóm "Flow 4 - Tracking")

| Method | Đường dẫn | Vai trò |
|---|---|---|
| GET | `/driver/trips` | Driver/Escort |
| GET | `/trips/{id}` | Driver (được phân công), Coordinator (chuyến mình), Manager, Specialist |
| POST | `/legs/{legId}/milestones` | Driver/Escort được phân công |
| POST | `/legs/{legId}/complete` | Driver/Escort được phân công |
| PATCH | `/legs/{legId}/correct` | Coordinator (chuyến mình), Manager |
| POST / GET | `/legs/{legId}/horse-logs` · `/trips/{tripId}/horse-logs` | Driver ghi; Driver, Coordinator, Manager, Specialist xem |
| POST / GET | `/trips/{tripId}/incidents` | Driver báo; Driver, Coordinator, Manager xem |
| PATCH | `/incidents/{id}` | Coordinator phụ trách |
| POST / GET | `/trips/{tripId}/alerts` | Coordinator phát; Driver, Coordinator, Manager, Specialist xem |
| GET | `/attachments/{id}` | Theo quyền chuyến; ảnh sự cố không gồm Specialist |
| GET | `/orders/{orderId}/timeline` | Customer là chủ đơn |
| GET | `/trips/{tripId}/timeline` | Driver, Coordinator, Manager, Specialist (Specialist không nhận sự cố) |
| GET | `/operations/active-trips` | Manager, Specialist (tất cả); Coordinator (chuyến mình) |

Quy ước: người ngoài phạm vi chuyến hoặc đơn nhận **404** (không lộ sự tồn tại), sai vai trò nhận **403**. Customer không gọi `GET /trips/{id}`; họ xem tiến độ qua timeline đơn.

## V. Giao diện

| Vai trò | Khu vực (`?view=`) | Nội dung |
|---|---|---|
| Driver/Escort | `assignments`, `milestones`, `horse-logs` | Thẻ chuyến; **một nút lớn** theo chặng hiện tại (xác nhận trong 2 lần chạm); nhật ký ngựa kèm ảnh và đính chính; nút báo sự cố khẩn cấp |
| Customer | `tracking` | Chọn đơn, timeline dọc, "Cập nhật lần cuối lúc… bởi…", cờ chậm |
| Coordinator | `operations` ("Điều hành vận hành") | Dashboard vận hành, hiệu chỉnh mốc, tiếp nhận/đóng sự cố, phát cảnh báo |
| Manager | `operations` | Dashboard, hiệu chỉnh mốc, xem sự cố, nhật ký ngựa, cảnh báo |
| Specialist | `tracking` | Như dashboard, chỉ đọc, không có tab sự cố |

Tiêu chuẩn mobile (360–430px): không tràn ngang, mọi nút và ô nhập cao ≥ 44px. Form nhật ký và sự cố lưu nháp trong `localStorage`; thao tác mốc bị lỗi mạng giữ lại giờ đã chốt để gửi lại đúng giờ. Ảnh chỉ giữ trong bộ nhớ.

## VI. Điểm kế hoạch cũ đã sửa

1. Bỏ "Trip → IN_TRANSIT/COMPLETED" vì schema không có (mục III).
2. Bỏ mốc `COMPLETED` (không tồn tại); thêm `POST /legs/{id}/complete` và quy tắc `DELIVERED` cho chặng cuối.
3. `PATCH /correct` trước chỉ ghi đè trạng thái chặng; nay giữ nhất quán mốc, giờ thực tế, Order và audit.
4. Chặn Customer khỏi `GET /trips/{id}` (lộ nhật ký, sự cố nội bộ); thêm timeline riêng cho Customer.
5. Chặng cuối không dùng `complete`; DEPARTED chặng 1 kiểm tra Trip `APPROVED`.
6. T cấu hình được; thiết kế upload ảnh và dọn ảnh khi lỗi; tách `OrderStatus/PlanStatus/CrewRole` ra `packages/shared/src/enums/order.enum.ts`.
7. Cho Specialist xem `active-trips` (chỉ đọc) vì không có API nào khác liệt kê chuyến cho vai trò này.

## VII. Chưa làm và quyết định còn mở

- **Kiểm tra lại điều kiện READY trước khi xuất phát** (giấy tờ, xe, nhân sự có thể đã đổi từ lúc READY): chưa làm, vì `ReadinessService` dành cho Coordinator/Manager và cần tách logic. Nên làm trước khi dùng thật.
- **Lịch sử hiệu chỉnh cho Manager:** dữ liệu có trong `audit_logs` nhưng chưa có API đọc.
- **Giao diện Flow 3:** menu "Chuyến vận chuyển" mở các trang Flow 3 riêng (`/dashboard/trips`, `modules/trips`, do nhóm khác làm); vì vậy giao diện điều hành Flow 4 của Coordinator nằm ở khu vực riêng `operations`. "Lộ trình & phân công" và "Phương tiện" vẫn là bảng "Chưa kết nối dữ liệu".
- Sự cố chỉ báo được khi `IN_TRANSIT` (hỏng xe trước khi xuất phát chưa báo được); cảnh báo chưa gửi Customer.
- "Trễ hạn" chưa có số phút đệm.
- Mất mạng giữa chừng: ảnh không được lưu tạm, người dùng phải chọn lại.

## VIII. Kiểm thử

| Loại | Lệnh | Phạm vi |
|---|---|---|
| Đơn vị và HTTP (repository giả) | `pnpm --filter api test` | 89 test: nghiệp vụ, phân quyền, upload, Swagger |
| **MySQL thật** | `pnpm --filter api test:mysql:flow4` | 16 kiểm tra: quyền và phạm vi, quy tắc thời gian, **rollback** khi lỗi thông báo hoặc ảnh, **đồng thời** (3 request xuất phát, chỉ 1 thắng), lưu giờ UTC chính xác, thông báo, audit, hiệu chỉnh nhất quán |
| Trình duyệt | `node apps/web/test/driver.browser.cjs`, `ops.browser.cjs`, `roles.render.cjs` | Mobile 390px, nút ≥ 44px, luồng Driver, 4 vai trò vận hành |

Test MySQL tạo và xoá một database tên ngẫu nhiên `wdp_flow4_test_<hex>`, không đụng `DB_NAME`. **`.env` hiện trỏ tới MySQL cloud dùng chung**; nên chạy bằng MySQL riêng:

```powershell
docker run -d --rm --name wdp-test-mysql -p 127.0.0.1:33061:3306 -e MYSQL_ROOT_PASSWORD=test mysql:8.0
$env:TEST_DB_HOST='127.0.0.1'; $env:TEST_DB_PORT='33061'; $env:TEST_DB_USER='root'; $env:TEST_DB_PASSWORD='test'; $env:TEST_DB_SSL='false'
pnpm --filter api test:mysql:flow4
docker stop wdp-test-mysql
```

Test trình duyệt cần Playwright (chưa nằm trong repo): đặt `PLAYWRIGHT_PACKAGE` trỏ tới gói `playwright` hoặc `playwright-core` đã cài, và máy có Microsoft Edge.

**Lưu ý vận hành:** `npm run build` của API xoá thư mục `dist` trước khi build; đừng build khi `node dist/index.js` đang chạy. Khi phát triển hãy dùng `pnpm --filter api start:dev`.
