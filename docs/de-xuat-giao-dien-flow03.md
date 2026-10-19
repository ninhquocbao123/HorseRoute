# Đề xuất thiết kế giao diện Flow 03: Kế hoạch chuyến và sẵn sàng vận chuyển

Ngày lập: 19/10/2026. Trạng thái: đề xuất để review, chưa triển khai giao diện.

## 1. Cơ sở và hướng thiết kế

Tài liệu tham chiếu: [Tổng hợp API Flow 03](../../Tong_Hop_API_FLow03.pdf), đặc biệt trang 1–14 về API, trang 15 về điều kiện nghiệp vụ và trang 16–19 về luồng xử lý. Đã đối chiếu DTO, validation, routes của backend trong `apps/api/src/features/trips`, readiness trong `apps/api/src/features/readiness`, và cấu trúc frontend hiện tại. Nội dung PDF được dùng làm tài liệu nghiệp vụ; các ghi chú trong tài liệu không được xem là yêu cầu thực hiện thay đổi.

**Đề xuất dùng `apps/web/src/modules/trips/`, giữ nguyên cách phân lớp Page / Component / Hook / API / Schema / Utils / Constants mà bạn đưa ra.**

Mẫu `modules/orders/` phù hợp với Flow 01. Flow 03 thao tác chủ yếu với chuyến và các chặng nên đổi tên theo miền nghiệp vụ sẽ rõ ràng hơn. Chuyến DRAFT được tạo khi Manager duyệt đơn ở Flow 01; Flow 03 không có API tạo chuyến độc lập, vì vậy không có `TripCreatePage` hoặc nút “Tạo chuyến”. Thay vào đó là trang lập kế hoạch cho một chuyến đã tồn tại.

Giữ `features/orders` và `features/documents` hiện tại trong giai đoạn này. Việc chuyển toàn bộ các feature sang `modules` là công việc riêng; tránh tạo thêm một module orders trùng chức năng chỉ để phục vụ Flow 03.

Mục tiêu giao diện:

- Coordinator biết chuyến nào cần lập kế hoạch, bị trả lại hoặc cần phân công.
- Manager xem đầy đủ kế hoạch, duyệt/trả lại, kiểm tra và xác nhận READY.
- Người dùng phân biệt rõ trạng thái **kế hoạch chuyến** và **đơn vận chuyển**.
- Mọi nút hành động phản ánh đúng quyền và trạng thái; backend vẫn quyết định tính hợp lệ cuối cùng.

## 2. Phạm vi và hành trình người dùng

### 2.1. Coordinator

Danh sách chuyến được giao → chi tiết chuyến → lập kế hoạch các chặng → lưu nháp → gửi duyệt → theo dõi kết quả → phân công tài xế/người hộ tống → kiểm tra điều kiện READY.

Nếu Manager trả lại: đọc lý do → sửa kế hoạch DRAFT → lưu → gửi duyệt lại.

Phân công có thể thực hiện khi kế hoạch DRAFT, PENDING_APPROVAL hoặc APPROVED, miễn đơn APPROVED/PREPARING và chuyến chưa vận hành. Thứ tự các tab không áp đặt điều kiện “phải duyệt kế hoạch trước mới phân công”.

### 2.2. Manager

Danh sách chuyến → xem kế hoạch đang chờ → duyệt hoặc trả lại → xem nhân sự → kiểm tra điều kiện → xác nhận đơn READY.

Manager xem kế hoạch và phân công nhưng không sửa chúng qua API của Coordinator. CUSTOMER, SPECIALIST và DRIVER_ESCORT chưa có quyền truy cập API trips của Flow 03.

### 2.3. Trạng thái cần thể hiện

| Đối tượng | Giá trị API | Nhãn giao diện |
|---|---|---|
| Kế hoạch | DRAFT | Bản nháp |
| Kế hoạch | DRAFT và có returnReason | Bản nháp · Cần chỉnh sửa |
| Kế hoạch | PENDING_APPROVAL | Chờ duyệt |
| Kế hoạch | APPROVED | Đã duyệt |
| Đơn | APPROVED | Đơn đã duyệt |
| Đơn | PREPARING | Đang chuẩn bị |
| Đơn | READY | Sẵn sàng vận chuyển |

`RETURNED` là quyết định duyệt, không phải giá trị planStatus. Khi trả lại, kế hoạch trở về DRAFT. READY thuộc đơn; không có planStatus READY. READY cũng chưa có nghĩa chuyến đã khởi hành.

## 3. Bố cục và phong cách

Kế thừa sidebar, topbar, AccountMenu, font Segoe UI, nền sáng, xanh lá đậm và các thành phần WorkflowIntro hiện có. Dùng CSS riêng cho trips, giới hạn selector dưới `.trip-workspace` để tránh ảnh hưởng Flow 01/02.

- Tiêu đề trang 24–28px; tiêu đề khu vực 18–20px; nội dung/form 14–16px.
- Khoảng cách theo nhịp 8px, card bo góc 12–16px, viền nhẹ.
- Xanh lá: thành công; vàng: chờ/cần chú ý; đỏ: lỗi chặn; xám: nháp.
- Badge luôn có chữ, không truyền đạt trạng thái chỉ bằng màu.
- Desktop: nội dung chính và cột tóm tắt; mobile: một cột, bảng chuyển thành card, thanh hành động không che trường nhập.
- Form có label, lỗi cạnh trường, focus vào lỗi đầu tiên; modal giữ focus và trả focus khi đóng.
- Trình tự là hướng dẫn nghiệp vụ, không dùng phần trăm tiến độ giả khi API chưa cung cấp đủ dữ liệu.

### 3.1. Giao diện tự động co giãn theo kích thước màn hình

**Yêu cầu bắt buộc:** giao diện tự thay đổi độ rộng, số cột và cách sắp xếp nội dung theo vùng hiển thị thực tế, không cần người dùng chọn chế độ mobile/desktop. Khi kéo thay đổi kích thước cửa sổ hoặc xoay thiết bị, dữ liệu nhập, tab đang chọn và trạng thái thao tác phải được giữ nguyên.

Thiết kế mobile-first, dùng Grid/Flex và kích thước linh hoạt. Không cố định chiều rộng trang/form theo một màn hình mẫu. Vùng nội dung dùng `width: 100%`, `min-width: 0`, giới hạn chiều rộng tối đa phù hợp và khoảng đệm co giãn; có thể dùng `clamp()` cho padding và tiêu đề. Breakpoint dưới đây là mốc khởi đầu, điều chỉnh nếu nội dung thực tế không còn đủ chỗ.

