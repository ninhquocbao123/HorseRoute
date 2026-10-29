# Báo cáo bàn giao — Coordinator Route Planner

Ngày: 28/10/2026 (Asia/Ho_Chi_Minh)

## 1. Mục tiêu và phạm vi

Đã triển khai phần lập và lưu lộ trình độc lập cho Coordinator: lấy địa chỉ gốc từ Order, xác nhận tọa độ, quản lý điểm nghỉ, tính/chọn tuyến, lưu nháp và đọc lại. Không tự sinh hoặc thay đổi `legs`, không thay đổi Orders, `locations`, xe, `crew_profiles` hay phân công.

Phần phân công xe/nhân sự/lịch vẫn bắt buộc để có kế hoạch vận chuyển hoàn chỉnh nhưng nằm ngoài bản vá này. Nếu Trip đã có `route_plan`, UI và backend chặn `submit-plan` để không duyệt nhầm các `legs` cũ như thể đã bao gồm lộ trình mới.

## 2. Luồng giao diện đã triển khai

1. `GET /trips/{id}` trả `orderId`, địa chỉ gốc và `routePlan`.
2. Khi `routePlan = null`, UI tạo hai ô chưa có tọa độ từ `originAddress`/`destinationAddress`; không tự tìm, không gán tâm thành phố và không tự chọn kết quả.
3. Người dùng chỉ tìm khi nhấn **Tìm** hoặc Enter, chọn một kết quả, hoặc bật **Chọn trên bản đồ** rồi click/kéo marker.
4. Có thể thêm tối đa 10 điểm nghỉ (12 waypoint tính cả hai đầu), ghi chú, xóa, đưa lên/xuống. Hai đầu không thể xóa/đổi thứ tự.
5. **Tìm tuyến đường** chỉ bật khi tất cả điểm có tọa độ. Các phương án không được tự chọn để lưu.
6. Đổi tọa độ/thứ tự/số điểm hủy tuyến hiện tại; sửa ghi chú không hủy tuyến.
7. **Lưu lộ trình** ghi riêng `route_plan` và thông báo rõ không lưu phân công/chặng.
8. Reload đọc geometry đã lưu từ Trip và vẽ lại mà không gọi Mapbox.

Dirty state của route planner được nối vào cảnh báo rời trang hiện có. `key={tripId}` trên workspace ngăn mang state sang Trip khác.

## 3. File tạo/sửa

### Backend/database

- `apps/api/src/database/migrations/1800000013000-TripRoutePlan.ts`: thêm hai cột, không tạo bảng.
- `apps/api/src/features/trips/trip-route-plan.ts`: schema Zod, giới hạn, input key, token HMAC.
- `apps/api/src/features/trips/trip-map-provider.ts`: Mapbox Geocoding/Directions sau backend, timeout và chuẩn hóa response.
- `apps/api/src/features/trips/maps.routes.ts`: `GET /maps/search`, auth Coordinator và rate limit theo user.
- `apps/api/src/features/trips/trips.{dto,validation,controller,routes,repository,service}.ts`: đọc, preview, lưu, optimistic revision, audit và bảo vệ submit.
- `apps/api/src/routes/index.ts`: mount `/maps` sau lớp authenticate.
- `apps/api/src/shared/config/openapi.trips.ts`: Swagger cho dữ liệu/endpoint mới.
- `apps/api/test/trip-route-plan.test.cjs`: test validation, token và mock Mapbox.
- `apps/api/test/swagger.test.cjs`: cập nhật số operation và validator `$ref` có sibling.

### Frontend

- `apps/web/src/modules/coordinator/maps/TripRoutePlanner.tsx`: editor/tìm kiếm/preview/chọn/lưu hoàn chỉnh.
- `apps/web/src/modules/coordinator/maps/RouteMap.tsx`: được tái sử dụng cho marker số, kéo marker, fit bounds và resize.
- `apps/web/src/modules/coordinator/maps/route.types.ts`, `route-map.css`: type và CSS responsive.
- `apps/web/src/modules/coordinator/pages/CoordinatorTripPage.tsx`: gắn route planner, dirty state, cache và chặn gửi duyệt.
- `apps/web/src/modules/trips/types/trip.types.ts`: mở rộng `TripDetail`.
- Đã bỏ `map.service.ts` và test OSRM phía client cũ; trình duyệt không còn gọi routing provider trực tiếp.

## 4. Schema và migration

Trước:

```text
trips
└── chưa có dữ liệu lựa chọn tuyến của Coordinator

location_routes
└── cache bản đồ giữa location catalog (giữ nguyên, không dùng cho route_plan)
```

