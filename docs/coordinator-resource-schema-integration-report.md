# Báo cáo tích hợp schema tài nguyên Coordinator

Ngày kiểm chứng: 28/10/2026 (Asia/Ho_Chi_Minh)

## 1. Kết luận

HTTP 500 của `GET /api/v1/trips/29` và `GET /api/v1/trips/29/plan-options` xuất phát từ chênh lệch schema: mã đang đọc `vehicles.plate_or_code`/`vehicles.is_active`, trong khi database đang dùng có `license_plate`/`status`. Cùng lúc, mã ứng dụng còn dùng enum `TRUCK | AIRCRAFT_HOLD | CRATE`, trái với dữ liệu thật `LIGHT | MEDIUM | HEAVY`.

Bản vá đồng bộ trips, vehicles, tracking, frontend, shared type, OpenAPI và fixture theo schema thật; tích hợp `crew_profiles`; kiểm tra lại xe/nhân sự khi lưu, gửi duyệt và duyệt; đồng thời giữ nguyên auth và phạm vi chuyến của Coordinator.

Không có migration hoặc ghi dữ liệu nào được chạy trên database đang sử dụng. Database đó chỉ được khảo sát bằng truy vấn đọc. Test SQL chạy trên MySQL 8.4 biệt lập; database test tên ngẫu nhiên và container test đều đã bị xóa sau khi chạy.

## 2. Schema thực tế và schema đích

### `vehicles`

| Thành phần | Schema đã xác nhận / schema đích |
|---|---|
| PK | `id bigint unsigned` |
| Loại xe | `vehicle_type enum('LIGHT','MEDIUM','HEAVY')` |
| Sức chứa | `capacity_stalls int` |
| Biển số | `license_plate varchar(30)`, unique |
| Trạng thái | `status enum('AVAILABLE','RESERVED','IN_TRANSIT')` |
| Quan hệ | `legs.vehicle_id -> vehicles.id` |

Không thêm `is_active`, không đổi tên cột database và không chuyển dữ liệu thành `TRUCK`. API vẫn dùng tên JSON `plateOrCode` để giữ tương thích consumer, nhưng nguồn duy nhất là `license_plate`.

Quy tắc sức chứa theo mô hình hiện có được giữ: LIGHT = 2, MEDIUM = 4–6, HEAVY = 9. API đang hoạt động từ chối loại xe cũ.

### `crew_profiles`

| Thành phần | Schema đã xác nhận |
|---|---|
| Khóa/liên kết | `user_id bigint unsigned`, PK và FK tới `users.id` |
| Quan hệ | Một-một với `users` |
| Năng lực | `crew_type enum('DRIVER','ESCORT')`, NOT NULL |
| Trạng thái | `work_status enum('AVAILABLE','IN_TRIP')`, NOT NULL, mặc định AVAILABLE |

Tài khoản `DRIVER_ESCORT` thiếu profile vẫn xuất hiện trong assignment-options với blocker `MISSING_CREW_PROFILE`; không được suy ra là AVAILABLE và không tạo profile giả. Phân công cũ vẫn được trả ở `/assignments`, kể cả khi profile/tài khoản không còn hợp lệ.

## 3. Xử lý migration gộp loại xe

Migration `1800000014000-VehicleCatalogSchema.ts` có logic gộp dữ liệu thành `TRUCK` đã được loại khỏi bản vá trước khi phát hành. File migration và test tương ứng không còn trong cây mã, nên lần triển khai sau không thể vô tình gộp `LIGHT/MEDIUM/HEAVY`.

Schema database đang dùng vẫn là schema đích ở trên; do đó không cần migration đổi bảng vehicles cho lần áp dụng này. Trước triển khai vẫn phải kiểm tra bảng `migrations` và `information_schema`: nếu một môi trường khác đã từng chạy migration gộp, không được suy ngược loại xe từ sức chứa; cần khôi phục từ nguồn dữ liệu gốc đáng tin cậy bằng một migration tiến riêng.

## 4. Bảng quyết định trạng thái và khả dụng

### Xe

| Trạng thái | Hiển thị | Điều kiện chọn ở UI | Kiểm tra khi ghi | Blocker |
|---|---:|---|---|---|
| AVAILABLE | Có | Được chọn tạm; `selectable: null`, `scheduleEvaluation: NOT_EVALUATED` | Không trùng chặng APPROVED theo khoảng nửa mở `[departure, arrival)`; đủ sức chứa | Lỗi trường `legs.N.vehicleId` khi lưu, HTTP 409 khi submit/approve |
| RESERVED | Có | Chặn, trừ khi xe đã thuộc chính Trip đang sửa | Kiểm tra lại self-exception và lịch | `VEHICLE_RESERVED` |
| IN_TRANSIT | Có | Chặn, trừ dữ liệu đã thuộc chính Trip để không làm mất lựa chọn cũ | Chặn vận hành ở chuyến khác; kiểm tra lịch | `VEHICLE_IN_TRANSIT` / `VEHICLE_BUSY` |