| Chiều rộng viewport | Bố cục đề xuất |
|---|---|
| 320–767px | Một cột; sidebar thu vào menu; danh sách thành card; form xếp dọc; nút có thể xuống dòng hoặc rộng toàn hàng |
| 768–1199px | Sidebar thu gọn khi cần; form tối đa hai cột nếu đủ chỗ; tóm tắt xuống dưới nếu vùng nội dung hẹp |
| Từ 1200px | Sidebar đầy đủ; nội dung chính và tóm tắt hai cột khi đủ chỗ; giới hạn chiều rộng vùng đọc trên màn hình lớn |

Quy tắc theo thành phần:

- Quyết định số cột theo cả chiều rộng nội dung còn lại sau sidebar; không chỉ dựa vào kích thước thiết bị. Có thể dùng container query hoặc Grid tự co cột.
- Input/select rộng theo ô chứa; tên địa điểm, tên người, mã lỗi và thông báo dài xuống dòng, không đẩy vỡ bố cục.
- Tab có thể xuống dòng hoặc cuộn ngang trong riêng thanh tab; không gây cuộn ngang cả trang.
- Modal giới hạn theo viewport, có cuộn bên trong khi nội dung dài; nút đóng/xác nhận vẫn truy cập được trên màn hình thấp.
- Thanh hành động sticky chỉ dùng khi không che nội dung, lỗi trường hoặc bàn phím ảo; bố trí khoảng đệm cuối trang tương ứng.
- Nút và vùng bấm chính có kích thước tối thiểu 44 × 44px. Không thu nhỏ chữ đến mức khó đọc để ép nội dung vừa màn hình.
- Kiểm tra ở 320, 375, 768, 1024, 1440 và 1920px, thêm kéo cửa sổ liên tục giữa các mốc, xoay ngang và zoom 200%.

**Đạt khi:** không cuộn ngang toàn trang, không mất nội dung/nút thao tác, không chồng lấn, modal dùng được, và form không reset khi đổi kích thước. Kiểm tra responsive ngay trong từng phần triển khai, không chờ tới cuối dự án.

## 4. Màn hình đề xuất

### 4.1. Danh sách chuyến — TripListPage

```text
Chuyến vận chuyển
Lập kế hoạch, phân công và chuẩn bị hành trình

[Trang trước]  Trang 1 / n  [Trang sau]     [20 dòng ▼] [Làm mới]
┌──────────┬───────────┬──────────────┬──────────────┬─────────────┐
│ ID chuyến│ Mã đơn    │ Kế hoạch     │ Khởi hành    │ Đến dự kiến │
│ #200     │ ORD-0100  │ Chờ duyệt    │ ...          │ ...         │
└──────────┴───────────┴──────────────┴──────────────┴─────────────┘
                                                    [Xem chi tiết]
```

API thực tế trả `items`, `total`, `page`, `limit`; hỗ trợ `page` và `limit` (1–100), mặc định 20. Sắp xếp ID giảm dần do server quyết định.

**Phiên bản đầu chỉ có phân trang, số dòng và làm mới.** Backend dùng query schema strict, chưa hỗ trợ search, planStatus, coordinatorId hoặc sort. Không gửi các tham số này và không lọc riêng một trang rồi hiển thị như kết quả toàn bộ dữ liệu. `TripListControls` đảm nhiệm các điều khiển hiện có; `TripFilters` chỉ thêm khi backend hỗ trợ.

Các cột chỉ dùng dữ liệu TripSummary. Không giả định có tên Coordinator, tên khách hàng, số ngựa, trạng thái đơn hoặc kết quả readiness trong danh sách; không gọi detail/readiness cho từng dòng để dựng thống kê.

Trạng thái rỗng: “Chưa có chuyến vận chuyển” hoặc “Bạn chưa được giao chuyến”. Mô tả chuyến được tạo từ bước duyệt đơn, không đưa nút tạo mới. Lỗi tải có nút thử lại; loading dùng skeleton.

### 4.2. Chi tiết chuyến — TripDetailPage

```text
← Danh sách chuyến
Chuyến #200 · Đơn ORD-0100
[Kế hoạch: Chờ duyệt] [Đơn: Đang chuẩn bị]

[Kế hoạch] [Nhân sự] [Điều kiện READY]

┌──────────────────────────────────┬──────────────────────────┐
│ Nội dung tab                     │ Tóm tắt chuyến           │
│ Timeline các chặng / nhân sự /    │ ID người lập             │
│ danh sách vấn đề cần xử lý        │ Khởi hành / đến dự kiến  │
│                                  │ Người duyệt / lúc duyệt  │
└──────────────────────────────────┴──────────────────────────┘
```

Tóm tắt dùng `plannedBy`, `approvedBy` dưới dạng ID khi chưa có API trả họ tên; không hiển thị tên tự suy đoán. Hiển thị lý do trả lại trong banner gần đầu trang.

Tab Kế hoạch trình bày chặng theo seqNo: điểm đi → điểm đến, mã xe, giờ đi/đến và trạng thái chặng. Coordinator đủ điều kiện thấy “Lập kế hoạch” khi chưa có chặng, hoặc “Chỉnh sửa kế hoạch”. Manager thấy “Duyệt kế hoạch” và “Trả lại chỉnh sửa” khi PENDING_APPROVAL.

Không dựng tab lịch sử audit trong phạm vi đầu tiên: API hiện không cung cấp endpoint đọc lịch sử kế hoạch. Chỉ hiển thị metadata duyệt và lý do trả lại mà detail có trả về.

### 4.3. Lập/chỉnh sửa kế hoạch — TripPlanPage

Trang riêng phù hợp form dài tới 50 chặng, URL có thể truy cập trực tiếp và dễ xử lý dữ liệu chưa lưu.

```text
← Chi tiết chuyến                       Kế hoạch chuyến #200
[Lý do trả lại, nếu có]
Múi giờ nhập: Asia/Ho_Chi_Minh (UTC+07:00)

Chặng 01
[Điểm đi ▼]        [Điểm đến ▼]
[Phương tiện ▼ — mã, loại, sức chứa]
[Khởi hành dự kiến] [Đến dự kiến]

Chặng 02
[Điểm đi nối từ chặng 01] [Điểm đến ▼]
...
[+ Thêm chặng cuối]

[Quay lại]                         [Lưu nháp] [Lưu và gửi duyệt]
```

Quy tắc tương tác:

- Dùng useFieldArray cho danh sách chặng; giữ riêng ID do backend cấp và key phục vụ render của form.
- Chặng đã lưu không có nút xóa hoặc kéo thả. Payload phải chứa đầy đủ ID cũ đúng thứ tự; chặng mới chỉ thêm cuối.
- Cho phép bỏ các chặng mới chưa lưu; sau đó tính lại liên kết và kiểm tra toàn bộ chuỗi. Không biến thao tác này thành xóa chặng đã tồn tại.
- Điểm đi chặng sau lấy từ điểm đến chặng trước. Khi đổi điểm đến, đồng bộ điểm đi kế tiếp và kiểm tra lại lỗi; không tự thay thời gian/xe người dùng đã nhập.
- Dropdown địa điểm hiển thị tên, loại, quốc gia, timezone; xe hiển thị mã, loại, số chỗ. Danh mục rỗng có giải thích và chặn lưu nếu không đủ dữ liệu.
- Xe active trong danh mục chưa có nghĩa xe rảnh hoặc đủ chỗ. UI không gắn nhãn “Khả dụng” từ plan-options.
- Dữ liệu xe đã chọn nhưng không còn trong options vẫn được hiển thị từ detail, kèm cảnh báo cần chọn lại; không âm thầm bỏ dữ liệu.
- Đề xuất mặc định nhập giờ theo Asia/Ho_Chi_Minh, luôn ghi rõ múi giờ. Tất cả chặng dùng cùng múi giờ nhập để giảm nhầm lẫn khi qua biên giới. Timezone địa điểm là thông tin tham chiếu.
- Hàm chuyển đổi phải dùng múi giờ đã công bố, không ngầm dùng múi giờ trình duyệt. Payload ISO UTC có Z, chính xác đến giây. Trường hợp thêm lựa chọn múi giờ sau này cần thư viện hỗ trợ IANA và kiểm tra DST.
- Khi đơn không APPROVED/PREPARING, kế hoạch không DRAFT hoặc đã biết có vận hành: hiển thị chỉ đọc và lý do. Detail không thể hiện toàn bộ lịch sử vận hành, nên không cam kết frontend phát hiện được mọi điều kiện khóa; xử lý 409 từ server.

“Lưu nháp” cho phép giờ đến bằng giờ đi, đúng API. “Lưu và gửi duyệt” yêu cầu giờ đến sau giờ đi; lưu thành công trước rồi mới submit `{}`. Nếu lưu thành công nhưng submit thất bại, thông báo “Đã lưu bản nháp, chưa gửi duyệt”, giữ ID chặng mới từ response, cho sửa hoặc thử gửi lại. Không báo thất bại chung khiến người dùng tưởng bản nháp chưa được lưu.

Khi có thay đổi chưa lưu: chặn điều hướng nội bộ bằng dialog lưu/bỏ thay đổi/ở lại; cảnh báo đóng tab bằng beforeunload. Không ghi đè form đang dirty khi query tự cập nhật.

### 4.4. Duyệt kế hoạch — khu vực dành cho Manager

Đọc kế hoạch trên tab Kế hoạch. “Duyệt kế hoạch” mở dialog tóm tắt chuyến và xác nhận; “Trả lại chỉnh sửa” mở form lý do, bắt buộc 1–255 ký tự sau trim.

API kiểm tra lại điều kiện khi duyệt. Khi thành công, cập nhật detail và danh sách. Khi trả lại, hiển thị DRAFT cùng lý do; không chuyển đơn về APPROVED. Không cho Manager sửa chặng hoặc phân công thay Coordinator.

### 4.5. Nhân sự — tab trong TripDetailPage

Form bảng gồm họ tên nhân sự và vai trò trên chuyến DRIVER/ESCORT, có thêm/xóa dòng. Dùng lựa chọn có tìm kiếm trong danh sách assignment-options đã tải đầy đủ.

- 2–100 người; ít nhất một tài xế và một người hộ tống khác nhau.
- Mỗi userId chỉ xuất hiện một lần và giữ một vai trò trên chuyến.
- Tài khoản có role DRIVER_ESCORT; đây là vai trò tài khoản, khác vai trò DRIVER/ESCORT trong phân công.
- Nhân sự đã phân công nhưng không còn đủ điều kiện vẫn hiển thị cùng blocker; không mất khỏi bảng chỉ vì không nằm trong options.
- PUT gửi toàn bộ danh sách cuối cùng. Trước lưu, dialog nêu người thêm, đổi vai trò và bị gỡ. Không gửi chỉ các dòng thay đổi.
- Hiển thị crewReadiness với chữ “Đủ điều kiện nhân sự”; không suy thành “Sẵn sàng vận chuyển”. API chưa kiểm tra trùng lịch nhân sự.
- Manager chỉ xem; Coordinator chỉnh sửa khi đơn APPROVED/PREPARING và chưa vận hành, không khóa theo riêng planStatus.
- Backend chưa có version chống ghi đè. UI cần cảnh báo về khả năng bị thay đổi ở phiên khác, cho tải lại có xác nhận; không mô tả cơ chế này như đã chống được xung đột đồng thời.

### 4.6. Điều kiện READY — tab trong TripDetailPage

Đây là màn hình giải thích vì sao chưa hoàn tất chuẩn bị, không chỉ là nút xác nhận.

```text
Điều kiện chuyển READY                        [Kiểm tra lại]
Lần kiểm tra: ...
[Còn 3 vấn đề cần xử lý]

Kế hoạch/xe       VEHICLE_CONFLICT       Xem chặng liên quan
Nhân sự          MISSING_ESCORT         Mở tab Nhân sự
Hồ sơ            DOCUMENT_EXPIRED       Xem hướng xử lý

                                     [Xác nhận READY — Manager]
```

Hiển thị 4 trạng thái riêng: chưa kiểm tra, đang kiểm tra, kiểm tra lỗi, đã có kết quả. HTTP 200 nhưng eligibleForReady=false là kết quả nghiệp vụ, không phải lỗi mạng.

Nhóm blockers theo kế hoạch/chặng/xe, nhân sự, ngựa, hồ sơ/file và trạng thái vận hành. Mỗi dòng có message, mã lỗi có thể xem thêm, ID đối tượng liên quan và hướng xử lý phù hợp quyền. Với nhóm không có blocker, ghi “Không ghi nhận vấn đề trong lần kiểm tra này”; API không trả checklist thành công chi tiết nên không bịa từng mục kiểm tra đạt.

Nút xác nhận chỉ dành cho Manager khi kết quả mới nhất eligibleForReady=true và đơn còn APPROVED/PREPARING. POST dùng **orderId**, không dùng tripId; backend kiểm tra lại. Nếu trả 409 cùng blockers, cập nhật danh sách vấn đề mới nhất và bỏ trạng thái đủ điều kiện cũ.

