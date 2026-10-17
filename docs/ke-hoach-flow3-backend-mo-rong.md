# Kế hoạch hoàn thiện backend Flow 3 — duyệt kế hoạch, phân công và READY

Ngày lập: 17/10/2026. Phạm vi: HorseRoute, backend Express/MySQL.

Đây là kế hoạch triển khai, **không phải thông báo các chức năng bên dưới đã hoàn thành**. Checkbox triển khai chỉ được đánh dấu khi có bằng chứng kiểm thử; checkbox chốt nghiệp vụ dựa trên xác nhận của người dùng. Tài liệu dựa trên `apps/api/test/fixtures/schema.sql`, feature Trips và Documents hiện tại.

## 1. Điểm xuất phát và kết quả cần đạt

Đã có sáu API: GET danh sách Trips, GET chi tiết, GET plan-options, PUT lưu kế hoạch, POST submit-plan (Phần B) và POST review-plan (Phần C). Tiếp tục sử dụng authenticate, authorize, validation, transaction, audit và định dạng lỗi hiện có.

Quy tắc được người dùng chốt lại: **chỉ Coordinator phụ trách được sửa chặng khi Trip DRAFT và Order APPROVED hoặc PREPARING**. Trip PENDING_APPROVAL/APPROVED không được sửa trực tiếp. Giữ chặn các chặng đã vận hành/có lịch sử; không xóa lịch sử để sửa kế hoạch.

Luồng cần hoàn thiện:

```text
Manager duyệt Order → Order APPROVED + Trip DRAFT đã có sẵn
Coordinator lưu chặng → Trip vẫn DRAFT
Coordinator gửi duyệt → Trip PENDING_APPROVAL, Order chuyển PREPARING
Manager trả lại → Trip DRAFT + lý do → Coordinator sửa và gửi lại
Manager duyệt → Trip APPROVED
Coordinator phân công Driver/Escort theo quy tắc đã chốt
Kiểm tra hồ sơ + kế hoạch + nhân sự + xe
Manager xác nhận sẵn sàng → Order READY
```

Order và Trip là hai trạng thái riêng. Duyệt Trip không tự chứng minh hồ sơ đã đủ; READY không đồng nghĩa đã khởi hành. Việc chuyển Order sang PREPARING khi gửi duyệt lần đầu là **quy tắc bản đầu đã được người dùng đồng ý**, đã triển khai trong Phần B.

Đầu ra cuối cùng: chạy được chuỗi lưu → gửi duyệt → trả lại → sửa → gửi lại → duyệt → phân công → kiểm tra → READY; các lỗi không để lại thay đổi một phần.

## 2. Những điều schema đã có và những điểm phải chốt

| Nội dung | Schema hiện tại | Cách dùng dự kiến |
| --- | --- | --- |
| Trạng thái kế hoạch | trips.plan_status: DRAFT/PENDING_APPROVAL/APPROVED | Trả lại dùng DRAFT, không thêm enum RETURNED |
| Thông tin duyệt | approved_by, approved_at, return_reason | Ghi người thật, thời gian server, lý do trả lại |
| Chặng | legs với trip_id, seq_no, vehicle_id, giờ dự kiến | Giữ ID; không tạo Trip thứ hai |
| Phân công | trip_assignments: trip_id, user_id, role, assigned_by, assigned_at | DRIVER/ESCORT là vai trò phân công; tài khoản có role DRIVER_ESCORT |
| Ràng buộc phân công | UNIQUE(trip_id,user_id) | Một người không thể có hai dòng DRIVER và ESCORT trên cùng chuyến |
| Sức chứa | vehicles.capacity_stalls; horses.order_status | Chưa có bảng ngựa theo từng chặng hoặc quy đổi stall theo ngựa |
| Giấy tờ | documents, document_versions, attachments | Kiểm tra checklist, trạng thái, thời hạn và bản nộp |
| Hồ sơ cơ quan | dossiers.status, permit_attachment_id | Đã duyệt và có giấy phép phù hợp |
| Lịch sử | audit_logs, notifications | Audit cùng transaction; thông báo IN_APP qua cơ chế hiện có |

### Phần A — Chốt hợp đồng nghiệp vụ (30–45 phút)

**Đã được người dùng phê duyệt ngày 17/10/2026:** “Với phần Phần A — Chốt hợp đồng nghiệp vụ tôi đồng ý hết đề xuất cho bản đầu”. Các dòng dưới đây là quy tắc nghiệp vụ được chọn cho bản đầu của dự án; không phải xác nhận về quy định vận tải bên ngoài. Không suy diễn thành xác nhận riêng của Bảo/Long hoặc chức năng đã triển khai.

