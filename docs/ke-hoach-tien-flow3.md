# Kế hoạch của Tiến — Flow 3: xem chuyến và lưu lộ trình nháp

- Ngày dự kiến thực hiện: **17/10/2026**.
- Người thực hiện: **Tiến**. Người hỗ trợ dữ liệu/tích hợp: **Bảo**. Người nhận dữ liệu hành trình: **Long**.
- Căn cứ: source HorseRoute được kiểm tra ngày 16/10/2026.
- Trạng thái tài liệu: **kế hoạch đề xuất; các checkbox đều chưa được nghiệm thu**.
- Mục tiêu: Coordinator mở chuyến đã tồn tại, nhập các chặng và lưu; tải lại trang vẫn thấy đúng dữ liệu. Manager xem được kế hoạch ở chế độ chỉ đọc.

> Đây là kế hoạch làm một phần Flow 3, không phải hoàn thành toàn bộ Flow 3 trong một ngày. Ba API GET của Phần 2 và PUT lưu kế hoạch của Phần 3 đã triển khai, kiểm thử; giao diện thuộc các phần tiếp theo. Các quyết định nghiệp vụ trong Phần 1 vẫn cần nhóm xác nhận.

## Cách dùng tài liệu

1. Làm lần lượt từ Phần 0 đến Phần 7.
2. Sau mỗi phần, đánh dấu checkbox khi đã có bằng chứng; chưa kiểm tra thì để trống.
3. Ghi kết quả vào bảng cuối tài liệu: **Đạt / Chưa đạt / Bị chặn**, kèm PR, lệnh test hoặc ảnh demo.
4. Nếu thay đổi API hoặc phạm vi, ghi quyết định và báo Bảo/Long trước khi hai bên dùng dữ liệu khác nhau.
5. Khi thiếu thời gian, bàn giao phần đã chạy được và phần còn thiếu; không đánh dấu hoàn thành chỉ vì có giao diện hoặc Swagger.

## Giải thích nhanh các từ sẽ gặp

| Từ | Hiểu đơn giản |
| --- | --- |
| Order | Đơn yêu cầu vận chuyển do khách tạo |
| Trip | Chuyến vận chuyển được tạo khi Manager duyệt đơn |
| Leg | Một chặng của chuyến, từ địa điểm này tới địa điểm tiếp theo |
| DRAFT | Kế hoạch còn ở dạng nháp, được phép sửa theo quyền |
| DTO / API contract | Thống nhất tên trường, kiểu dữ liệu và nội dung gửi/nhận |
| Transaction | Nhóm thao tác lưu; lỗi giữa chừng thì hủy cả nhóm, tránh lưu một nửa |
| Fixture | Dữ liệu thử được chuẩn bị riêng, không phải dữ liệu thực của khách |
| PR | Bộ thay đổi code gửi để thành viên khác xem và ghép vào nhánh chung |

## Phạm vi cần hoàn thành

### Bắt buộc

- Coordinator xem danh sách và chi tiết chuyến mình phụ trách.
- Manager xem danh sách và chi tiết các chuyến; chưa chỉnh sửa trong phần việc này.
- Đọc danh mục địa điểm và phương tiện để điền form.
- Coordinator thêm chặng cuối và sửa thông tin chặng của chuyến nháp.
- Lưu kế hoạch vào MySQL, đọc lại đúng, bảo toàn ID chặng đã tồn tại.
- Kiểm tra dữ liệu, quyền truy cập, trạng thái trước khi ghi.
- Swagger mô tả chính xác các API mới; test và demo bằng API thật.

### Để phần tiếp theo

- Xóa hoặc đổi thứ tự chặng đã lưu; ngày đầu chỉ sửa chặng tại vị trí cũ và thêm ở cuối.
- CRUD toàn bộ danh mục xe/địa điểm, phân công Driver bằng giao diện.
- Trình duyệt và phê duyệt kế hoạch, tự chuyển Order sang READY.
- Kiểm tra đầy đủ sức chứa/trùng lịch phục vụ phê duyệt, khởi hành, thông quan.
- Tracking của Driver/Customer: Long phụ trách.

**Lưu nháp thành công không có nghĩa chuyến đủ điều kiện khởi hành.** Không thêm nút khởi hành hoặc tự đổi trạng thái đơn trong nhiệm vụ này.

## Phần 0 — Hiểu code và nhận dữ liệu đầu vào (khoảng 45 phút)

### Câu hỏi: Tiến bắt đầu từ đâu?

Đọc các file sau theo thứ tự:

| File | Cần hiểu điều gì? |
| --- | --- |
| [orders.service.ts](../apps/api/src/features/orders/orders.service.ts) | Hàm review duyệt đơn và tạo Trip nháp với Coordinator đã chọn |
| [orders.repository.ts](../apps/api/src/features/orders/orders.repository.ts) | insertTrip ghi order_id và planned_by |
| [Schema kiểm thử](../apps/api/test/fixtures/wdp-schema.sql) | Cột/ràng buộc của trips, legs, locations, vehicles |
| [auth.middleware.ts](../apps/api/src/shared/middlewares/auth.middleware.ts) | req.account là tài khoản server đã xác thực |
| [orders.routes.ts](../apps/api/src/features/orders/orders.routes.ts) | Cách áp dụng quyền theo vai trò |
| [services.ts](../apps/api/src/shared/config/services.ts) | Nơi lắp ghép service và database |
| [DashboardLayout.tsx](../apps/web/src/features/auth/pages/components/DashboardLayout.tsx) | Nơi nối màn hình vào view của dashboard |
| [axios.ts](../apps/web/src/lib/axios.ts) | Dùng api hiện có để tự gửi JWT; đường dẫn FE không cần thêm /api/v1 nếu baseURL đã có |