Hai lịch liền kề không chồng nhau (`existing.arrival == new.departure` được phép). Lưu DRAFT không cập nhật status và không giữ chỗ. Khi duyệt, dòng vehicle được khóa theo thứ tự ID, sau đó lịch được kiểm tra lại; hai duyệt đồng thời cùng xe chỉ một request thành công.

### Nhân sự

| Điều kiện | Hiển thị | Chọn | Kết quả |
|---|---:|---:|---|
| User DRIVER_ESCORT ACTIVE + profile đúng loại + AVAILABLE | Có | Tạm thời; lịch nháp chưa đánh giá trả `selectable: null` | Kiểm tra lịch Trip khi ghi |
| Thiếu profile | Có | Không | `MISSING_CREW_PROFILE` |
| Profile sai `crew_type` so với vai trò chọn | Có | Không ở cột/vai trò đó | `CREW_TYPE_MISMATCH` |
| `work_status=IN_TRIP` | Có | Không, trừ phân công đã thuộc chính Trip | `CREW_UNAVAILABLE` |
| User LOCKED/PENDING/sai account role | Không đưa vào lựa chọn mới | Không | Backend vẫn giữ và báo blocker nếu đã được lưu trước đó |
| Trùng Trip APPROVED trong khung giờ | Không tiết lộ Trip khác | Không cho ghi | Lỗi trường “Nhân sự đã được phân công…” |

Một `userId` không được giữ hai vai trò trong cùng Trip; vẫn hỗ trợ nhiều DRIVER hoặc nhiều ESCORT. Lịch nhân sự dùng toàn bộ khoảng thời gian Trip.

## 5. Hợp đồng API

Trước đây option xe chỉ có `isActive: true`; option nhân sự chỉ có `id/fullName`. Sau bản vá:

```json
{
  "id": "20",
  "plateOrCode": "DEMO-20",
  "vehicleType": "LIGHT",
  "capacityStalls": 2,
  "status": "AVAILABLE",
  "selectable": null,
  "scheduleEvaluation": "NOT_EVALUATED",
  "blockingReasons": []
}
```

`selectable: null` có nghĩa chỉ mới qua kiểm tra catalog/status, chưa kết luận lịch nháp chưa lưu. UI hiển thị rõ cảnh báo và server kiểm tra lịch chính xác từng chặng lúc ghi.

```json
{
  "id": "13",
  "fullName": "Nhân sự mẫu",
  "crewType": null,
  "workStatus": null,
  "selectable": false,
  "scheduleEvaluation": "NOT_EVALUATED",
  "blockingReasons": [
    { "code": "MISSING_CREW_PROFILE", "message": "Tài khoản chưa có hồ sơ nhân sự." }
  ]
}
```

Trip detail đổi `vehicleActive` thành `vehicleStatus`. Vehicle CRUD nhận/trả `status`; bộ lọc là `all | AVAILABLE | RESERVED | IN_TRANSIT`.

## 6. Kiểm tra tại thời điểm ghi và cạnh tranh

- Lưu kế hoạch: khóa Order → Trip → legs/catalog theo ID; kiểm tra trạng thái/self-exception xe, trùng lịch từng chặng và đánh giá lại lịch nhân sự đã phân công.
- Lưu phân công: khóa Order → Trip → user theo ID → assignments; kiểm tra account, profile, `crew_type`, `work_status` và trùng lịch trước khi thay thế roster.
- Gửi duyệt: kiểm tra lại catalog, sức chứa, lịch xe và lịch mọi nhân sự đã phân công.
- Duyệt: khóa độc quyền vehicle theo thứ tự ID; kiểm tra lại sức chứa, lịch xe, vận hành đang chạy và lịch nhân sự. Query loại trừ chính Trip.
- Khoảng thời gian dùng điều kiện `start < otherEnd AND end > otherStart`, nên lịch liền kề hợp lệ.
- Không thay đổi trạng thái vehicle/crew khi click modal hoặc lưu DRAFT. Schema hiện không có quan hệ sở hữu reservation đủ rõ để tự động chuyển status an toàn.

## 7. Giao diện

- Modal xe hiển thị LIGHT/MEDIUM/HEAVY, capacity, status thật và lý do bị khóa ngay trên card (không phụ thuộc hover).
- Modal nhân sự hiển thị năng lực profile, lý do thiếu/sai profile, trạng thái không khả dụng và phân công cũ không còn hợp lệ.
- `selectable: null` hiển thị “Chưa kiểm tra lịch nháp; máy chủ sẽ kiểm tra khi lưu”. Không lưu kết luận lịch cũ khi ngày giờ thay đổi.
- Nút Hủy/Xác nhận và state nháp được giữ nguyên. Resource bị chặn không bị tự xóa khỏi lựa chọn đã lưu.
- Fleet UI và filter dùng đúng status/enum thật.