| Câu hỏi cần quyết định | Đề xuất cho bản đầu | Quyết định đã ghi nhận |
| --- | --- | --- |
| Ai gửi duyệt, ai duyệt? | Coordinator phụ trách gửi; Manager duyệt/trả lại | Người dùng đã đồng ý |
| Khi nào Order PREPARING? | Gửi kế hoạch lần đầu: APPROVED → PREPARING; trả lại vẫn PREPARING | Người dùng đã đồng ý |
| Ai phân công? | Coordinator phụ trách; Manager được xem | Người dùng đã đồng ý |
| Cần bao nhiêu người? | Ít nhất 1 DRIVER và 1 ESCORT khác người, account ACTIVE | Người dùng đã đồng ý |
| Ngựa nào được vận chuyển? | NORMAL được đi; REMOVED không tính; FLAGGED chặn READY đến khi xử lý | Người dùng đã đồng ý |
| Sức chứa tính thế nào? | Mọi ngựa được đi qua mọi chặng; 1 ngựa = 1 stall | Người dùng đã đồng ý |
| Xe dùng chung được không? | Một xe độc quyền trên các khoảng thời gian chặng đã được duyệt | Người dùng đã đồng ý |
| Hai chuyến sát giờ? | Khoảng [giờ đi, giờ đến); cần chốt thời gian đệm và tối thiểu thời lượng | Người dùng đã đồng ý |
| Giấy tờ còn hạn đến khi nào? | Ít nhất đến ngày đến dự kiến UTC; giấy tờ bắt buộc có hạn không được thiếu expiry_date | Người dùng đã đồng ý |
| Ai chuyển READY? | Manager gọi thao tác riêng, backend kiểm tra lại toàn bộ | Người dùng đã đồng ý |
| Trip đã APPROVED muốn sửa? | Ngoài phạm vi bản đầu; cần quy trình mở lại riêng | Người dùng đã đồng ý |

Bản đầu áp dụng công thức đã đồng ý: mọi ngựa được vận chuyển đi qua mọi chặng, một ngựa chiếm một stall. Đây là mô hình đơn giản của dự án, không khẳng định áp dụng cho mọi nghiệp vụ TRUCK/AIRCRAFT_HOLD/CRATE.

**Chi tiết chưa có giá trị cụ thể trong đề xuất gốc:** dòng “Hai chuyến sát giờ” mới xác định khoảng [giờ đi, giờ đến), chưa nêu số phút đệm hoặc thời lượng tối thiểu. Đã ghi nhận đồng ý nguyên tắc; không tự ghi rằng người dùng đã duyệt một con số. Cần xác định hai giá trị này trước khi nghiệm thu E2. Các quyết định bổ sung ngoài Phần A (ví dụ xử lý mất điều kiện sau READY) vẫn theo phần tương ứng.

Cổng A:

- [x] Đã ghi nhận người dùng đồng ý toàn bộ đề xuất bản đầu trong bảng A.
- [ ] Điền giá trị thời gian đệm/thời lượng tối thiểu còn thiếu trước khi nghiệm thu E2.
- [x] Quy ước trạng thái đã chốt: dùng APPROVED, không dùng APPROVAL.
- [x] Quy tắc đã chốt: Order APPROVED + Trip DRAFT là tình huống hợp lệ.
- [x] Ràng buộc thiết kế đã chốt: không tạo API sửa trạng thái tự do hoặc nhận approved_by/assigned_by từ client. Việc tuân thủ trong code phải kiểm thử ở B–G.

## 3. Danh sách API đề xuất

Tất cả URL bên dưới có tiền tố `/api/v1`. POST submit-plan và POST review-plan đã triển khai, kiểm thử ở Phần B–C. Các API phân công/readiness/mark-ready trong bảng vẫn là đề xuất, chưa hoạt động.

| Method + URL | Ai gọi | Gửi gì | Thành công |
| --- | --- | --- | --- |
| POST /trips/{id}/submit-plan | Coordinator phụ trách | `{}` | 200: TripDetail với PENDING_APPROVAL |
| POST /trips/{id}/review-plan | Manager | `{decision:"APPROVED"}` hoặc `{decision:"RETURNED",reason:"..."}` | 200: TripDetail và thông tin duyệt |
| GET /trips/{id}/assignment-options | Coordinator phụ trách/Manager | Không body | 200: tài khoản ACTIVE, role DRIVER_ESCORT, ID chuỗi |
| GET /trips/{id}/assignments | Coordinator phụ trách/Manager | Không body | 200: danh sách phân công thực tế |
| PUT /trips/{id}/assignments | Coordinator phụ trách | `{assignments:[{userId:"7",role:"DRIVER"},{userId:"8",role:"ESCORT"}]}` | 200: danh sách phân công đã lưu |
| GET /trips/{id}/readiness | Coordinator phụ trách/Manager | Không body | 200: kết quả từng điều kiện và các blockers |
| POST /orders/{id}/mark-ready | Manager | `{}` | 200: Order READY và tripId |

