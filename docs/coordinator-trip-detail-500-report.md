# Báo cáo điều tra HTTP 500 trang chi tiết chuyến Coordinator

Ngày điều tra: 28/10/2026 (Asia/Ho_Chi_Minh)

## 1. Triệu chứng và cách tái hiện

Từ ảnh người dùng tại trang **Lộ trình vận chuyển**, trình duyệt gọi:

- `GET http://localhost:3000/api/v1/trips/29` → HTTP 500.
- `GET http://localhost:3000/api/v1/trips/29/plan-options` → HTTP 500.

UI hiển thị response an toàn “HTTP 500 · API gặp lỗi phía máy chủ”, request ID nhìn thấy trong ảnh là `d4f3f768-6e42-42ab-9b9c-b77ce8d14c25`. Log cũ của tiến trình API không có trong workspace/namespace công cụ nên không truy hồi được dòng log mang ID này.

Đã tái hiện trực tiếp phần lỗi bằng repository hiện tại trên database đang được cấu hình, chỉ đọc và không in dữ liệu cá nhân: bước truy cập trip thành công, sau đó truy vấn chặng và truy vấn danh mục xe cùng ném `ER_BAD_FIELD_ERROR`.

## 2. Môi trường thực tế đã kiểm tra

- Frontend cấu hình `VITE_API_URL=http://localhost:3000/api/v1`.
- Root `.env` cấu hình API cổng 3000 và database `wdp` trên Aiven. Tên host/database được dùng để xác định môi trường; user/password/chứng chỉ không được đưa vào báo cáo.
- Ảnh cho thấy Vite development bundle và API localhost:3000 đang phục vụ người dùng.
- Namespace tiến trình của công cụ không nhìn thấy tiến trình host; do đó chưa xác định chắc tiến trình API chạy TypeScript qua nodemon hay `dist` đã build.
- `apps/api/dist/features/trips/trips.repository.js` trước điều tra chứa cùng các tên cột sai như source, nên chạy source hay build cũ đều có cùng lỗi schema này.
- Database cấu hình thực tế chỉ được truy vấn `SELECT`/`information_schema`; không chạy migration và không thay đổi dữ liệu.
- MySQL 8.4 container tạm được dùng để kiểm tra migration và HTTP. Container/database giả đã bị xóa sau kiểm tra.
- Không có browser tab khả dụng qua công cụ Computer Use, nên không thể dùng lại session đăng nhập hoặc chụp ảnh sau sửa.

## 3. Kết quả từng endpoint

| Endpoint | Trước sửa | Bằng chứng trước | Sau migration trên MySQL tạm | Request ID kiểm thử | Database đang chạy sau sửa |
| --- | --- | --- | --- | --- | --- |
| `GET /api/v1/trips/29` | 500 | Ảnh + repository `detail/legs` trả `ER_BAD_FIELD_ERROR` | 200 | `1b32002c-2358-4955-a938-f56331934042` | NOT RUN — migration chưa áp dụng lên Aiven |
| `GET /api/v1/trips/29/plan-options` | 500 | Ảnh + repository `plan-options/vehicles` trả `ER_BAD_FIELD_ERROR` | 200 | `d7d73edd-8be3-4730-8bbd-5774c9a30a16` | NOT RUN — migration chưa áp dụng lên Aiven |
| `GET /api/v1/trips/29/assignments` | Không phải lỗi chính trong ảnh | Không có status trước | 200 | `8c5c0ffa-3cbc-4d93-b93f-53952a74fe1c` | NOT RUN |

Kiểm thử HTTP sau migration còn xác nhận:

- ID sai cú pháp → 400.
- Trip không tồn tại → 404.
- Coordinator khác đọc trip 29 → 404, không làm lộ sự tồn tại.
- Không đăng nhập → 401.

Các request ID “sau” thuộc server HTTP kiểm thử tạm, không phải API Aiven/localhost của người dùng.

## 4. Nguyên nhân gốc

### `GET /trips/29`

Luồng xác thực, role, scope `planned_by`, tìm trip và DTO trip đều đi qua được. Lỗi xảy ra tại `TripsRepository.legs()` khi JOIN `vehicles` và đọc:

```sql
v.plate_or_code, v.is_active
```