Sau thành công: hiển thị đơn READY, kế hoạch APPROVED và thông báo “Đã hoàn tất chuẩn bị; chuyến chưa khởi hành”. Không gọi readiness rồi hiển thị đỏ vì đơn READY không đủ điều kiện chuyển READY lần nữa. Nếu mở lại đơn READY, hiển thị trạng thái đã hoàn tất bước này và không cho xác nhận lần hai.

## 5. Ma trận quyền và trạng thái

| Hành động | Coordinator phụ trách | Manager | Điều kiện chính |
|---|---|---|---|
| Xem danh sách/chi tiết | Chuyến của mình | Tất cả chuyến | Tài khoản hoạt động |
| Lưu kế hoạch | Có | Không | DRAFT; đơn APPROVED/PREPARING; chưa vận hành |
| Gửi duyệt | Có | Không | Điều kiện lưu và kiểm tra kế hoạch/xe |
| Duyệt hoặc trả lại | Không | Có | PENDING_APPROVAL; đơn APPROVED/PREPARING; chưa vận hành |
| Lưu phân công | Có | Không | Đơn APPROVED/PREPARING; chưa vận hành |
| Kiểm tra readiness | Có | Có | Có quyền xem chuyến |
| Chuyển READY | Không | Có | Toàn bộ điều kiện backend đạt |

Ẩn hành động không thuộc vai trò. Với hành động thuộc vai trò nhưng chưa đủ điều kiện đã biết, disable và hiển thị lý do gần nút. Route guard cải thiện UX, không thay thế kiểm soát quyền backend.

## 6. Cấu trúc thư mục đề xuất

```text
apps/web/src/modules/trips/
├── api/
│   └── trips.api.ts
├── pages/
│   ├── TripListPage.tsx
│   ├── TripDetailPage.tsx
│   └── TripPlanPage.tsx
├── components/
│   ├── TripList.tsx
│   ├── TripListControls.tsx
│   ├── TripSummary.tsx
│   ├── TripStatusBadge.tsx
│   ├── TripDetailTabs.tsx
│   ├── TripLegTimeline.tsx
│   ├── TripPlanForm.tsx
│   ├── TripLegForm.tsx
│   ├── TripPlanReviewDialog.tsx
│   ├── TripAssignmentsForm.tsx
│   ├── TripAssignmentsConfirmDialog.tsx
│   ├── TripReadinessPanel.tsx
│   ├── ReadinessBlockerList.tsx
│   └── MarkReadyDialog.tsx
├── hooks/
│   ├── use-trips-query.ts
│   ├── use-trip-detail-query.ts
│   ├── use-trip-plan-options-query.ts
│   ├── use-trip-assignments-query.ts
│   ├── use-trip-assignment-options-query.ts
│   ├── use-trip-readiness-query.ts
│   ├── use-trip-mutations.ts
│   ├── use-trip-plan-form.ts
│   ├── use-trip-assignments-form.ts
│   ├── use-trip-review-form.ts
│   ├── use-trip-permissions.ts
│   └── use-trip-unsaved-changes.ts
├── schemas/
│   ├── trip-plan.schema.ts
│   ├── trip-assignments.schema.ts
│   └── trip-review.schema.ts
├── types/
│   └── trip.types.ts
├── constants/
│   ├── trip-status.constants.ts
│   ├── trip-query-keys.ts
│   └── readiness-blockers.constants.ts
├── utils/
│   ├── trip-plan.utils.ts
│   ├── trip-time.utils.ts
│   ├── trip-assignments.utils.ts
│   └── trip-error.utils.ts
└── styles/
    └── trips.css
```

### Trách nhiệm các lớp

| Lớp | Trách nhiệm | Giới hạn |
|---|---|---|
| Page | Lấy tripId, tab, page từ URL; gọi hook; ghép component | Không viết request/payload hoặc luật validation trong JSX |
| Component | Render dữ liệu; nhận callback và trạng thái form/pending qua props | Không tự gọi Axios, điều hướng hoặc suy quyền nghiệp vụ |
| Hook query | Fetch, enabled, query key và vòng đời dữ liệu | Không chuyển đổi dữ liệu thành JSX |
| Hook mutation | Thao tác API, đồng bộ cache, xử lý kết quả và lỗi | Không tự suy rằng thao tác backend đã thành công |
| Hook form | RHF, default values, dirty, field array, chuỗi lưu/gửi, lỗi trường | Không nhúng endpoint |
| Hook permissions | Tính quyền thao tác từ role, owner, trạng thái đã biết | Không khẳng định phát hiện toàn bộ lịch sử vận hành |
| API | Hàm endpoint với request/response có type | Không toast, setState, redirect hoặc validation form |
| Schema | Validate input và quan hệ giữa trường | Kiểm tra lịch xe/file thực tế vẫn thuộc backend |
| Utils | Hàm thuần mapping DTO/form/payload, thời gian, diff nhân sự, lỗi | Không gọi API và không chứa React state |
| Constants | Nhãn, màu, query keys, ánh xạ blocker | Không thực hiện side effect |
| Types | DTO, payload, form values, enums/unions | Không import trực tiếp source backend vào frontend |

Định nghĩa type tập trung ở `types/trip.types.ts`; `api/trips.api.ts` dùng các type đó để khai báo hợp đồng request/response. Nếu sau này đưa DTO vào package shared, dùng type từ shared thay vì sao chép nhiều nơi.

Dùng React Query, React Hook Form và Zod đã có trong dự án; không cần thêm global store cho dữ liệu chuyến. Modal trình bày dùng component dùng chung, trạng thái thao tác do hook quản lý.

## 7. Routes và tích hợp dashboard hiện tại

| URL đề xuất | Page | Mục đích |
|---|---|---|
| `/dashboard/trips?page=1&limit=20` | TripListPage | Danh sách có phân trang |
| `/dashboard/trips/:tripId?tab=plan` | TripDetailPage | Xem và duyệt kế hoạch |
| `/dashboard/trips/:tripId?tab=crew` | TripDetailPage | Phân công nhân sự |
| `/dashboard/trips/:tripId?tab=readiness` | TripDetailPage | Kiểm tra và xác nhận READY |
| `/dashboard/trips/:tripId/plan` | TripPlanPage | Lập/chỉnh sửa kế hoạch |

Các URL trên là thiết kế mới. Hiện app chỉ có `/dashboard` và điều hướng bằng `?view=...`.

Đề xuất tách phần khung sidebar/topbar từ DashboardLayout thành DashboardShell dùng lại, nhận nội dung con/Outlet. Route mới nằm trong ProtectedRoute và guard MANAGER/COORDINATOR; giữ các màn hiện tại tại `/dashboard?view=...`. Sidebar “Chuyến vận chuyển” chuyển sang URL mới. Link cũ `?view=trips` được chuyển hướng tới danh sách mới, tránh còn trang placeholder.