Đã bổ sung DTO chi tiết orderStatus, approvedBy, approvedAt, returnReason trong Phần C và cập nhật Swagger/tests. GET danh sách giữ TripSummary như trước; GET chi tiết, PUT lưu và POST gửi/duyệt trả TripDetail mở rộng.

Quy ước lỗi: 400 dữ liệu/ID sai; 401 chưa xác thực; 403 sai role; 404 không tồn tại/ngoài quyền Coordinator; 409 trạng thái hoặc điều kiện nghiệp vụ không cho thao tác; 500 lỗi nội bộ có requestId. Danh sách blockers không được tiết lộ đơn/chuyến khác ngoài quyền người gọi.

## 4. Phần B — Gửi kế hoạch chờ duyệt (60–90 phút)

1. Thêm validation strict, controller, service và repository cho submit-plan trong feature trips. Đặt route sau authenticate; chỉ authorize COORDINATOR.
2. Mở transaction; khóa Order → Trip → chặng. Kiểm tra lại planned_by, trạng thái Order APPROVED/PREPARING, Trip DRAFT và chưa có vận hành.
3. Đọc kế hoạch đã lưu từ database; không nhận lại toàn bộ kế hoạch trong request gửi duyệt.
4. Yêu cầu ít nhất một chặng. Kiểm tra ID, xe active, địa điểm, thời gian, nối tuyến, không có khoảng thời gian ngược; tái sử dụng validator nghiệp vụ thay vì sao chép logic.
5. Chạy kiểm tra sức chứa/trùng lịch sơ bộ theo Phần A đã được đồng ý; đây chưa phải giữ chỗ xe.
6. Cập nhật plan_status=PENDING_APPROVAL; xóa thông tin duyệt cũ/lý do trả lại của vòng trước khỏi trường hiện tại, giữ lịch sử trong audit.
7. Theo quyết định A, chuyển Order APPROVED → PREPARING. Ghi audit SUBMIT_PLAN và thông báo IN_APP cho Manager trong cùng transaction.
8. Commit, trả chi tiết. Nếu đã PENDING_APPROVAL thì trả 409, không tạo thông báo/audit trùng.

Cổng B:

- [x] Trip rỗng không gửi duyệt được; trạng thái và audit không thay đổi.
- [x] Chuyến hợp lệ chuyển PENDING_APPROVAL; Order chuyển đúng quy tắc A.
- [x] Coordinator khác nhận 404; Manager/Customer không gửi thay được.
- [x] Hai request gửi đồng thời chỉ có một lần chuyển trạng thái/thông báo.
- [x] PUT kế hoạch sau khi gửi duyệt trả 409.
- [x] Gây lỗi audit/thông báo thì toàn bộ thay đổi trạng thái rollback.

### Bằng chứng và cách kiểm tra Phần B — 17/10/2026

**Đã triển khai:** `POST /api/v1/trips/{id}/submit-plan`, body bắt buộc `{}`. Route sau authenticate, chỉ Coordinator phụ trách. Request có trường lạ trả 400; kế hoạch đã lưu không đủ điều kiện trả 409. Không nhận danh sách chặng trong request gửi duyệt.

Đã dùng lại `tripPlanSchema`, kiểm tra ownership/trạng thái có khóa và kiểm tra danh mục của luồng lưu. Kiểm tra sơ bộ số ngựa NORMAL > 0, sức chứa xe từng chặng, khoảng lịch giao với Trip APPROVED thuộc Order APPROVED/PREPARING/READY/IN_TRANSIT. Ngựa REMOVED/FLAGGED không tính là ngựa được đi trong bước này; FLAGGED vẫn cần xử lý ở readiness sau này.

**Kết quả kiểm thử:** 49 tests API đạt; 25 nhóm HTTP/MySQL Trips đạt (8 nhóm bổ sung cho gửi duyệt), dùng database test riêng nạp `fixtures/schema.sql`. Bao gồm request giả quyền, Trip rỗng, xe inactive/thiếu sức chứa/trùng lịch, lần gửi lại, hai request đồng thời, audit đúng actor, chỉ thông báo Manager ACTIVE, và lỗi audit/thông báo rollback toàn bộ. Đây là kết quả tại thời điểm hoàn thành B; xem kết quả C bên dưới. Không suy ra D–G đã hoàn thành.

Cách bạn kiểm tra:

1. Chạy `pnpm dev:api`, mở `http://localhost:3000/docs` (đổi cổng nếu cấu hình khác).
2. Login Coordinator và Authorize; GET danh sách chọn Trip DRAFT do mình phụ trách, Order APPROVED/PREPARING.
3. Dùng PUT plan lưu chặng hợp lệ trước. Đơn phải có ngựa NORMAL, xe active đủ sức chứa và không trùng lịch đã duyệt.
4. Tìm **POST /api/v1/trips/{id}/submit-plan**, nhập ID thật và body `{}`, Execute.
5. Mong đợi 200, `planStatus: PENDING_APPROVAL`, các chặng và ID giữ nguyên. GET chi tiết Trip xác nhận lại. Từ Phần C, response TripDetail có orderStatus; kiểm tra PREPARING ngay trong response.
6. Login Manager, xem API notifications: có event `TRIP_PLAN_SUBMITTED`, related_type TRIP, related_id đúng chuyến. Không có tài khoản Manager ACTIVE thì không có người nhận, nhưng trạng thái vẫn được lưu.
7. Gửi lại cùng Trip hoặc PUT sửa chặng: 409. Muốn sửa phải dùng API Manager trả lại ở Phần C đã triển khai; không đổi trạng thái thủ công trên dữ liệu thật để vượt điều kiện.

Giới hạn: lịch xe chỉ kiểm tra sơ bộ khoảng [đi, đến), chưa giữ chỗ, chưa áp dụng thời gian đệm/thời lượng tối thiểu vì chưa chốt số. Không chứng nhận đủ điều kiện READY; Phần C/E phải kiểm tra lại lịch tại duyệt với cơ chế khóa tài nguyên. Thông báo là bản ghi IN_APP, không gửi email/SMS.

## 5. Phần C — Manager duyệt hoặc trả lại (90–120 phút)

1. Thêm review-plan với decision chỉ nhận APPROVED hoặc RETURNED. RETURNED cần reason đã trim, tối đa 255 ký tự theo return_reason.
2. Trong transaction, khóa Order → Trip → chặng; chỉ xử lý Trip PENDING_APPROVAL và Order còn cho chuẩn bị.
3. Nếu RETURNED: đặt Trip DRAFT, lưu return_reason, xóa approved_by/approved_at; Order giữ PREPARING theo quy tắc A. Audit ghi đầy đủ quyết định và người trả.
4. Nếu APPROVED: kiểm tra lại toàn bộ kế hoạch, xe/sức chứa/trùng lịch theo Phần E, không dựa vào kết quả cũ ở bước gửi duyệt.
5. Thành công: đặt Trip APPROVED, approved_by=Manager hiện tại, approved_at=thời gian UTC server; xóa return_reason.
6. Audit REVIEW_PLAN và thông báo cho Coordinator cùng transaction; không chuyển Order READY tại đây.
7. Cập nhật DTO chi tiết để Coordinator đọc lý do trả lại. Người dùng có thể sửa DRAFT và gửi lại, giữ ID chặng.

Cổng C:

- [x] Manager duyệt được kế hoạch hợp lệ, đúng người và thời gian trong audit.
- [x] Coordinator không tự duyệt; body giả approved_by bị trả 400.
- [x] Trả lại thiếu lý do/255 ký tự vượt giới hạn bị chặn.
- [x] Trả lại → sửa → gửi lại → duyệt chạy được; lịch sử các vòng còn đầy đủ.
- [x] Duyệt Trip DRAFT/APPROVED hoặc duyệt hai lần bị trả 409.
- [x] Trip được duyệt vẫn chưa làm Order READY.
- [ ] Dữ liệu seed APPROVED nhưng legs=[] được báo không hợp lệ ở readiness, không tự bịa thêm chặng.

### Kết quả triển khai Phần C — 17/10/2026

**API đã hoạt động:** `POST /api/v1/trips/{id}/review-plan`. Chỉ Manager (role lấy từ tài khoản server). Hai body hợp lệ:

```json
{ "decision": "APPROVED" }
```

```json
{ "decision": "RETURNED", "reason": "Điều chỉnh xe hoặc thời gian chặng thứ hai." }
```

- Body strict: APPROVED không nhận reason; RETURNED bắt buộc reason sau trim dài 1–255 ký tự. Không nhận người duyệt/thời gian/trạng thái Order từ client.
- Chỉ nhận Trip PENDING_APPROVAL, Order APPROVED/PREPARING và chưa có vận hành. Sau RETURNED, Trip DRAFT và Coordinator được sửa/gửi lại; sau APPROVED thì PUT chặng bị chặn. Order giữ nguyên trạng thái hiện tại (luồng chuẩn giữ PREPARING), không tự READY.
- Trả lại kế hoạch rỗng/sai vẫn được để Coordinator sửa; duyệt kế hoạch rỗng/sai trả 409. Không tạo hoặc xóa chặng để ép dữ liệu hợp lệ.
- TripDetail hiện trả thêm orderStatus, approvedBy, approvedAt (ISO UTC hoặc null), returnReason. ApprovedBy lấy từ Manager thật; khi trả lại xóa approvedBy/approvedAt.
- Audit REVIEW_PLAN lưu actor, trước/sau và lý do; thông báo TRIP_PLAN_REVIEWED gửi IN_APP cho Coordinator phụ trách, cùng transaction. Không gửi email/SMS.