Database thực tế có `vehicles.license_plate` và `vehicles.status`, không có hai cột trên. MySQL trả `ER_BAD_FIELD_ERROR`, error middleware giữ response an toàn thành HTTP 500.

### `GET /trips/29/plan-options`

`accessible/find` thành công. `locations()` thành công và trả 20 dòng. Lỗi xảy ra riêng tại `TripsRepository.vehicles()`, cũng vì đọc/lọc/sắp xếp theo `plate_or_code` và `is_active` chưa tồn tại.

### Vì sao schema lệch

Code trips, tracking và vehicle catalog đã chuẩn hóa hợp đồng sang:

- `plate_or_code`
- `is_active`
- `vehicle_type`: `TRUCK | AIRCRAFT_HOLD | CRATE`

Nhưng repository không có migration chuyển schema xe legacy. Bảng `migrations` trên database đang chạy kết thúc ở `EscortHorseCare1800000013000`; không có migration vehicle catalog. Schema hiện tại vẫn là:

- `license_plate`
- `status`: `AVAILABLE | RESERVED | IN_TRANSIT`
- `vehicle_type`: `LIGHT | MEDIUM | HEAVY`

Dump ngày 28/10/2026 phản ánh cùng schema, nhưng kết luận ở trên dựa trên `information_schema` của database cấu hình thực tế, không dựa riêng vào dump.

## 5. Giả thuyết đã loại trừ

| Giả thuyết | Kết quả |
| --- | --- |
| Trip 29 không tồn tại | Loại trừ: trip tồn tại |
| Trip không thuộc Coordinator | Loại trừ cho tài khoản chủ sở hữu: `accessible/find` thành công; không đổi `planned_by` |
| Authentication/route guard gây 500 | Loại trừ: guard qua được; test ẩn danh vẫn trả đúng 401 |
| Bảng/cột trips hoặc orders thiếu | Loại trừ: `find` thành công |
| Locations gây lỗi plan-options | Loại trừ: truy vấn locations thành công, 20 dòng |
| `.toISOString()` trên ngày/null gây lỗi | Không phải lỗi quan sát được: truy vấn legs dừng ở `ER_BAD_FIELD_ERROR` trước mapping; test sau migration map ngày thành công |
| Frontend tạo lỗi server | Loại trừ: repository gọi trực tiếp trên DB tái hiện cùng mã lỗi MySQL |
| Chỉ là API build cũ | Không đủ để giải thích: source và `dist` trước rebuild cùng dùng cột không tồn tại |

## 6. Bản vá

| File | Thay đổi | Lý do |
| --- | --- | --- |
| `apps/api/src/database/migrations/1800000014000-VehicleCatalogSchema.ts` | Migration schema vehicle legacy → canonical | Giải quyết nguyên nhân ở ranh giới schema, đồng bộ toàn bộ trips/tracking/vehicle repositories thay vì thêm fallback riêng cho hai endpoint |
| `apps/api/test/vehicle-schema-migration.test.cjs` | Test thứ tự chuyển đổi và trường hợp schema canonical | Bảo vệ mapping, không cho diễn giải `status` vận hành thành active/inactive |

Migration thực hiện:

1. Đổi `license_plate` thành `plate_or_code`, giữ dữ liệu và unique index.
2. Thêm `is_active TINYINT(1) NOT NULL DEFAULT 1`.
3. Mở rộng enum tạm, chuyển `LIGHT/MEDIUM/HEAVY` thành `TRUCK`, sau đó thu enum về `TRUCK/AIRCRAFT_HOLD/CRATE`.
4. Giữ nguyên ID xe, capacity và mọi FK từ legs.
5. Giữ cột legacy `status`; không coi `AVAILABLE` là bằng chứng xe rảnh theo lịch và không ánh xạ nó thành `is_active`.

## 7. Cấu hình, schema và dữ liệu

- Không sửa `.env`, Vite URL, CORS, auth, `planned_by`, dữ liệu trip hoặc dữ liệu người dùng.
- Có thêm migration schema nhưng **chưa chạy trên database Aiven đang cấu hình**.
- Chỉ ghi lên database MySQL tạm với dữ liệu giả; container đã xóa sau kiểm tra.
- Migration cố ý không có `down` tự động vì việc gộp ba loại legacy vào `TRUCK` là không thể đảo ngược chính xác.