Sau migration:

```text
trips
├── route_plan JSON NULL
└── route_plan_revision INT UNSIGNED NOT NULL DEFAULT 0
```

Không tạo bảng mới. Trip cũ đọc `routePlan: null`, `routePlanRevision: 0`. `route_plan_revision` là thay đổi bổ sung cần thiết để hai tab không âm thầm ghi đè nhau.

Migration **chưa được chạy trên bất kỳ database nào trong nhiệm vụ này**. `.env` hiện trỏ tới DB không-local; vì vậy không dùng làm DB kiểm thử. Lệnh chỉ đọc `migration:show` cũng không kết nối được do DNS trong môi trường chạy và không thay đổi schema.

## 5. JSON route_plan mẫu (dữ liệu kiểm thử, không phải dữ liệu sản phẩm)

```json
{
  "version": 1,
  "waypoints": [
    { "id": "origin", "kind": "ORIGIN", "label": "Hà Nội", "latitude": 21.0285, "longitude": 105.8542, "note": "" },
    { "id": "stop-1", "kind": "REST_STOP", "label": "Đà Nẵng", "latitude": 16.0544, "longitude": 108.2022, "note": "Nghỉ và kiểm tra ngựa" },
    { "id": "destination", "kind": "DESTINATION", "label": "TP. Hồ Chí Minh", "latitude": 10.7769, "longitude": 106.7009, "note": "" }
  ],
  "selectedRoute": {
    "geometry": { "type": "LineString", "coordinates": [[105.8542, 21.0285], [108.2022, 16.0544], [106.7009, 10.7769]] },
    "distanceM": 1600000,
    "durationS": 108000,
    "provider": "mapbox",
    "calculatedAt": "2026-10-28T00:00:00.000Z",
    "inputKey": "sha256-hex-64-characters-in-real-response"
  }
}
```

## 6. Bảng API

| Method/URL | Khi gọi | Input/output | Hiển thị | Quyền |
|---|---|---|---|---|
| `GET /api/v1/trips/{id}` | Mở/reload Trip | Trả thêm địa chỉ, `routePlan`, revision | Khởi tạo/khôi phục panel và geometry | Manager hoặc Coordinator phụ trách theo scope cũ |
| `GET /api/v1/maps/search?q=` | Nút Tìm/Enter | q 3–200; tối đa 5 kết quả tối thiểu | Danh sách dưới đúng waypoint | Coordinator, 30 request/phút/user |
| `POST /api/v1/trips/{id}/route-preview` | Nút Tìm tuyến | Toàn bộ waypoint đúng thứ tự; trả tối đa 3 tuyến và token 15 phút | Card phương án, km và phút lái | Coordinator phụ trách, Trip còn sửa được |
| `PUT /api/v1/trips/{id}/route-plan` | Nút Lưu lộ trình | Thay thế toàn bộ `{revision, routePlan, verificationToken}`; trả TripDetail | Cập nhật cache/revision, thông báo lưu riêng | Coordinator phụ trách, DRAFT, Order APPROVED/PREPARING, chưa vận hành |

`plan-options` được giữ nguyên cho xe/chặng cũ. Route planner mới không lấy waypoint từ endpoint đó.

## 7. Provider, cấu hình và điều kiện sử dụng

Chọn Mapbox vì dự án đã có `MAPBOX_ACCESS_TOKEN` và provider Mapbox cho bản đồ vận hành. Cấu hình:

- `MAPBOX_ACCESS_TOKEN` — bắt buộc để tìm/tính tuyến thật; đã cấu hình trong `.env` cục bộ được Git bỏ qua. Không ghi giá trị token vào báo cáo hoặc mã nguồn.
- `ROUTE_PREVIEW_SECRET` — tùy chọn, tối thiểu 32 ký tự; nếu thiếu dùng `JWT_SECRET` để ký token preview.
- `MAPBOX_GEOCODING_URL`, `MAPBOX_DIRECTIONS_URL` — override server-side tùy chọn; client không thể truyền URL.