**Phần E cần thiết đã tích hợp vào bước duyệt:** xe active, sức chứa cho toàn bộ ngựa NORMAL, bỏ REMOVED/FLAGGED khỏi số ngựa được vận chuyển; khóa xe độc quyền theo ID tăng dần, READ COMMITTED rồi kiểm tra lại lịch. Lịch giữ bởi Trip APPROVED của Order APPROVED/PREPARING/READY/IN_TRANSIT. Không khóa các Order khác khi truy vấn xung đột.

Giờ đến phải sau giờ đi khi gửi/duyệt; lưu nháp vẫn theo validation cũ. Khoảng lịch [đi, đến), chạm đầu/cuối không tính trùng. Chưa có số phút đệm hoặc thời lượng tối thiểu được người dùng chốt, nên chưa áp dụng con số bổ sung. Tránh suy ra xe đã rảnh khi trễ lịch: tại bước duyệt, nếu xe còn MOVING/AT_STOP hoặc đã đi nhưng chưa có giờ đến thực tế ở chuyến IN_TRANSIT khác, trả 409 để yêu cầu xác minh vận hành; đây là cách xử lý bảo thủ của bản đầu.

**Bằng chứng kiểm thử:** 51 tests API và 38 nhóm integration Trips trên MySQL test cô lập nạp fixtures/schema.sql đều đạt. Có 13 nhóm mới cho review: phân quyền/validation, metadata/lý do, vòng trả-sửa-gửi-duyệt, trạng thái, kế hoạch sai, sức chứa từng chặng, lịch sử vận hành, các dạng trùng lịch, xe còn vận hành, hai quyết định trên cùng Trip, hai Trip trùng xe cùng duyệt, thứ tự xe ngược nhau không deadlock, rollback cả hai quyết định khi audit/thông báo lỗi.

**Mục còn chờ F:** checkbox “seed APPROVED nhưng legs=[] được báo ở readiness” giữ trống vì chưa có API readiness. Trong phạm vi C đã xác minh không thể duyệt kế hoạch rỗng và không tự tạo chặng. Không đánh dấu toàn bộ E/F hoàn thành chỉ vì kiểm tra duyệt đã đạt; F còn giấy tờ, phân công, FLAGGED và mất điều kiện sau READY.

### Hướng dẫn bạn thử trên Swagger

1. Chạy `pnpm dev:api`, mở `/docs`, tag **Flow 3 - Trips**.
2. Coordinator lưu Trip DRAFT hợp lệ rồi gọi submit-plan; kiểm tra PENDING_APPROVAL và orderStatus PREPARING.
3. Login Manager, thay token trong Authorize. Gọi review-plan với RETURNED và reason.
4. Mong đợi 200: planStatus DRAFT, returnReason đã trim, approvedBy/approvedAt null, Order vẫn PREPARING. Coordinator GET chi tiết nhìn thấy lý do.
5. Coordinator sửa bằng PUT plan (giữ ID chặng cũ), gửi lại submit-plan. Manager gọi review-plan với APPROVED.
6. Mong đợi 200: planStatus APPROVED, approvedBy đúng Manager, approvedAt UTC, returnReason null, Order vẫn PREPARING; chặng giữ ID.
7. Thử duyệt lại: 409. Thử gọi bằng Coordinator: 403. Xem audit và notifications bằng đúng quyền/dữ liệu test để đối chiếu.
8. Với xe vừa bị inactive/thiếu sức chứa/trùng lịch sau khi gửi duyệt: APPROVED trả 409, vẫn PENDING_APPROVAL, không có audit REVIEW_PLAN thành công. Manager có thể RETURNED để Coordinator sửa.

## 6. Phần D — Phân công Driver/Escort (90–120 phút)

1. GET assignment-options chỉ trả id, fullName và thông tin hiển thị cần thiết của tài khoản DRIVER_ESCORT đang ACTIVE; không trả password/hash.
2. GET assignments JOIN users để trả id phân công, userId, fullName, role, assignedBy, assignedAt.
3. PUT assignments nhận danh sách đầy đủ, strict; role trong phân công chỉ DRIVER/ESCORT; userId không trùng, không chấp nhận cùng người cho hai role vì UNIQUE(trip_id,user_id).
4. Đề xuất cho chỉnh phân công khi Order APPROVED/PREPARING, Trip chưa vận hành; việc này không sửa tuyến/giờ của Trip. Chặn khi Order READY/IN_TRANSIT/DELIVERED/CANCELLED.
5. Trong transaction khóa Order → Trip, kiểm tra quyền Coordinator, rồi khóa các users và phân công liên quan theo thứ tự ID ổn định.
6. Kiểm tra account ACTIVE/role và số lượng theo quyết định A. Nếu cần chống trùng lịch nhân sự, dùng khoảng toàn Trip và cơ chế khóa tài nguyên tương tự xe.
7. So sánh danh sách cũ/mới: giữ dòng không đổi, cập nhật role khi hợp lệ, thêm/xóa phân công theo yêu cầu. Không động vào legs hoặc lịch sử vận hành.
8. Ghi assigned_by/assigned_at từ server; audit ASSIGN_CREW chứa trước/sau; thông báo cho người được phân công theo cơ chế nội bộ.