## 8. Test và kiểm tra

| Kiểm tra | Kết quả | Ghi chú |
| --- | --- | --- |
| Read-only probe database cấu hình thực tế | PASS (tái hiện lỗi) | `find` PASS; `legs` và `vehicles` cùng `ER_BAD_FIELD_ERROR`; locations PASS |
| Migration unit test | PASS | Legacy conversion + canonical no-op columns |
| Migration thật trên MySQL 8.4 tạm | PASS | Canonical columns tồn tại, `status` cũ còn nguyên |
| HTTP integration với MySQL tạm | PASS | detail/options/assignments 200; 400/401/404 và scope đúng |
| `pnpm --filter api lint` | PASS | TypeScript noEmit |
| `pnpm --filter api build` | PASS | Migration được biên dịch vào `dist` |
| `pnpm --filter api test` trong sandbox | FAIL | 3 test HTTP không bind được localhost do sandbox |
| `pnpm --filter api test` ngoài sandbox | PASS | 134 tests, 0 fail |
| `pnpm --filter web lint` | PASS | Không thay hợp đồng frontend |
| API localhost/Aiven sau migration | NOT RUN | Không được phép tự migrate database chưa xác định là test |
| Browser trang thật sau sửa | NOT RUN | Không có browser session; live schema chưa migrate/restart |

## 9. Ảnh sau sửa

Không có. Công cụ không thấy browser/tab đang mở và database phục vụ trang chưa được migrate. Không dùng mock UI để tạo ảnh giả.

## 10. Phần chưa kiểm chứng

- Chưa truy hồi được log gốc theo request ID `d4f3f768-6e42-42ab-9b9c-b77ce8d14c25`; log không nằm trong workspace và tiến trình host không hiện trong namespace.
- Chưa xác định API host chạy nodemon/source hay `dist`; sau khi áp migration vẫn cần rebuild/restart đúng tiến trình.
- Chưa mở thành công trang thật vì không tự ghi migration lên Aiven.
- Cảnh báo React Router future flags chưa xử lý vì không liên quan HTTP 500 và việc bật flag cần kiểm tra ảnh hưởng route.
- Cảnh báo Ant Design `Drawer.width`/`Alert.message` chưa xử lý trong bản vá lỗi server để tránh mở rộng phạm vi; chúng không gây request 500.

## 11. Cách kiểm tra lại an toàn

1. Xác nhận database đích là môi trường được phép thay đổi và tạo backup/snapshot.
2. Chạy `pnpm --filter api build` trên đúng revision có migration.
3. Kiểm tra migration pending, sau đó chạy `pnpm --filter api migration:run` trong maintenance window được phê duyệt.
4. Xác nhận bảng `migrations` có `VehicleCatalogSchema1800000014000` và `vehicles` có `plate_or_code`, `is_active`.
5. Rebuild/restart đúng tiến trình API đang nghe cổng 3000.
6. Đăng nhập Coordinator sở hữu trip 29, mở từ danh sách và tải lại trực tiếp URL chi tiết.
7. Trong Network xác nhận `GET /trips/29`, `/plan-options`, `/assignments` đều 200 và ghi request ID mới.
8. Kiểm tra Coordinator khác nhận 404 và phiên ẩn danh nhận 401; không đổi chủ sở hữu trip.
9. Không lưu/gửi duyệt để kiểm tra lỗi đọc.

## 12. Hoàn tác

- **Trước khi áp migration:** xóa hai file bản vá là đủ; database chưa thay đổi.
- **Sau khi áp migration:** không chạy `migration:revert` tự động. Khôi phục từ snapshot là phương án an toàn nhất.
- Nếu bắt buộc hoàn tác thủ công, phải thống kê các xe `AIRCRAFT_HOLD/CRATE`, xác định lại loại `LIGHT/MEDIUM/HEAVY` từ nguồn nghiệp vụ và đánh giá code đang dùng `plate_or_code/is_active` trước khi ALTER; không thể suy ngược chỉ từ giá trị `TRUCK` một cách đáng tin cậy.