Điểm quan trọng đã xác nhận từ source:

- Flow 1 đã tạo Trip. **Không tạo thêm POST /trips để tạo chuyến thứ hai cho cùng đơn.**
- Schema có UNIQUE(trips.order_id): mỗi đơn tối đa một Trip.
- planned_by là Coordinator được Manager chọn khi duyệt đơn trong code hiện tại.
- plan_status gồm DRAFT, PENDING_APPROVAL, APPROVED.
- Leg có ID riêng và có thể được milestones/nhật ký tham chiếu. Không xóa toàn bộ rồi tạo lại khi bấm Lưu.
- Schema trong file chưa chứng minh database dùng chung đã giống hệt; nhờ Bảo đối chiếu trước khi thử tích hợp.

### Dữ liệu cần Bảo bàn giao

- [ ] Coordinator A, Coordinator B và Manager đăng nhập được.
- [ ] Một Customer dùng để thử trường hợp bị từ chối quyền.
- [ ] Trip nháp T1 thuộc Coordinator A; Trip T2 thuộc Coordinator B.
- [ ] Ít nhất 3 địa điểm và 1 phương tiện active để chọn trên form.
- [ ] Một phương tiện inactive để thử lỗi.
- [ ] Một Trip không còn DRAFT để thử chặn sửa; chỉ chuẩn bị trong DB kiểm thử riêng.
- [ ] ID đơn/chuyến và hướng dẫn tái tạo, không ghi mật khẩu/token vào tài liệu hoặc PR.

### Cổng kiểm tra 0

- [ ] Tiến chỉ ra được chỗ Flow 1 tạo Trip và giải thích vì sao không tạo lại Trip.
- [ ] Chạy được API/Web theo cấu hình của nhóm.
- [ ] Dùng /users/me xác nhận đúng tài khoản Coordinator và Manager.
- [ ] Ghi lại ID dữ liệu thử trong bảng nghiệm thu cuối file.

**Chưa đạt nếu:** chỉ có tài khoản trong bảng users nhưng đăng nhập không được, hoặc không biết Trip đang thuộc ai.

## Phần 1 — Chốt hợp đồng với Bảo và Long (khoảng 30 phút)

**Cập nhật 16/10/2026:** contract đề xuất v0.1 đã được đưa vào Swagger, tag **Flow 3 - Trips**, tại `/docs` (OpenAPI JSON: `/docs-json`). Nguồn: [openapi.trips.ts](../apps/api/src/shared/config/openapi.trips.ts). Cập nhật 17/10/2026: ba handler GET và PUT lưu kế hoạch đã triển khai. Chưa có xác nhận của Bảo/Long; các checkbox xác nhận bên dưới vẫn để trống.

Bản Swagger đã cụ thể hóa để nhóm review:

- Đề xuất tối đa **50 chặng/request**; đây là giới hạn kỹ thuật chờ duyệt.
- Thêm `vehicleActive: boolean | null` trong TripLeg để hiển thị xe cũ inactive.
- plan-options trả toàn bộ danh mục nhỏ, không cắt/phân trang ngầm ở v0.1.
- Danh sách chuyến theo ID giảm dần; danh mục theo tên/mã rồi ID.
- Mã lỗi cho thiếu/đảo chặng hoặc ID chặng sai là 400; trạng thái/lịch sử không cho sửa là 409.
- Có ví dụ lưu lần đầu, sửa giữ ID, chuyến chưa có chặng và xe inactive.

Cách review: đọc mô tả tag → mở bốn endpoint → kiểm tra Schema và Examples → ghi đồng ý/điểm cần đổi vào phiếu xác nhận. Không dùng Execute để kết luận nghiệp vụ đã chạy: API này mới ở bước thiết kế.


### Câu hỏi: Mỗi người sẽ gửi và nhận dữ liệu gì?

Đề xuất chốt các quy tắc sau. Đây là quyết định triển khai, không phải khẳng định API hiện có sẵn:

| Chủ đề | Quyết định đề xuất |
| --- | --- |
| ID | Chuỗi số, ví dụ "200"; không ép BIGINT thành Number |
| Tên trường JSON mới | camelCase; tên cột MySQL giữ nguyên snake_case |
| Thời gian API | ISO 8601 UTC có Z, ví dụ 2026-10-20T01:00:00Z |
| Hiển thị ngày đầu | Form ghi rõ múi giờ đang nhập; đề xuất Asia/Ho_Chi_Minh cho bản đầu, không giả định là giờ địa phương của mọi điểm quốc tế |
| Đọc chuyến | Manager xem toàn bộ; Coordinator chỉ xem planned_by = req.account.id |
| Sửa chuyến | Chỉ Coordinator phụ trách; Trip phải DRAFT và Order còn APPROVED hoặc PREPARING |
| Chuyến không thuộc Coordinator | Trả 404 để không tiết lộ dữ liệu của người khác |
| Sửa các chặng | Giữ ID và thứ tự của chặng cũ; chỉ bổ sung chặng mới ở cuối trong phần việc này |
| Chặng đã chạy/có lịch sử | Chặn lưu kế hoạch; không sửa hoặc xóa lịch sử để vượt điều kiện |
| Gửi trường không cho phép | Từ chối, không nhận plannedBy, orderId, planStatus, status hoặc actual* từ body lưu kế hoạch |
| Hai tab cùng lưu | Khóa transaction tránh ghi một nửa; bản lưu sau có thể ghi đè bản trước. Chống sửa trên phiên bản cũ là việc tiếp theo, không tuyên bố đã xử lý |

### Danh sách endpoint mới đề xuất

| Method và đường dẫn | Quyền | Thành công |
| --- | --- | --- |
| GET /api/v1/trips?page=1&limit=20 | Coordinator/Manager, lọc theo quyền | 200, danh sách phân trang |
| GET /api/v1/trips/{id} | Coordinator phụ trách/Manager | 200, chi tiết và chặng |
| GET /api/v1/trips/{id}/plan-options | Cùng quyền đọc chi tiết | 200, danh mục địa điểm/phương tiện để chọn |
| PUT /api/v1/trips/{id}/plan | Coordinator phụ trách | 200, chi tiết sau khi lưu |

plan-options phải kiểm tra quyền với Trip trước khi trả dữ liệu. Phương tiện inactive không được chọn mới; nếu chặng cũ đang dùng xe inactive, vẫn hiển thị tên từ chi tiết và yêu cầu đổi trước khi lưu. Danh mục ngày đầu dùng tập nhỏ do Bảo chuẩn bị; nếu phân trang danh mục phải có cách lấy đủ các trang, không cắt danh sách âm thầm.

**Request lưu lần đầu — ví dụ minh họa, thay ID bằng dữ liệu của nhóm:**

```json
{
  "legs": [
    {
      "fromLocationId": "10",
      "toLocationId": "11",
      "vehicleId": "5",
      "plannedDepartureAt": "2026-10-20T01:00:00Z",
      "plannedArrivalAt": "2026-10-20T03:00:00Z"
    },
    {
      "fromLocationId": "11",
      "toLocationId": "12",
      "vehicleId": "5",
      "plannedDepartureAt": "2026-10-20T04:00:00Z",
      "plannedArrivalAt": "2026-10-20T06:00:00Z"
    }
  ]
}
```

Sau khi lưu, response phải chứa ID chặng. Các lần sửa phải gửi lại `id` của từng chặng đã lưu; chặng mới chưa có `id`. Backend suy ra seqNo từ vị trí trong mảng, bắt đầu từ 1. Bản ngày đầu yêu cầu ít nhất 1 chặng khi lưu; Trip mới tạo vẫn có thể chưa có chặng.

**Các kiểu response tối thiểu cần định nghĩa:**

```ts
type TripSummary = {
  id: string;
  orderId: string;
  orderCode: string;
  planStatus: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED';
  plannedBy: string;
  plannedDepartureAt: string | null;
  plannedArrivalAt: string | null;
};

type LegResponse = {
  id: string;
  seqNo: number;
  fromLocationId: string;
  fromLocationName: string;
  toLocationId: string;
  toLocationName: string;
  vehicleId: string | null;
  vehicleCode: string | null;
  vehicleActive: boolean | null;
  plannedDepartureAt: string;
  plannedArrivalAt: string;
  status: 'NOT_STARTED' | 'MOVING' | 'AT_STOP' | 'COMPLETED';
};

type TripDetail = TripSummary & { legs: LegResponse[] };
type TripList = { items: TripSummary[]; total: number; page: number; limit: number };
```

vehicleId có thể null trong dữ liệu đã tồn tại; form không được crash. Đề xuất cho lần lưu mới trong phần việc này: mọi chặng phải chọn phương tiện active. Chốt giới hạn số chặng/request cùng Bảo; không tự coi một giới hạn kỹ thuật là quy định nghiệp vụ.

### Cổng kiểm tra 1

- [ ] Bảo, Tiến, Long cùng xác nhận endpoint, response và quy tắc quyền.
- [ ] Long có mẫu JSON để bắt đầu màn hình ngay, không phải đợi API xong.
- [ ] Chốt việc chỉ thêm/sửa tại chỗ; nếu muốn xóa/đảo thứ tự thì phải đổi phạm vi và test.
- [ ] Chốt timezone, giới hạn số chặng và cách nhận biết xe inactive.
- [ ] Ghi người xác nhận, thời điểm và các thay đổi so với đề xuất này.

**Chưa đạt nếu:** Long dùng trip_id nhưng Tiến trả tripId mà chưa thống nhất, hoặc các bên hiểu khác nhau về thời gian và quyền sửa.

## Phần 2 — Backend đọc chuyến và danh mục (khoảng 60 phút)