Cổng D:

- [ ] Chọn người từ options thật, không hard-code ID.
- [ ] Không chọn CUSTOMER, tài khoản LOCKED hoặc ID không tồn tại.
- [ ] Cùng userId xuất hiện hai lần bị chặn bằng validation trước khi gặp lỗi unique database.
- [ ] Lưu lại danh sách giống cũ không tạo phân công trùng; ID dòng không đổi được giữ.
- [ ] Coordinator khác không xem/sửa phân công của chuyến.
- [ ] Khi READY hoặc đã vận hành, PUT bị chặn; dữ liệu cũ còn nguyên.
- [ ] Theo Phần A đã chốt bắt buộc đủ DRIVER/ESCORT, thiếu người phải xuất hiện trong readiness blockers.

## 7. Phần E — Trùng lịch xe và sức chứa (120–180 phút)

Triển khai phần này trước khi nghiệm thu duyệt kế hoạch và READY. Nếu nhóm xác nhận nằm ngoài yêu cầu, ghi rõ mục bị hoãn; không đánh dấu đã bảo đảm xe khả dụng.

### E1. Sức chứa

1. Theo quyết định A, lấy ngựa NORMAL thuộc Order, bỏ REMOVED; FLAGGED phải có kết quả xử lý rõ ràng.
2. Nếu mọi ngựa đi mọi chặng và mỗi ngựa một stall, requiredStalls = số ngựa được vận chuyển.
3. Mỗi chặng phải có xe active và capacity_stalls >= requiredStalls. Không cộng sức chứa của các chặng nối tiếp.
4. Không có ngựa hợp lệ hoặc không có xe: blocker; không cho vượt qua do COUNT=0.
5. Nếu cần chia ngựa theo chặng/xe hoặc quy đổi tải, thiết kế migration và DTO tương ứng trước. Schema hiện chưa thể diễn đạt đầy đủ các trường hợp đó.

Cổng E1:

- [ ] 4 ngựa/xe 4 stall đạt; 5 ngựa/xe 4 stall bị chặn.
- [ ] Chặng 1 đủ sức chứa nhưng chặng 2 thiếu vẫn bị chặn.
- [ ] REMOVED không tính; FLAGGED xử lý đúng quyết định đã ghi.
- [ ] Xe inactive/không tồn tại bị chặn ở cả review và mark-ready.

### E2. Trùng lịch

1. Chốt tập chuyến giữ lịch: đề xuất Trip APPROVED của Order APPROVED/PREPARING/READY/IN_TRANSIT; DRAFT, PENDING_APPROVAL không giữ chỗ. CANCELLED/REJECTED/DELIVERED không chiếm lịch tương lai theo quy tắc đã chốt.
2. Với mỗi chặng, loại chính chặng đó khi so sánh và dùng điều kiện giao nhau: existingStart < newEnd AND existingEnd > newStart. Kiểm tra cả các chặng trong cùng kế hoạch.
3. Chốt giờ đệm và chuyến có thời lượng 0. Đề xuất khi submit/review yêu cầu giờ đến > giờ đi để không có khoảng rỗng vượt qua kiểm tra.
4. Query kiểm tra đơn thuần là chưa đủ: hai Manager có thể cùng thấy xe trống. Trong transaction duyệt, khóa dòng vehicles theo ID tăng dần, sau đó đọc lại lịch bằng dữ liệu mới nhất rồi mới APPROVE.
5. Thống nhất isolation READ COMMITTED hoặc locking reads phù hợp; mọi đường ghi có thể thay đổi lịch đã giữ phải tuân cùng quy tắc khóa tài nguyên.
6. Chốt thứ tự khóa dùng chung: Order → Trip → legs → vehicles (ID tăng dần) → users (ID tăng dần) → bảng phụ thuộc. Không khóa Order khác theo kết quả tìm xung đột sau khi đã giữ vehicle; review kế hoạch khóa với các service liên quan để tránh chu kỳ chờ.
7. Khi xung đột trả 409 với field/blocker thích hợp. Không tự đổi xe, thời gian hoặc âm thầm ghi đè lịch.
8. Nếu xe đang vận chuyển quá giờ dự kiến, không được chỉ dựa vào giờ đến kế hoạch để coi xe đã rảnh; chốt cách xử lý actual/status hoặc blocker thủ công trong bản đầu.