Không hiển thị đồng thời nội dung placeholder cũ và page mới. Back về danh sách giữ page/limit; query tab không hợp lệ về tab kế hoạch. Refresh/deep link phải tải được detail theo URL.

Liên kết “Xem hồ sơ” cần bổ sung khả năng chọn đơn theo URL cho DocumentsWorkspace, ví dụ `/dashboard?view=documents&orderId=100`. Hiện workspace chưa tự đọc orderId từ URL; đây là thay đổi tích hợp cần thực hiện, không phải tính năng sẵn có. Manager có thể mở hồ sơ để xem; Coordinator chưa có khu vực documents trong cấu hình hiện tại, nên hiển thị hướng dẫn phối hợp Specialist thay vì đưa link không có quyền. Không tự gửi tin nhắn/thông báo ngoài hành vi API đã có.

## 8. Ánh xạ API và dữ liệu

Prefix dưới đây là `/api/v1`. Client tiếp tục dùng instance `lib/axios.ts`; kiểm tra VITE_API_URL trước khi ghép đường dẫn để không lặp prefix.

| Hàm API đề xuất | Endpoint | Request | Response / nơi dùng |
|---|---|---|---|
| getTrips | GET /trips | query page, limit | TripList / danh sách |
| getTripDetail | GET /trips/{tripId} | Không body | TripDetail / chi tiết |
| getTripPlanOptions | GET /trips/{tripId}/plan-options | Không body | locations, vehicles / form |
| saveTripPlan | PUT /trips/{tripId}/plan | legs đầy đủ | TripDetail / lưu nháp |
| submitTripPlan | POST /trips/{tripId}/submit-plan | `{}` | TripDetail / gửi duyệt |
| reviewTripPlan | POST /trips/{tripId}/review-plan | decision, reason khi RETURNED | TripDetail / duyệt |
| getAssignmentOptions | GET /trips/{tripId}/assignment-options | Không body | items / chọn nhân sự |
| getTripAssignments | GET /trips/{tripId}/assignments | Không body | TripAssignments / xem phân công |
| saveTripAssignments | PUT /trips/{tripId}/assignments | assignments đầy đủ | TripAssignments / lưu phân công |
| getTripReadiness | GET /trips/{tripId}/readiness | Không body | eligibleForReady, blockers / kiểm tra |
| markOrderReady | POST /orders/{orderId}/mark-ready | `{}` | orderId, tripId, orderStatus, planStatus |

`markOrderReady` có thể đặt trong trips.api.ts vì phục vụ trực tiếp Flow 03, nhưng tên hàm và tham số phải thể hiện orderId. Khi orders có API module ổn định, chuyển hàm sang đó và tái sử dụng; không định nghĩa hai bản khác nhau.

Mọi ID giữ dưới dạng string vì backend dùng BIGINT; không ép Number. Form UI giữ kiểu riêng, payload được dựng bằng danh sách trường cho phép:

```ts
{
  legs: [{
    // Chỉ có id nếu chặng đã được backend lưu.
    id?: string,
    fromLocationId: string,
    toLocationId: string,
    vehicleId: string,
    plannedDepartureAt: string, // ISO UTC có Z
    plannedArrivalAt: string
  }]
}
```

Không spread TripLeg vào request: seqNo, status, vehicleCode, tên địa điểm, planStatus và thời gian thực tế không thuộc schema lưu kế hoạch.

## 9. Query, cache và xử lý thao tác

Query keys đề xuất, trong đó accountId giúp tách dữ liệu giữa các tài khoản:

```ts
['trips', accountId, 'list', { page, limit }]
['trips', accountId, tripId, 'detail']
['trips', accountId, tripId, 'plan-options']
['trips', accountId, tripId, 'assignments']
['trips', accountId, tripId, 'assignment-options']
['trips', accountId, tripId, 'readiness']
```

- Query chỉ chạy khi có account, role phù hợp và tripId hợp lệ. Backend xác minh quyền sở hữu thực tế.
- Detail tải trước; dữ liệu tab/options chỉ tải khi cần. Không gọi readiness cho toàn bộ danh sách.
- Detail và options có thể tải song song ở trang form sau guard; không khởi tạo form đến khi dữ liệu cần thiết sẵn sàng.
- Lưu/gửi/duyệt thành công: cập nhật detail từ response, invalidate danh sách và readiness; refresh thông báo khi phù hợp hành vi backend.
- Lưu nhân sự: cập nhật assignments từ response, invalidate readiness và thông báo liên quan.
- Mark-ready: refetch detail/danh sách và dữ liệu đơn liên quan; không thay TripDetail bằng response mark-ready vì response này chỉ có một số trường.
- Readiness dùng dữ liệu mới khi mở tab hoặc nhấn kiểm tra lại; hiển thị thời điểm kiểm tra. Kết quả trước mutation không tiếp tục dùng để bật xác nhận.
- Mutation không optimistic update cho duyệt, phân công và READY; khóa gửi lặp trong lúc pending, không tự retry thao tác ghi. Nếu mạng mất sau khi gửi, tải lại trạng thái trước khi đề nghị thao tác lại.
- Dữ liệu query refetch không reset form dirty. Sau lưu, dùng response server làm baseline mới để chặng vừa thêm có ID và form hết dirty.

## 10. Validation và lỗi

### 10.1. Validation tại client

| Phần | Kiểm tra |
|---|---|
| Kế hoạch | 1–50 chặng; ID hợp lệ; không trùng ID chặng; đủ trường bắt buộc |
| Tuyến | Điểm đi khác điểm đến; chặng sau nối đúng chặng trước |
| Thời gian lưu nháp | Đến ≥ đi; đi chặng sau ≥ đến chặng trước |
| Thời gian gửi duyệt | Đến > đi; giữ liên kết thời gian các chặng |
| Payload | UTC có Z đến giây; giữ ID/thứ tự chặng đã lưu; chỉ thêm chặng cuối |
| Trả lại | Lý do trim dài 1–255 ký tự |
| Phân công | 2–100 người; userId duy nhất; có DRIVER và ESCORT khác người |

Backend quyết định sức chứa cho toàn bộ ngựa NORMAL, lịch xe, xe còn vận hành, hồ sơ và file thực tế. DTO trips hiện không trả số ngựa NORMAL; UI không tự tính sức chứa phù hợp từ dữ liệu không có.