### Các bước thực hiện

1. Tạo feature `apps/api/src/features/trips/` gồm routes, controller, service, repository, validation, DTO.
2. Dùng authenticate hiện có; không viết cơ chế đăng nhập mới.
3. Dùng authorize cho Coordinator/Manager. Service/repository tiếp tục lọc quyền sở hữu, không chỉ lọc role.
4. GET danh sách: phân trang theo helper hiện có, thứ tự ổn định; items và total dùng cùng điều kiện quyền.
5. GET chi tiết: kiểm tra ID, tìm Trip, kiểm tra quyền, lấy chặng theo seq_no tăng dần.
6. GET plan-options: kiểm tra quyền Trip, lấy danh mục phục vụ form.
7. Map dữ liệu SQL sang DTO rõ ràng. Không trả SELECT * trực tiếp hoặc giá trị BIGINT bị mất độ chính xác.
8. Nhờ Bảo nối service/router vào file chung; routes mới phải nằm sau ranh giới authenticate.

### Cổng kiểm tra 2

- [x] Coordinator A thấy T1, không thấy T2 trong danh sách và total.
- [x] Coordinator A gọi trực tiếp ID T2 nhận 404.
- [x] Manager đọc được cả T1/T2.
- [x] Customer gọi các API trips nhận 403; không token nhận 401.
- [x] Trip chưa có chặng trả legs: [], không lỗi 500.
- [x] Chặng trả đúng thứ tự; ID là chuỗi; thời gian là ISO UTC.
- [ ] Dropdown có dữ liệu thật từ API; không hard-code ID xe/địa điểm trong React.

### Kết quả triển khai và cách tự kiểm tra (16/10/2026)

Đã tạo đủ 6 file trong `apps/api/src/features/trips/`, nối service và router sau `authenticate`. Không cần chờ thao tác nối file chung. Dùng role từ tài khoản trong database; Coordinator bị lọc theo `planned_by`, Manager được đọc toàn bộ.

| API | Dùng để làm gì | Kết quả chính |
| --- | --- | --- |
| `GET /api/v1/trips?page=1&limit=20` | Liệt kê chuyến được phép xem | `items`, `total`, `page`, `limit`; ID giảm dần |
| `GET /api/v1/trips/{id}` | Xem Trip có sẵn và chặng | `legs` theo `seqNo` tăng dần; chưa có chặng trả `[]` |
| `GET /api/v1/trips/{id}/plan-options` | Lấy danh mục cho form | Địa điểm và xe active từ MySQL; kiểm tra quyền Trip trước |

**Bằng chứng kiểm thử:** `pnpm --filter api test` đạt 45 tests. `test/flow3-read.mysql.cjs` đạt 8 nhóm kiểm tra HTTP với MySQL 8.4 thử nghiệm riêng, bao gồm phân quyền, phân trang, ID vượt `Number.MAX_SAFE_INTEGER`, thời gian UTC, xe null/inactive và danh mục thay đổi theo database. TypeScript lint/build đạt. CI đã thêm bước integration này trên MySQL 8.0; kết quả CI sẽ được xác nhận khi pipeline chạy.

**Tự kiểm tra Swagger:**

1. Từ thư mục gốc chạy `pnpm dev:api`; chờ log `api_listening`.
2. Mở `http://localhost:3000/docs` (đổi cổng nếu cấu hình khác), tìm tag **Flow 3 - Trips**. Ba GET có nhãn **[Đã triển khai]**.
3. Đăng nhập tài khoản Coordinator A, dùng accessToken trong **Authorize**. Gọi danh sách, lấy `id` Trip thật từ response để gọi chi tiết và `plan-options`. ID trong ví dụ Swagger chỉ là minh họa.
4. Ghi lại một Trip thuộc Coordinator B. Với token A gọi ID này: chi tiết và options phải trả 404. Danh sách/total của A không chứa Trip B.
5. Đổi sang token Manager: xem được Trip của A và B. Token Customer trả 403; xóa token trả 401 trên cả ba GET.
6. Xem `legs`, ID dạng chuỗi và ngày kết thúc bằng `Z`. Đối chiếu options với danh mục MySQL: chỉ xe active, địa điểm đầy đủ. Không có danh mục sẽ trả mảng rỗng; API không tự seed.

**Còn mở:** backend danh mục đã đạt, nhưng checkbox dropdown React chưa thể đánh dấu vì giao diện lập kế hoạch thuộc Phần 5. Khi nối React, lấy ID từ `plan-options`, không chép ID ví dụ Swagger vào code. Phần 2 backend hoàn thành; nghiệm thu tích hợp giao diện còn chờ Phần 5.

Chạy lại integration trên MySQL **test** có quyền tạo database (script tạo/xóa duy nhất database ngẫu nhiên `wdp_flow3_test_*`):

```bash
TEST_DB_HOST=127.0.0.1 TEST_DB_PORT=3306 TEST_DB_USER=root \
TEST_DB_PASSWORD=integration-test-only TEST_DB_SSL=false \
node apps/api/test/flow3-read.mysql.cjs
```

## Phần 3 — Backend lưu kế hoạch an toàn (khoảng 90 phút)