Geocoding dùng `autocomplete=false`, chỉ gọi khi submit, và `permanent=true` vì tọa độ/nhãn được lưu. Theo [Mapbox Geocoding API](https://docs.mapbox.com/api/search/geocoding/), kết quả temporary không được cache, còn permanent được lưu nhưng yêu cầu tài khoản đủ điều kiện thanh toán/hợp đồng. Phải xác nhận quyền Permanent Geocoding của tài khoản trước production. Directions dùng `alternatives=true`, `geometries=geojson`, `overview=full` theo [Mapbox Directions API](https://docs.mapbox.com/api/navigation/directions/).

UI giữ attribution Mapbox cho search/route và OpenStreetMap cho tile. Ngày 28/10/2026 đã kiểm chứng request thật: Permanent Geocoding trả kết quả hợp lệ, Directions trả geometry/khoảng cách/thời gian; kiểm tra tiếp qua API HorseRoute cũng đạt cho `GET /maps/search` và `POST /trips/{id}/route-preview`.

## 8. Chống response cũ, tuyến cũ và mất cập nhật

- Mỗi search có sequence theo waypoint; sửa query làm response đang bay mất hiệu lực.
- Mỗi preview có sequence toàn panel; đổi tọa độ/thứ tự/số điểm tăng sequence và xóa candidate/selection.
- `inputKey = SHA-256([id, latitude, longitude] theo thứ tự)`; note/label không làm mất tuyến.
- Mỗi candidate có token HMAC chứa `tripId`, `inputKey`, digest toàn tuyến và hạn 15 phút. Backend so khớp token trước khi chấp nhận tuyến mới.
- Token không lưu trong DB. Sửa note được phép giữ chính xác `selectedRoute` đã lưu; mọi tuyến khác cần token mới.
- `route_plan_revision` được so trong transaction; stale revision trả 409.
- Audit chỉ ghi waypoint và metadata tuyến, không ghi geometry lớn.

## 9. Điều kiện lưu/sửa và bảo vệ gửi duyệt

Backend khóa Order → Trip → legs và kiểm tra lại:

- Coordinator đúng `planned_by`.
- Trip `DRAFT`, Order `APPROVED`/`PREPARING`.
- Mọi leg còn `NOT_STARTED`, không actual time và không lịch sử vận hành.
- Waypoint: 2–12, ID duy nhất, đúng một ORIGIN đầu, DESTINATION cuối, giữa là REST_STOP; nhãn 255, note 500, tọa độ hữu hạn/phạm vi.
- Geometry LineString 2–5.000 coordinate; payload toàn ứng dụng vẫn giữ 1 MB.

`submit-plan` trả 409 khi có `routePlan`, vì route chưa được đồng bộ sang `legs`. Trip cũ `routePlan = null` giữ hành vi gửi duyệt trước đây.

## 10. Phần giữ nguyên

- Không update `orders.origin_address`/`destination_address` hay booking/contact.
- Không insert/update `locations` hoặc `location_routes`.
- Không tạo waypoint table/danh mục trạm nghỉ.
- Không sửa `legs`, xe, trạng thái/type xe, `crew_profiles`, phân công hoặc lịch.
- Không deploy, push, tạo PR hoặc chạy migration.

## 11. Kết quả kiểm thử và bằng chứng

| Kiểm tra | Kết quả | Bằng chứng/ghi chú |
|---|---|---|
| API typecheck | PASS | `pnpm --filter api lint` |
| API production build | PASS | `pnpm --filter api build` |
| Web typecheck/build | PASS | `pnpm --filter web build`; 3.579 module, chỉ cảnh báo chunk lớn vốn có |
| Toàn bộ API test | PASS | 141/141 ở lần xác minh cuối sau khi cho phép localhost |
| Route plan/provider unit | PASS | 6/6: order, duplicate ID, range, geometry limit, HMAC tamper/binding, note-only key, permanent geocode, routing mock |
| Swagger | PASS | 9/9 sau khi thêm 3 operation mới |
| Mapbox thật | PASS | `pnpm --filter api verify:mapbox`: Permanent Geocoding PASS, Directions PASS. `pnpm --filter api verify:mapbox:api`: search trả 5 kết quả, preview trả 2 phương án; database chỉ đọc và không ghi route_plan |
| DB integration/migration riêng | NOT RUN | Không có DB test local/riêng; DB cấu hình hiện tại không-local và không bị chạm |
| Browser E2E/responsive/screenshots | NOT RUN | Không có API+DB test riêng/token Mapbox để chạy luồng thật |
| Save + reload DB thật | NOT RUN | Chưa áp dụng migration; không tuyên bố đã lưu/reload thành công trên DB |

Lần full test đầu trong sandbox có 3 file HTTP fail do `listen EPERM`; chạy lại ngoài sandbox cho phép localhost thì toàn bộ 139 test qua. Đây là giới hạn sandbox, không phải lỗi sản phẩm.

## 12. Ảnh desktop/mobile

Không tạo ảnh. Không có môi trường E2E an toàn (DB riêng + token Mapbox) để chụp giao diện chứa dữ liệu thật. Hai ảnh `/tmp` tham khảo không còn được dùng làm bằng chứng kiểm thử.

## 13. Hạn chế và nhiệm vụ tiếp theo

1. Tích hợp `route_plan.waypoints` với bước tạo/chỉnh `legs`, phân công xe/nhân sự và lịch; chỉ sau đó mới thiết kế bỏ chặn submit.
2. Trước production, tạo token riêng cho HorseRoute, theo dõi ngân sách/rate limit và thiết lập cảnh báo chi phí Mapbox. Token hiện tại đã được xác nhận có quyền Permanent Geocoding.
3. Chạy migration + integration test trên DB clone/ephemeral MySQL, gồm quyền khác Coordinator, vận hành, concurrent revision và kiểm tra bảng không liên quan.
4. Chạy browser E2E ở 1440/1024/768/390 và chụp ảnh.
5. `route_plan` không mô hình hóa thời gian nghỉ; duration chỉ là thời gian lái.

## 14. Hướng dẫn kiểm tra thủ công

1. Tạo database MySQL riêng từ backup/schema kiểm thử; không dùng DB trong `.env` hiện tại.
2. Trỏ `.env` tạm tới DB đó, cấu hình Mapbox Permanent Geocoding hợp lệ và chạy migration.
3. Đăng nhập Coordinator phụ trách một Trip DRAFT của Order APPROVED/PREPARING.
4. Mở Trip: xác nhận hai địa chỉ gốc hiện đúng và tọa độ là “Chưa xác định vị trí”; Network không có search tự động.
5. Tìm/chọn hai đầu; thêm 2 điểm nghỉ, sửa note, đưa lên/xuống, kéo marker.
6. Tính tuyến: xác nhận chưa có radio tự chọn; chọn một phương án rồi lưu.
7. Reload: kiểm tra điểm/thứ tự/note/geometry và revision khôi phục.
8. Mở hai tab: lưu tab A rồi lưu tab B; tab B phải nhận 409.
9. Đổi tọa độ sau khi chọn: lựa chọn phải mất, không lưu geometry cũ.
10. Sửa note trên tuyến đã lưu: lưu được mà không cần tính lại.
11. Thử **Gửi duyệt**: phải bị chặn do chưa tích hợp legs.
12. Đối chiếu trước/sau các bảng Orders, locations, location_routes, legs, vehicles, trip_assignments và crew_profiles: không đổi vì thao tác route plan.

## 15. Áp dụng migration và hoàn tác

### Trước triển khai

1. Bảo trì ngắn/đảm bảo backup nhất quán; backup tối thiểu bảng `trips`, tốt nhất toàn DB bằng công cụ quản trị chuẩn của môi trường.
2. Xác minh backup restore được trên DB tạm.
3. Chạy `pnpm --filter api typeorm migration:show` với cấu hình production để xem chính xác migration pending. Vì trạng thái DB không đọc được trong nhiệm vụ này, **mọi file được đánh dấu `[ ]` sẽ chạy cùng**, không chỉ `1800000013000-TripRoutePlan.ts`.
4. Review đặc biệt các migration cùng timestamp đang có trong repo (`1800000007000`, `1800000008000`, `1800000009000`, `1800000010000`) nếu chúng còn pending.

### Thứ tự

1. Backup/restore test.
2. Deploy API tương thích cột nullable (hoặc chạy migration ngay trước API trong maintenance window).
3. Chạy `pnpm migration:run` một lần trên đúng DB.
4. Xác minh `SHOW COLUMNS FROM trips LIKE 'route_plan%'`, Trip cũ trả null, API health/build.
5. Deploy web.
6. Smoke test save/reload trên Trip test được phép.

### Hoàn tác

Migration down xóa `route_plan_revision` rồi `route_plan`. Chỉ `migration:revert` khi migration này là migration cuối và đã backup. **Rollback làm mất toàn bộ lộ trình đã lưu sau triển khai**; nếu cần giữ dữ liệu, export `id, route_plan, route_plan_revision` trước khi revert. Web/API cũ không biết route plan và không được xem là đã đồng bộ với legs.

## 16. Xác nhận database

- Database cấu hình hiện tại: **không thay đổi**.
- Database test riêng: **không có/không thay đổi**.
- Migration: chỉ tạo file, **chưa áp dụng**.
- Không reset/drop/import dump; không ghi dữ liệu mẫu vào sản phẩm.