Khoảng lịch xe là [giờ đi, giờ đến); hiện chưa có thời gian đệm. Không tự áp đặt quy tắc nghỉ tối thiểu. Submit chưa kiểm tra xe còn vận hành ở chuyến khác; việc submit thành công không bảo đảm review/readiness thành công.

### 10.2. Phản hồi lỗi

| HTTP/tình huống | Trình bày |
|---|---|
| 400 và fields | Ánh xạ lỗi vào trường như `legs.1.plannedDepartureAt`; giữ dữ liệu đã nhập; có tóm tắt nếu không ánh xạ được |
| 401 | Đi theo interceptor đăng nhập lại hiện có; không hứa giữ form qua reload nếu chưa có cơ chế lưu phục hồi |
| 403 | Thông báo không có quyền; dừng thao tác và cho về danh sách |
| 404 | “Chuyến không tồn tại hoặc bạn không có quyền truy cập” |
| 409 | Hiển thị message/blockers; refetch trạng thái; nếu form dirty thì yêu cầu chọn tải lại/bỏ thay đổi thay vì ghi đè |
| Lỗi mạng/5xx | Thông báo có thể thử lại; giữ dữ liệu nhập; với request ghi chưa rõ kết quả, kiểm tra server trước |
| Blocker code mới | Hiển thị message và mã gốc, không làm crash hoặc bỏ qua |

## 11. Hướng dẫn xử lý blockers và giới hạn sản phẩm

| Nhóm blocker | Hành động UI phù hợp |
|---|---|
| MISSING_DRIVER / MISSING_ESCORT / INELIGIBLE_CREW | Mở tab nhân sự; Coordinator cập nhật, Manager chỉ xem |
| PLAN_NOT_APPROVED | DRAFT: Coordinator sửa/gửi; PENDING_APPROVAL: Manager duyệt/trả |
| NO_LEGS / INVALID_LEG / PLAN_TIME_MISMATCH / VEHICLE_INACTIVE / VEHICLE_CAPACITY / VEHICLE_CONFLICT | Liên kết chặng nếu có legId. DRAFT cho sửa; chờ duyệt cho Manager trả lại; APPROVED không có API mở lại |
| DOCUMENT_NOT_VALID / DOCUMENT_EXPIRY_MISSING / DOCUMENT_EXPIRED | Xem giấy tờ/hướng dẫn phối hợp Customer và Specialist; hạn cần đủ đến ngày đến dự kiến |
| DOSSIER_NOT_APPROVED | Hướng dẫn Specialist hoàn tất luồng hồ sơ cơ quan |
| DOCUMENT_FILE_UNVERIFIED / PERMIT_FILE_UNVERIFIED | Nêu cần đối soát kho lưu trữ; chỉ bổ sung file nếu trạng thái hồ sơ cho phép |
| REQUIREMENTS_UNVERIFIED / DOCUMENT_MISSING / DOSSIER_MISSING / HORSE_FLAGGED / NO_TRANSPORT_HORSES | Thông báo cần đối soát dữ liệu; chưa có API Flow 03 xử lý trọn vẹn |
| ORDER_NOT_PREPARING / OPERATION_STARTED | Đọc lại trạng thái; READY thì đã hoàn tất bước chuẩn bị; đã vận hành thì không sửa qua Flow 03 |

Không đề xuất nút thao tác giả cho các khả năng chưa có:

- Tạo chuyến độc lập, xóa/đảo thứ tự chặng đã lưu.
- Mở lại kế hoạch APPROVED hoặc trả lại kế hoạch ở trạng thái này.
- Mặc định bổ sung file/thay giấy phép khi hồ sơ cơ quan đã APPROVED.
- Tự sửa requirements_snapshot hoặc tạo bù checklist còn thiếu.
- Xác nhận nhân sự rảnh lịch, khóa chỉnh sửa đồng thời, đọc lịch sử audit khi chưa có API.
- Tự đánh dấu hồ sơ hết hạn qua GET readiness hoặc tự hạ đơn READY khi dữ liệu mất hiệu lực.

Các trường hợp này hiển thị nguyên nhân và phạm vi hỗ trợ hiện tại, không đưa CTA “Sửa ngay” dẫn tới thao tác không thể hoàn thành.

## 12. Chia phần triển khai và cách bắt đầu

**Bắt đầu từ Phần 1 dưới đây.** Các mục 1–11 là tài liệu tra cứu về thiết kế và nghiệp vụ; mục 12 là danh sách công việc thực hiện theo thứ tự. Mỗi phần tạo ra một kết quả riêng để chạy thử, kiểm tra và ghi nhận trước khi tiếp tục.

Không cần tạo sẵn toàn bộ file ở mục 6. Chỉ tạo những file cần cho phần đang làm. Mỗi phần gồm UI, dữ liệu và xử lý lỗi cần thiết để kiểm tra được một chức năng hoàn chỉnh; tránh làm toàn bộ component trước rồi mới nối API.

### Phần 1 — Khung Flow 03 và điều hướng responsive

**Đọc trước:** mục 3, 6 và 7. Đây là phần nên giao triển khai đầu tiên.

**Việc cần làm:**

- Tạo thư mục `modules/trips` cùng ba page tối thiểu và CSS có phạm vi riêng.
- Tách DashboardShell để dùng lại sidebar/topbar; giữ các workspace Flow 01/02 hoạt động.
- Thêm routes danh sách, chi tiết, lập kế hoạch; guard MANAGER/COORDINATOR; nối sidebar và link cũ `?view=trips`.
- Xây bố cục tự co giãn theo mục 3.1; nội dung page lúc này chỉ cần tiêu đề và trạng thái chờ triển khai, chưa có thao tác ghi API.

**Kết quả bàn giao:** mở được ba màn trong khung dashboard, refresh/deep link được và layout tự thích ứng kích thước cửa sổ.

**Kiểm tra để hoàn tất:**

- [x] Sidebar tới đúng trang, Back hoạt động, URL trực tiếp không gây 404 của router.
- [x] Role không được phép không vào được các page trips; chưa đăng nhập về login.
- [x] Flow 01/02 và tài khoản/đăng xuất vẫn hoạt động sau khi tách shell.
- [x] Không tràn ngang ở các mốc mục 3.1; mobile mở/đóng menu được.
- [x] Kiểm tra TypeScript/build đạt.

**Kết quả ngày 19/10/2026:** đã triển khai khung và kiểm tra trình duyệt với API giả lập; TypeScript/build đạt. Flow 01/02 đã kiểm tra giao diện và cảnh báo chưa lưu, chưa kiểm tra thao tác nghiệp vụ với backend thật. Xem [biên bản kiểm tra Phần 1](flow03-phan1-nghiem-thu.md) để biết phạm vi và giới hạn kiểm tra.