### Câu hỏi: Khi người dùng bấm Lưu, backend phải làm gì?

1. Validate body bằng Zod theo cách API đang dùng; từ chối trường lạ.
2. Mở transaction và khóa Order/Trip liên quan. Thống nhất thứ tự khóa **Order trước, Trip sau, rồi chặng** để tránh các luồng khóa ngược nhau.
3. Đọc lại quyền sở hữu và trạng thái trong transaction; không chỉ kiểm tra ngoài transaction.
4. Chặn nếu Trip không DRAFT hoặc Order không APPROVED/PREPARING, hoặc chặng đã vận hành/có milestones/nhật ký/sự cố tham chiếu.
5. Kiểm tra mọi ID chặng cũ thuộc đúng Trip, không trùng ID; mọi chặng cũ phải được gửi lại đúng thứ tự. Thiếu chặng cũ/đảo thứ tự bị chặn trong phạm vi ngày đầu.
6. Kiểm tra địa điểm/xe tồn tại, xe active, điểm đi khác điểm đến.
7. Kiểm tra ngày giờ hợp lệ, giờ đến không trước giờ đi; chặng kế tiếp xuất phát không trước giờ đến chặng trước.
8. Kiểm tra điểm đến chặng trước bằng điểm đi chặng sau.
9. UPDATE chặng cũ theo ID; INSERT chặng mới ở cuối. Không DELETE toàn bộ chặng. Chặng mới mặc định NOT_STARTED; không nhận trạng thái thực tế từ client.
10. Cập nhật planned_departure_at/planned_arrival_at của Trip từ chặng đầu/cuối; giữ plan_status DRAFT và không đổi Order sang READY.
11. Ghi audit với actor thực, entity_type TRIP, action phù hợp (ví dụ SAVE_PLAN), dữ liệu trước/sau trong cùng transaction.
12. Commit và trả chi tiết đã lưu gồm ID của mọi chặng. Nếu lỗi ở bất kỳ bước ghi nào, rollback toàn bộ.

### Chính sách lỗi đề xuất

| Trường hợp | HTTP |
| --- | --- |
| Thiếu/sai token | 401 |
| Vai trò không được sửa, gồm Manager trong phần này | 403 |
| Không tìm thấy Trip hoặc ngoài phạm vi Coordinator | 404 |
| Sai trường, địa điểm/xe không hợp lệ, ID chặng không thuộc Trip | 400, fields chỉ rõ ô cần sửa |
| Trip/Order không cho phép sửa, chặng đã vận hành/có lịch sử | 409 |
| Lỗi nội bộ không dự kiến | 500, response an toàn; tra log bằng X-Request-ID |

Ví dụ key lỗi form: `legs.1.plannedDepartureAt`, tương ứng giờ đi của chặng thứ hai. Việc chống trùng lịch/sức chứa khi phê duyệt chưa thuộc phần này, không được mô tả là đã đảm bảo đủ điều kiện vận chuyển.

### Cổng kiểm tra 3

- [x] Lưu 2 chặng hợp lệ, GET trả đúng dữ liệu.
- [x] Sửa giờ của chặng cũ không thay ID của chặng.
- [x] Thêm chặng cuối không tạo thêm Trip.
- [x] Dữ liệu lỗi không làm thay đổi một phần kế hoạch hoặc audit.
- [x] Client gửi planStatus/actualDepartureAt bị từ chối.
- [x] Manager và Coordinator khác không thể PUT dù tự gọi API.
- [x] Không sửa/xóa milestones, horse_logs hoặc lịch sử để ép lưu thành công.

### Kết quả Phần 3 — 17/10/2026

- API: `PUT /api/v1/trips/{id}/plan`, chỉ Coordinator phụ trách. Manager nhận 403; Coordinator khác nhận 404.
- Body: `{ "legs": [...] }`, từ 1 đến 50 chặng, strict Zod. Chặng cũ phải có ID đúng thứ tự; mới không có ID, chỉ nối cuối. Không hỗ trợ xóa/đảo chặng.
- Dùng schema hiện tại `apps/api/test/fixtures/schema.sql`. Chặn `leg_milestones`, `horse_logs`, `incidents` (kể cả sự cố gắn Trip không có leg), trạng thái vận hành và actual timestamps.
- Khóa Order → Trip → chặng trong transaction READ COMMITTED; đọc lại ownership và trạng thái sau khi lấy khóa. Danh mục được khóa chia sẻ để giữ xe active/địa điểm hợp lệ trong lần ghi.
- UPDATE giữ ID, seq_no và carrier_id cũ. INSERT chặng mới NOT_STARTED. Không đổi Order; Trip giữ DRAFT. Audit SAVE_PLAN chứa actor thực và snapshot kế hoạch trước/sau, cùng transaction.
- Thời gian UTC đến giây: `2026-10-20T01:00:00Z` hoặc `2026-10-20T01:00:00.000Z`. Phần lẻ giây khác 0 bị trả 400 vì schema dùng DATETIME(0), tránh làm tròn âm thầm.
- Response 200 là TripDetail có ID của cả chặng cũ/mới; React phải giữ ID này cho lần lưu tiếp theo.