Chưa chụp ảnh UI qua browser trong lượt này; typecheck và production build đã PASS. Cần smoke test trực quan desktop/mobile sau khi đưa API + web lên môi trường staging.

## 8. Các file chính thay đổi

- Backend: `features/vehicles/*`, `features/trips/{trips.dto,trips.repository,trips.service,trips.crew}.ts`, `features/tracking/{tracking.repository,trackmap.build,trackmap.geo}.ts`.
- Contract: `shared/config/openapi.{vehicles,trips,tracking}.ts`, `packages/shared/src/types/tracking.type.ts`.
- Frontend: `features/fleet/*`, `modules/trips/types/trip.types.ts`, `TripLegTimeline.tsx`, `modules/coordinator/pages/CoordinatorTripPage.tsx`.
- Test: `test/fixtures/schema.sql`, `test/coordinator-resources.mysql.cjs`, unit tests trips/trackmap/swagger, package script test MySQL.

Các thay đổi giao diện Coordinator có sẵn của người dùng được giữ nguyên; bản vá chỉ bổ sung tích hợp tài nguyên vào đó.

## 9. Kết quả kiểm thử

| Kiểm tra | Kết quả | Bằng chứng |
|---|---|---|
| API TypeScript | PASS | `pnpm --filter api lint` |
| Web TypeScript | PASS | `pnpm --filter web lint` |
| API build | PASS | `pnpm --filter api build` |
| Web production build | PASS | `pnpm --filter web build` (3579 modules; chỉ cảnh báo chunk lớn) |
| API unit/HTTP | PASS | 132/132 tests |
| OpenAPI | PASS | 9/9 tests |
| MySQL/API thật biệt lập | PASS | 8/8 nhóm trong `test:mysql:coordinator-resources` |
| Trang Trip detail + plan-options | PASS trên DB test | Cả hai endpoint trả 200 qua HTTP thật; tracking query cũng đọc được license plate |
| Cạnh tranh duyệt | PASS | Hai request đồng thời cùng xe: một 200, một 409 |
| Browser screenshot/mobile visual | NOT RUN | Cần staging smoke test |
| Database đang sử dụng | READ ONLY | Không migration, không UPDATE/INSERT/DELETE |

Database test cuối: `wdp_flow3_test_17375af1be887adb`, đã được script drop. Container `horseroute-resource-test-mysql` đã được xóa. Không sao chép PII vào fixture.

## 10. Hướng dẫn áp dụng

1. Backup database và kiểm tra restore được.
2. Kiểm tra trước áp dụng:
   - `vehicles` có đúng `license_plate`, `vehicle_type LIGHT/MEDIUM/HEAVY`, `capacity_stalls`, `status`;
   - FK `legs.vehicle_id` còn nguyên;
   - `crew_profiles.user_id` là PK/FK, enum đúng;
   - bảng `migrations` không có migration gộp loại xe đã từng chạy.
3. Không chạy toàn bộ migration pending. Với schema đã khảo sát, lần này không cần migration DB; triển khai backend và frontend tương thích schema hiện có cùng một release.
4. Restart đúng API process, sau đó kiểm tra health và log.
5. Smoke test bằng Coordinator thật trên staging: Trip 29 (hoặc fixture không chứa PII), plan-options, assignment-options, lưu plan/crew, submit/review.
6. Kiểm tra sau triển khai: enum/type/count xe không đổi; biển số/ID/FK không đổi; không có lỗi unknown column; phân công cũ vẫn hiển thị.
7. Hoàn tác mã: redeploy artifact backend/frontend trước bản vá. Vì không đổi schema/data, rollback không cần migration. Lưu ý rollback về mã cũ sẽ tái tạo lỗi unknown-column, nên chỉ dùng để phục hồi khẩn cấp đồng thời chặn route Coordinator liên quan.

## 11. Rủi ro và việc còn lại

- Các script MySQL integration cũ khác (`vehicles.mysql.cjs`, `flow3-read.mysql.cjs`, `flow4-tracking.mysql.cjs`) vẫn chứa fixture mô hình cũ và cần được chuyển dần; bài test mới là nguồn kiểm chứng schema đích cho phạm vi này. Mã production và fixture schema trung tâm không còn tham chiếu cột/enum cũ.
- Chưa có endpoint preview lịch cho draft chưa lưu. Contract cố ý trả `selectable: null`/`NOT_EVALUATED`; kiểm tra quyết định nằm ở server lúc ghi. Nếu sản phẩm muốn preview theo từng chặng trước khi lưu, cần bổ sung endpoint nhận toàn bộ khoảng thời gian draft, không tái sử dụng cache của plan-options.
- Chưa tự động chuyển `vehicles.status` hoặc `crew_profiles.work_status` theo vòng đời Trip vì schema chưa chỉ ra reservation thuộc Trip nào. Tự động hóa việc này cần quyết định nghiệp vụ và mô hình sở hữu rõ ràng để tránh trả AVAILABLE sai.