### Phần 2 — Danh sách chuyến với dữ liệu thật

**Phụ thuộc:** Phần 1. **Đọc:** mục 4.1, 8, 9.

**Việc cần làm:** tạo TripSummary/TripList types, getTrips, query key và useTripsQuery; làm TripList và TripListControls; đồng bộ page/limit trên URL; thêm loading/error/empty và link chi tiết.

**Kết quả bàn giao:** Manager và Coordinator xem được danh sách từ API.

**Kiểm tra để hoàn tất:**

- [x] Manager thấy phạm vi toàn bộ, Coordinator thấy chuyến của mình theo dữ liệu backend.
- [x] Phân trang và total đúng; chỉ gửi page/limit; không có nút tạo chuyến.
- [x] Lỗi tải có thử lại, danh sách rỗng có giải thích; card mobile và bảng desktop đọc được.
- [x] Đi tới chi tiết rồi quay lại giữ page/limit.

**Kết quả ngày 19/10/2026:** đã nối API danh sách thật, hoàn tất phân trang và trạng thái giao diện. TypeScript/build và kiểm tra UI đạt; phạm vi Manager/Coordinator và phân trang được xác minh riêng qua API với MySQL thử nghiệm. Xem [biên bản Phần 2](flow03-phan2-nghiem-thu.md).

### Phần 3 — Chi tiết chuyến chỉ đọc

**Phụ thuộc:** Phần 2. **Đọc:** mục 4.2, 5 và 10.2.

**Việc cần làm:** thêm getTripDetail/useTripDetailQuery; hiển thị tóm tắt, badge, lý do trả lại, timeline chặng và điều hướng tab. Chỉ tab Kế hoạch có dữ liệu nghiệp vụ ở phần này; các tab còn lại ghi rõ chưa triển khai.

**Kết quả bàn giao:** mở một chuyến và đọc đúng trạng thái, người lập, thông tin duyệt và các chặng.

**Kiểm tra để hoàn tất:**

- [x] Phân biệt planStatus và orderStatus; DRAFT có returnReason hiện “Cần chỉnh sửa”.
- [x] Chuyến chưa có chặng có empty state; ID/tên/thời gian hiển thị theo dữ liệu thực tế.
- [x] Xử lý ID không hợp lệ, 403/404 và lỗi mạng; không hiển thị dữ liệu chuyến trước khi đổi ID.
- [x] Tab hợp lệ được giữ khi refresh; nội dung dài không làm vỡ layout.

**Kết quả ngày 19/10/2026:** đã rà soát và hoàn thiện Phần 3; TypeScript/build, kiểm tra UI chi tiết và hồi quy danh sách đạt. Kiểm tra trình duyệt dùng API fixtures, chưa kiểm tra end-to-end với tài khoản nghiệp vụ thật. Xem [biên bản Phần 3](flow03-phan3-nghiem-thu.md).

### Phần 4 — Lập kế hoạch và lưu nháp

**Phụ thuộc:** Phần 3. **Đọc:** mục 4.3, 8 và 10.1.

**Việc cần làm:** thêm plan-options, schema, mapping DTO/form/payload và thời gian; làm form chặng bằng RHF; lưu bằng PUT plan; xử lý dirty, xác nhận rời trang và lỗi trường. Phần này chỉ bật “Lưu nháp”; gửi duyệt làm ở Phần 5.

**Kết quả bàn giao:** Coordinator lập/sửa kế hoạch DRAFT, lưu và mở lại thấy đúng dữ liệu.

**Kiểm tra để hoàn tất:**

- [ ] Giữ ID/thứ tự chặng cũ; chỉ thêm cuối; không xóa chặng đã lưu hoặc gửi thừa trường.
- [ ] Kiểm tra nối tuyến, thời gian, 1–50 chặng; giờ đến bằng giờ đi được lưu nháp.
- [ ] Giờ nhập chuyển đúng UTC, kể cả khi trình duyệt ở múi giờ khác và thời gian qua ngày.
- [ ] Response lưu cập nhật ID chặng mới; lỗi giữ dữ liệu nhập; 409 không ghi đè form dirty.
- [ ] Manager không sửa được; dữ liệu không reset khi resize hoặc refetch.

### Phần 5 — Gửi duyệt, duyệt và trả lại

**Phụ thuộc:** Phần 4. **Đọc:** mục 4.3–4.4, 5 và 9.

**Việc cần làm:** thêm submit/review mutations; “Lưu và gửi duyệt”; dialog Manager duyệt/trả lại; đồng bộ detail, danh sách và thông báo sau thành công.

**Kết quả bàn giao:** chạy được vòng DRAFT → PENDING_APPROVAL → APPROVED hoặc trả về DRAFT để sửa/gửi lại.

**Kiểm tra để hoàn tất:**

- [ ] Gửi duyệt yêu cầu giờ đến sau giờ đi; request submit là `{}`.
- [ ] Lưu thành công/submit thất bại được thông báo riêng và giữ ID chặng đã lưu.
- [ ] Chờ duyệt khóa sửa kế hoạch; đúng role mới thấy hành động tương ứng.
- [ ] Trả lại bắt buộc lý do 1–255 ký tự; không nhầm RETURNED là planStatus.
- [ ] Xử lý lỗi xe/trạng thái từ backend; pending ngăn gửi lặp; không có mở lại kế hoạch APPROVED.

### Phần 6 — Phân công nhân sự

**Phụ thuộc:** Phần 3; đề xuất làm sau Phần 5 để dễ kiểm tra toàn bộ hành trình. **Đọc:** mục 4.5 và 8–10.

**Việc cần làm:** tải assignments/options; form thêm/xóa/đổi vai trò; validation; dialog so sánh danh sách trước/sau; PUT danh sách đầy đủ; hiển thị crewReadiness.

**Kết quả bàn giao:** Coordinator lưu được nhân sự; Manager xem được kết quả và các vấn đề nhân sự.

**Kiểm tra để hoàn tất:**

- [ ] 2–100 người, không trùng userId, ít nhất một DRIVER và ESCORT khác người.
- [ ] Người bị gỡ xuất hiện trong xác nhận; payload là danh sách đầy đủ.
- [ ] Nhân sự mất điều kiện vẫn hiện với cảnh báo; options rỗng có hướng dẫn.
- [ ] Cho phân công ở cả ba planStatus khi đơn/trạng thái vận hành cho phép.
- [ ] Không coi crewReadiness là readiness tổng thể hoặc xác nhận lịch nhân sự rảnh.

### Phần 7 — Kiểm tra điều kiện và xác nhận READY

**Phụ thuộc:** Phần 5 và 6. **Đọc:** mục 4.6, 8–11.