**Kiểm chứng:** 47 tests API; 17 nhóm integration đọc/lưu Trips trên MySQL riêng với schema mới, gồm audit đúng actor, bảo toàn carrier/ID, chặn lịch sử, rollback lỗi audit sau khi đã ghi chặng/Trip, hai request thêm chặng đồng thời, và đổi người phụ trách trong lúc request đang đợi khóa. Hồi quy Flow 2: 25 nhóm đạt. Không sửa database dự án.

**Giới hạn:** chưa có version/ETag hoặc idempotency key. Hai lần sửa chặng cũ có thể ghi đè theo lần lưu sau; nếu mất response khi thêm chặng, GET lại trước khi gửi lại. Chưa kiểm tra đầy đủ sức chứa/trùng lịch xe, chưa duyệt kế hoạch hoặc chuyển READY.

**Thử trên Swagger:** chạy `pnpm dev:api`, mở `/docs`, đăng nhập Coordinator, Authorize, GET danh sách lấy Trip DRAFT thuộc Order APPROVED/PREPARING thật. Gọi plan-options lấy ID thật. PUT `/trips/{id}/plan` theo ví dụ Swagger, rồi GET lại. Không dùng ID mẫu nếu database không có chúng. Các lời gọi PUT này thay đổi dữ liệu, nên dùng chuyến thử nghiệm.

## Phần 4 — Swagger và bàn giao API cho Long (khoảng 30 phút)

1. Bổ sung tag Flow 3 - Trips và 4 endpoint đã chốt.
2. Khai báo schema request/response cụ thể, required, enum, ID chuỗi và date-time.
3. Ghi rõ quyền, điều kiện chỉ sửa Trip DRAFT khi Order APPROVED/PREPARING, giới hạn thêm/sửa chặng của bản đầu.
4. Có ví dụ lần lưu đầu và lần sửa gửi kèm ID chặng.
5. Mô tả các lỗi thực sự áp dụng cho từng endpoint; response lỗi có requestId khi dùng middleware chung.
6. Thử login → Authorize → GET → PUT → GET lại trong Swagger bằng tài khoản thử.
7. Gửi Long contract cùng ví dụ dữ liệu, commit/PR và các hạn chế còn lại.

**Chú ý test hiện có:** `apps/api/test/swagger.test.cjs` đang kiểm tra cứng tổng 21 operation. Khi thêm endpoint, cập nhật kỳ vọng và bổ sung assertion cho route/schema/quyền mới; không xóa test chỉ để được xanh.

### Cổng kiểm tra 4

- [ ] Swagger hiển thị 4 API mới với response schema, không để schema: {}.
- [ ] Execute gọi đúng API và đúng mã HTTP đã mô tả.
- [ ] Long xác nhận dùng được mẫu response và hiểu trường nullable.
- [ ] Test Swagger cũ và mới đều đạt.

## Phần 5 — Giao diện Coordinator và Manager (khoảng 90 phút)

### Cấu trúc đề xuất

```text
apps/web/src/features/trips/
  TripsWorkspace.tsx
  TripPlanForm.tsx
  trips.api.ts
  types.ts
```

### Các bước thực hiện

1. Dùng `api` từ lib/axios.ts để gọi API, không tạo client riêng bỏ qua JWT.
2. Làm danh sách chuyến có loading, lỗi, rỗng và phân trang.
3. Chọn chuyến để tải chi tiết và danh mục cho form.
4. Coordinator phụ trách chuyến DRAFT có form sửa; Manager chỉ đọc.
5. Hiển thị từng chặng với điểm đi, điểm đến, xe và giờ đi/đến; cho thêm chặng cuối.
6. Không làm nút xóa/đảo thứ tự chặng đã lưu ở bản đầu; có thể bỏ dòng mới chưa lưu.
7. Ghi rõ timezone của ô ngày giờ; chuyển sang UTC khi gửi và chuyển ngược đúng khi hiển thị. Không dùng toISOString().slice(...) để điền datetime-local nếu chưa chuyển múi giờ.
8. Bấm Lưu: khóa nút trong lúc gửi, hiển thị lỗi đúng trường, giữ dữ liệu đã nhập khi lỗi mạng.
9. Thành công: dùng response mới cập nhật cả ID chặng, rồi tải lại/đối chiếu dữ liệu. Không tiếp tục gửi chặng vừa tạo như một chặng mới vì thiếu ID.
10. Xử lý đổi chuyến/rời trang khi còn dữ liệu chưa lưu; ngăn response của chuyến cũ ghi đè chuyến đang mở.
11. Nhờ Bảo gắn component vào `/dashboard?view=trips` cho Coordinator/Manager và loại placeholder tại view đó để không hiển thị hai giao diện cùng lúc.
12. View `routes` ngày đầu dẫn về cùng workspace hoặc giữ thông báo chưa triển khai rõ ràng; không tạo một form thứ hai có dữ liệu riêng.

### Cổng kiểm tra 5