Cổng E2:

- [ ] Cùng xe và khoảng giao nhau bị chặn; khác xe không bị chặn nhầm.
- [ ] Khoảng lồng hoàn toàn, trùng đầu/cuối và sát giờ được kiểm tra theo quy tắc đã chốt.
- [ ] Hai transaction duyệt hai Trip trùng xe đồng thời: tối đa một kế hoạch được APPROVED.
- [ ] Có test hai Trip dùng nhiều xe theo thứ tự ngược nhau để phát hiện deadlock; lỗi database không để lại trạng thái một phần.
- [ ] Không báo danh mục xe active là danh sách xe chắc chắn rảnh lịch.

## 8. Phần F — Kiểm tra sẵn sàng và chuyển READY (120–180 phút)

### F1. Dịch vụ kiểm tra dùng chung

Tạo readiness service dùng chung cho GET readiness và POST mark-ready. GET chỉ đọc, không tự sửa trạng thái/expire giấy tờ. Đề xuất response:

```json
{
  "tripId": "200",
  "orderId": "100",
  "orderStatus": "PREPARING",
  "planStatus": "APPROVED",
  "eligibleForReady": false,
  "blockers": [
    {"code": "MISSING_ESCORT", "message": "Chưa phân công người hộ tống."},
    {"code": "DOCUMENT_EXPIRED", "message": "Giấy tờ đã hết hạn.", "documentId": "45"}
  ]
}
```

Các điều kiện bắt buộc phải kiểm tra:

1. Order APPROVED/PREPARING, Trip tồn tại và APPROVED; không có dữ liệu seed thiếu chặng/thiếu thông tin duyệt bị bỏ qua.
2. Có ít nhất một ngựa được vận chuyển, có chặng hợp lệ, thời gian/tuyến liên tục; chưa có vận hành bất thường.
3. Xe active, đủ sức chứa, không trùng lịch theo Phần E.
4. Phân công đủ role theo A; tài khoản vẫn ACTIVE. Không coi danh sách userId có giá trị là đủ.
5. Đủ giấy tờ bắt buộc của từng ngựa: VALID, có phiên bản/file liên quan và còn hạn theo quyết định A. Kiểm tra expiry_date trực tiếp, không chờ job đổi status sang EXPIRED.
6. Đủ dossiers bắt buộc, đều APPROVED và có permit_attachment_id hợp lệ.
7. Phân biệt “không yêu cầu loại hồ sơ này” với “bị thiếu bản ghi”: đối chiếu tập yêu cầu được áp dụng khi Order được duyệt. Không dùng every([]) để cho qua. Nếu schema/code chưa lưu đủ tập yêu cầu được chọn, cần snapshot yêu cầu tại duyệt Order hoặc thiết kế migration; không suy ra lại từ quy tắc mới đã thay đổi.
8. Attachment mẫu có metadata chưa chứng minh file tồn tại. Dùng storage adapter để xác nhận object/file thật; tránh tải toàn bộ file chỉ để kiểm tra. Nếu kiểm tra storage thất bại, trả lý do không xác minh được, không đánh dấu đủ điều kiện.

### F2. Chuyển READY an toàn

1. POST mark-ready chỉ Manager, không nhận status tùy ý từ body.
2. Khóa Order → Trip → legs → tài nguyên theo thứ tự thống nhất; đọc lại hồ sơ/phân công và chạy readiness trong transaction. Không tin kết quả GET trước đó.
3. Nếu còn blocker: 409 kèm blockers; không đổi Order, không ghi audit thành công.
4. Nếu đủ: Order.status=READY, audit MARK_READY và thông báo cùng transaction. Trip vẫn APPROVED, không tạo Trip/chặng mới.
5. Với external storage, không thể khóa file bằng transaction MySQL. Giữ file giấy phép bất biến hoặc dùng version/object key bất biến; nêu rõ giới hạn nếu kho file còn cho xóa ngoài hệ thống.
6. Xác định khi hồ sơ/xe/nhân sự mất hiệu lực sau READY: tối thiểu API khởi hành phải kiểm tra lại; không coi READY là chứng nhận vĩnh viễn. Phối hợp luồng tracking cho điểm kiểm tra này.
7. Rà soát Documents hiện cho xử lý Order READY: các cập nhật hoặc job hết hạn có thể làm điều kiện không còn đạt. Chốt cách hạ trạng thái/tạo cảnh báo hoặc bắt buộc kiểm tra lại trước khởi hành; thay đổi trạng thái phải có audit.

Cổng F:

- [ ] GET readiness không thay đổi database và trả rõ từng lý do chưa đạt.
- [ ] Thiếu một giấy tờ/hồ sơ/người/xe đều chặn READY đúng lý do.
- [ ] Giấy tờ VALID nhưng expiry_date đã qua vẫn bị chặn.
- [ ] Có permit_attachment_id nhưng file mất/không xác minh được không được coi là hợp lệ.
- [ ] Thiếu toàn bộ checklist/dossier không vượt qua kiểm tra do mảng rỗng.
- [ ] GET báo đủ, sau đó nhân sự bị khóa/xe mất active/giấy tờ đổi trước POST: POST kiểm tra lại và từ chối.
- [ ] Hai POST mark-ready đồng thời chỉ chuyển và ghi audit một lần; lần sau 409 theo contract.
- [ ] Lỗi ghi audit rollback Order, không để READY nửa chừng.
- [ ] Nhóm có quyết định rõ về thay đổi điều kiện sau READY và điểm kiểm tra trước khởi hành.

## 9. Phần G — Swagger, kiểm thử và bàn giao (90–120 phút)

1. Cập nhật OpenAPI cho từng API thực sự đã triển khai: quyền, body strict, response, errors, examples. Các API còn dự kiến phải ghi rõ chưa triển khai.
2. Bổ sung test trạng thái theo ma trận: DRAFT/PENDING_APPROVAL/APPROVED × các trạng thái Order; giữ test PUT chỉ sửa DRAFT.
3. Test HTTP cho 401/403/404/400/409 và requestId; token role giả không được vượt qua role lấy từ database.
4. Chạy integration với MySQL test tách biệt, nạp `fixtures/schema.sql` qua `test/load-schema.cjs`; không import dump nguyên bản vào database nhóm.
5. Seed tối thiểu: Coordinator A/B, Manager, Driver/Escort ACTIVE và LOCKED; Trip rỗng/đủ/chờ duyệt/đã duyệt; xe active/inactive/trùng lịch; giấy tờ hợp lệ/hết hạn; hồ sơ thiếu giấy phép. File thử phải có object thật.
6. Test transaction: lỗi ở audit/thông báo/ghi trạng thái phải rollback; test đồng thời bằng hai kết nối MySQL thật, không chỉ mock Promise.
7. Chạy lint/build, unit/HTTP, integration Flow 1–2 hồi quy và Flow 3 mới. Ghi lệnh, ngày chạy, số test đạt/thất bại và phạm vi chưa kiểm tra.
8. Demo bằng Swagger: A lưu → gửi → Manager trả → A sửa/gửi → Manager duyệt → A phân công → GET readiness → bổ sung hồ sơ thiếu → Manager mark-ready.
9. Chuẩn bị dữ liệu và contract cho Long: tripId, legId ổn định, người được phân công, điều kiện khởi hành. Không tự gửi tin nhắn thay nhóm; ghi bàn giao trong PR/tài liệu.

Cổng G — nghiệm thu cuối:

- [ ] Demo trọn luồng bằng dữ liệu thật ở môi trường test.
- [ ] Đạt tất cả cổng bắt buộc A–F; phần hoãn ghi rõ người chịu trách nhiệm và tác động.
- [ ] Không có trường hợp API báo thành công nhưng audit/trạng thái/dữ liệu liên quan lệch nhau.
- [ ] Swagger phản ánh đúng code, không gọi các chức năng chưa làm là “đã hoàn thành”.
- [ ] Long xác nhận có thể đọc Trip/chặng/phân công cho phần tracking.

## 10. Chia việc và thứ tự thực hiện đề xuất

| Gói | Người đề xuất | Phụ thuộc | Sản phẩm bàn giao |
| --- | --- | --- | --- |
| A: chốt quy tắc | Tiến + Bảo + Long | Đọc schema và tài liệu này | Bảng quyết định đã điền |
| B–C: gửi/duyệt/trả | Tiến | A; C cần E trước nghiệm thu | API và tests trạng thái |
| D: phân công | Long | A và contract dùng chung | API + dữ liệu phục vụ tracking |
| E: xe/sức chứa | Tiến, Bảo hỗ trợ SQL/test | A | Validator dùng chung và tests concurrent |
| F: hồ sơ/readiness | Bảo | A; tích hợp C, D, E | Readiness service + mark-ready |
| G: tích hợp/demo | Cả nhóm | B–F | Swagger, tests và biên bản nghiệm thu |

Các gói có thể phát triển song song sau khi chốt contract và thứ tự khóa, nhưng không đánh dấu review/READY hoàn tất trước khi tích hợp E/F. Đây là phân công đề xuất, không phải xác nhận lịch rảnh của thành viên. Thời gian chỉ để chia phiên làm việc, không phải cam kết hoàn thành cả phần trong một buổi.

Mỗi gói dùng mẫu xác nhận:

```text
Gói:
Người thực hiện:
Commit/PR:
API đã triển khai:
Lệnh kiểm thử và kết quả:
Các checkbox đã đạt:
Điểm còn thiếu / quyết định còn chờ:
Người kiểm tra lại:
```