**Việc cần làm:** readiness query, nhóm blocker, hướng xử lý theo quyền, nút kiểm tra lại và dialog mark-ready. Bổ sung chọn đơn theo URL cho workspace hồ sơ nếu triển khai link trực tiếp; kiểm tra lại Flow 02 sau thay đổi này.

**Kết quả bàn giao:** người dùng hiểu vấn đề còn thiếu; Manager xác nhận READY khi backend cho phép.

**Kiểm tra để hoàn tất:**

- [ ] Phân biệt chưa kiểm tra/loading/lỗi/kết quả; 200 có blockers là kết quả hợp lệ.
- [ ] Manager POST mark-ready bằng orderId; Coordinator không có nút xác nhận.
- [ ] 409 thay danh sách blockers cũ; kết quả cũ không tiếp tục bật nút xác nhận.
- [ ] Đơn READY hiện đã hoàn tất chuẩn bị, không báo lỗi vì không thể chuyển READY lần hai.
- [ ] Blocker không có API xử lý không dẫn tới nút thao tác giả; link hồ sơ tôn trọng quyền.

### Phần 8 — Kiểm tra toàn luồng và hoàn thiện

**Phụ thuộc:** Phần 1–7. **Đọc:** mục 13.

**Việc cần làm:** chạy các kịch bản xuyên suốt; rà responsive, accessibility, lỗi và ảnh hưởng tới Flow 01/02; sửa những vấn đề còn tồn tại.

**Kết quả bàn giao:** Flow 03 sẵn sàng nghiệm thu với danh sách phần đã đạt và hạn chế còn lại.

**Kiểm tra để hoàn tất:**

- [ ] Luồng bình thường: lập → lưu → gửi → duyệt → phân công → kiểm tra → READY.
- [ ] Luồng trả lại: gửi → trả lại → sửa → gửi lại → duyệt.
- [ ] Luồng thiếu điều kiện: blockers → xử lý trong phạm vi API hỗ trợ → kiểm tra lại; mark-ready 409 được xử lý đúng.
- [ ] Tài khoản sai quyền, dữ liệu rỗng, lỗi mạng, dữ liệu thay đổi ở phiên khác và form chưa lưu được xử lý rõ ràng.
- [ ] Kiểm tra các mốc responsive, resize liên tục, xoay thiết bị, zoom 200%, bàn phím và modal.
- [ ] TypeScript/build và kiểm thử nghiệp vụ cần thiết đạt; Flow 01/02 không bị hỏng.

### Cách giao việc và theo dõi từng phần

Mỗi lần triển khai chỉ cần yêu cầu: **“Triển khai Phần 1 trong tài liệu đề xuất Flow 03, hoàn thành checklist và báo kết quả.”** Sau khi kiểm tra phần đó, tiếp tục Phần 2 và các phần còn lại. Không cần phê duyệt lại từng file trong cùng một phần đã được giao.

Mỗi phần kết thúc với báo cáo ngắn gồm: đã làm gì, file chính thay đổi, cách mở màn hình để kiểm tra, kiểm tra đã chạy/kết quả, lỗi hoặc điều kiện chưa kiểm tra được. Chỉ đánh dấu hoàn tất khi có kết quả kiểm tra; nếu thiếu dữ liệu/tài khoản kiểm thử thì ghi rõ “chưa kiểm tra”, không tự coi là đạt.

| Phần | Trạng thái ban đầu | Kết quả cần thấy |
|---|---|---|
| 1. Khung và điều hướng | Đã triển khai; kiểm tra UI với API giả lập đạt | Ba page mở được, layout co giãn |
| 2. Danh sách | Đã triển khai; UI và API được kiểm tra riêng | Dữ liệu thật và phân trang |
| 3. Chi tiết | Đã triển khai; checklist và kiểm tra UI đạt | Kế hoạch và trạng thái đúng |
| 4. Lưu nháp | Chưa triển khai | Lưu/mở lại kế hoạch đúng |
| 5. Duyệt kế hoạch | Chưa triển khai | Vòng gửi/duyệt/trả lại chạy được |
| 6. Nhân sự | Chưa triển khai | Lưu và kiểm tra phân công |
| 7. READY | Chưa triển khai | Blockers và xác nhận READY đúng |
| 8. Nghiệm thu | Chưa triển khai | Các kịch bản toàn luồng đạt |

Phạm vi giao diện đầu tiên hoàn thành được bằng API hiện có. Search/filter phía server, lịch sử audit và điều chỉnh kế hoạch sau duyệt được đưa vào đề xuất mở rộng riêng.

## 13. Tiêu chí nghiệm thu

- Coordinator chỉ thấy chuyến được giao; Manager xem được toàn bộ; URL trực tiếp vẫn chịu guard và quyền backend.
- Danh sách phân trang đúng total, không gửi query chưa hỗ trợ.
- Không có nút tạo chuyến và không nhầm orderId với tripId khi mark-ready.
- Lưu nhiều lần giữ đầy đủ ID/thứ tự chặng; không gửi trường chỉ phục vụ hiển thị.
- Lưu nháp chấp nhận thời lượng bằng 0; gửi duyệt chặn; kiểm tra thời gian qua ngày và trên trình duyệt có timezone khác.
- Lưu thành công rồi submit thất bại giữ đúng dữ liệu và ID chặng đã lưu.
- Manager trả lại cần lý do; UI hiện DRAFT và lý do; gửi lại xóa lý do theo response.
- Phân công không trùng người; thao tác gỡ được xác nhận; API nhận danh sách đầy đủ; Manager không có nút lưu.
- Readiness 200 có blocker hiển thị đúng; mark-ready 409 cập nhật vấn đề mới; READY không bị báo thất bại vì không thể chuyển lần nữa.
- Trạng thái APPROVED nhưng tài nguyên/hồ sơ lỗi không dẫn tới nút mở lại không có API.
- Form dirty không bị refetch ghi đè; pending ngăn gửi lặp; lỗi trường có focus phù hợp.
- Các màn hoạt động ở desktop và mobile, điều khiển được bằng bàn phím.
- Khi triển khai, kiểm tra TypeScript/build và các kiểm thử có ý nghĩa cho payload, chuyển múi giờ, quyền/trạng thái, chuỗi lưu–gửi, thay thế phân công và cập nhật blockers.

**Phương án khuyến nghị:** module `trips` với ba page (danh sách, chi tiết, lập kế hoạch), ba tab chi tiết (kế hoạch, nhân sự, READY), giữ kiến trúc phân lớp bạn đề xuất và tái sử dụng giao diện dashboard hiện tại.