- [ ] Coordinator thấy chuyến của mình và điền/lưu được form.
- [ ] Manager xem được nhưng không có nút sửa/lưu.
- [ ] Refresh trình duyệt vẫn thấy dữ liệu đã lưu.
- [ ] Lỗi mạng không làm mất dữ liệu nhập; nút Lưu được mở lại để thử tiếp.
- [ ] ID chặng cũ được giữ sau mỗi lần sửa; không nhân đôi chặng khi bấm Lưu lại sau khi tải lại chi tiết.
- [ ] Điện thoại khoảng 390px không tràn ngang trang; field và lỗi đọc được.
- [ ] Nhập giờ 08:00 theo UTC+7 thì API gửi 01:00Z và đọc lại vẫn hiển thị 08:00.

**Giới hạn cần ghi rõ:** nếu response lần tạo chặng mới bị mất, tải lại chi tiết trước khi gửi lại. Chống retry tạo chặng trùng bằng idempotency/version là phần tiếp theo; không tự coi disable nút Lưu đã xử lý được mọi trường hợp mạng.

## Phần 6 — Bảng kiểm thử bắt buộc

Dùng database kiểm thử riêng. Không đổi trạng thái hoặc chèn dữ liệu test vào database thật của nhóm để ép test đi qua.

| Mã | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| T01 | Coordinator A lấy danh sách | Chỉ có chuyến thuộc A; total đúng |
| T02 | A mở Trip của B | 404, không trả dữ liệu |
| T03 | Không token / Customer gọi trips | 401 / 403 |
| T04 | Manager GET rồi PUT kế hoạch | GET 200, PUT 403 |
| T05 | Mở Trip chưa có chặng | legs rỗng, form không crash |
| T06 | Lưu 2 chặng hợp lệ | 200; GET lại đúng; Trip vẫn DRAFT |
| T07 | Sửa chặng đã có | ID giữ nguyên; số chặng không tăng |
| T08 | Thêm chặng cuối | Chỉ thêm đúng chặng mới; số Trip không tăng |
| T09 | Xe inactive/không tồn tại | 400; toàn bộ kế hoạch cũ giữ nguyên |
| T10 | Điểm đến chặng 1 khác điểm đi chặng 2 | 400, lỗi theo trường |
| T11 | Giờ đến trước giờ đi hoặc chặng sau đi quá sớm | 400; không ghi DB |
| T12 | Gửi ID chặng thuộc Trip khác | 400; không sửa bất kỳ Trip nào |
| T13 | Gửi ID trùng/thiếu chặng cũ/đảo thứ tự | Bị từ chối theo contract, dữ liệu cũ giữ nguyên |
| T14 | Trip PENDING_APPROVAL hoặc APPROVED | 409 khi sửa |
| T15 | Order đã READY/IN_TRANSIT hoặc chặng đã có vận hành/lịch sử | 409 khi sửa |
| T16 | Gửi plannedBy/planStatus/status/actual* | 400; không được đổi quyền/trạng thái |
| T17 | Cố ý làm một bước ghi giữa transaction thất bại bằng test stub | Không lưu một nửa; không có audit thành công |
| T18 | Lưu thành công | Audit đúng actor, Trip và trước/sau |
| T19 | Hai request lưu đồng thời | Không có kế hoạch nửa A nửa B, không vỡ seq_no; ghi nhận giới hạn ghi đè |
| T20 | Mạng lỗi khi lưu từ UI | Dữ liệu nhập được giữ; có cách tải lại trước retry chặng mới |
| T21 | Refresh và kiểm tra timezone | Dữ liệu và thời gian hiển thị đúng |
| T22 | Long đọc Trip/chặng vừa lưu bằng API tracking | Nội dung khớp; Customer/Driver đúng quyền mới thấy |

### Lệnh và cách kiểm chứng

Từ thư mục gốc, sau khi đã cài dependencies theo dự án:

```bash
pnpm --filter @my-project/shared build
pnpm lint
pnpm --filter api test
pnpm build
node apps/web/test/roles.render.cjs
```

- Tạo test API mới, ví dụ `apps/api/test/trips.test.cjs`; lệnh test API hiện dùng glob `test/*.test.cjs`.
- Transaction, khóa hàng, FK và UNIQUE cần kiểm tra thêm bằng MySQL thử riêng; unit test giả lập không thay thế được bước này.
- Có thể thêm `apps/api/test/flow3.mysql.cjs` theo mẫu flow2.mysql.cjs; đây là file dự kiến cần viết, chưa phải lệnh đang có sẵn. Phải giới hạn tạo/xóa vào DB test ngẫu nhiên, không dùng DB_NAME nghiệp vụ.
- Test render hiện kỳ vọng view trips là placeholder. Cập nhật kỳ vọng cho view đã kết nối; giữ kiểm tra placeholder ở các view còn chưa làm.
- Các bài browser hiện có dùng API giả lập; cuối ngày vẫn phải có demo HTTP + MySQL thật trên môi trường phát triển.
- Không hạ assertion hoặc bỏ test quyền để đổi trạng thái kiểm tra sang xanh.

### Cổng kiểm tra 6

- [ ] T01–T21 được kiểm tra, có bằng chứng và không còn lỗi chặn lưu/đọc/quyền.
- [ ] Test hiện có không bị hồi quy.
- [ ] Có kiểm chứng MySQL transaction và ID chặng ổn định.
- [ ] T22 được Long xác nhận; nếu Long chưa sẵn sàng, ghi **Bị chặn tích hợp**, không ghi Đã tích hợp.

## Phần 7 — Ghép code và nghiệm thu (khoảng 45 phút)

### Ai sửa file nào?

- Tiến sở hữu feature trips, API/UI/test tương ứng.
- Bảo phụ trách ghép các file chung: routes/index.ts, shared/config/services.ts, shared/config/openapi.ts, DashboardLayout.tsx.
- Tiến gửi các điểm cần nối cùng PR; Bảo không phải viết thay logic hoặc test của Tiến.
- Long sở hữu tracking; dùng contract đã chốt, không sửa dữ liệu chặng bằng API đọc.
- Nếu cần migration ngoài dự kiến, thống nhất trước với Bảo; không tự chạy thay đổi schema trên DB dùng chung.

### Kịch bản demo cuối ngày

1. Bảo chỉ ra Order đã duyệt và Trip DRAFT sinh từ Flow 1.
2. Tiến đăng nhập Coordinator phụ trách, mở Trip.
3. Nhập 2 chặng liên tục, chọn xe và thời gian, bấm Lưu.
4. Tải lại trang: 2 chặng vẫn đúng.
5. Sửa giờ chặng thứ hai, lưu: ID chặng không đổi.
6. Đăng nhập Manager: xem được nhưng không sửa được.
7. Dùng Coordinator khác gọi trực tiếp API: bị từ chối.
8. Long đọc cùng dữ liệu từ màn hình của mình; không dùng JSON hard-code để chứng minh tích hợp.

### Nội dung bàn giao trong PR

- Phạm vi đã làm và phần còn thiếu.
- Endpoint/DTO mới; link Swagger hoặc ví dụ response không chứa token.
- Tài khoản theo vai trò và ID dữ liệu thử; thông tin đăng nhập chia sẻ qua kênh riêng.
- Kết quả test, lệnh đã chạy, ảnh hoặc video ngắn của kịch bản demo.
- Giới hạn: chỉ lưu nháp, chưa phê duyệt/khởi hành, chưa xóa/đảo chặng, chưa chống mọi trường hợp retry/stale edit.

### Cổng hoàn thành cuối cùng

- [ ] Cổng 0–6 đã có kết quả; các quyết định thay đổi được ghi lại.
- [ ] Code được review và ghép; chạy lại kiểm tra cần thiết trên bản ghép.
- [ ] Coordinator lưu và đọc lại được kế hoạch bằng API/DB thật.
- [ ] Không tạo Trip thứ hai, không làm hỏng Flow 1–2, không làm mất lịch sử chặng.
- [ ] Không mở quyền sửa cho Manager/Driver/Customer hoặc Coordinator khác.
- [ ] Bảo xác nhận phần ghép; Long xác nhận dữ liệu bàn giao.

## Lịch dự kiến và cách xử lý khi không kịp

Tổng ước lượng khoảng 6 giờ 30 phút, chưa tính nghỉ và lỗi môi trường. Đây là ước lượng, không phải cam kết chắc chắn với người mới.

| Thứ tự | Thời lượng | Mốc cần đạt |
| --- | --- | --- |
| Phần 0–1 | 75 phút | Hiểu source, có fixture và contract thống nhất |
| Phần 2 | 60 phút | API đọc chạy được |
| Phần 3 | 90 phút | Lưu nháp an toàn, test nghiệp vụ chính |
| Phần 4 | 30 phút | Swagger và bàn giao contract |
| Phần 5 | 90 phút | Form nối API thật |
| Phần 6–7 | 45 phút kiểm tra/ghép cuối, test viết xuyên suốt | Có bằng chứng nghiệm thu |

Nếu đến giữa ngày API lưu chưa chạy: ưu tiên quyền, transaction, dữ liệu đọc/lưu; giảm trang trí UI và giữ danh mục do Bảo chuẩn bị. Nếu cuối ngày còn lỗi quyền hoặc mất dữ liệu: ghi **Chưa hoàn thành**, bàn giao lỗi; không mở chức năng ghi cho cả nhóm dùng như đã xong.

## Phiếu theo dõi để Tiến/Bảo điền

| Phần | Trạng thái | Bằng chứng/PR/test | Người xác nhận | Vấn đề còn lại |
| --- | --- | --- | --- | --- |
| 0 — Source và dữ liệu | Chưa kiểm tra | | | |
| 1 — Contract | Chưa xác nhận | | | |
| 2 — API đọc | Chưa làm | | | |
| 3 — API lưu | Chưa làm | | | |
| 4 — Swagger | Chưa làm | | | |
| 5 — Giao diện | Chưa làm | | | |
| 6 — Test | Chưa chạy | | | |
| 7 — Ghép và demo | Chưa thực hiện | | | |

### Dữ liệu và quyết định của nhóm

- Môi trường/database kiểm thử: …
- Order/Trip của Coordinator A: …
- Trip của Coordinator B: …
- Địa điểm/phương tiện thử: …
- Giới hạn số chặng/request đã chốt: …
- Thay đổi so với contract đề xuất: …
- Người xác nhận và thời điểm: …
- Blocker và người cần hỗ trợ: …
