# 08 — Plan mở rộng mobile cho Manager, Specialist, Coordinator và Admin

Ngày 05/11/2026. Trạng thái: chờ duyệt, chưa sửa code.

## 1. Mục tiêu

Tài khoản Manager, Specialist, Coordinator và Admin đăng nhập được vào app và làm được những việc họ đang làm trên web, dùng API hiện có. Customer, tài xế và hộ tống giữ nguyên.

Việc này mở rộng phạm vi của [00-context.md](00-context.md) mục 3 (đang ghi admin, manager, specialist, coordinator là ngoài phạm vi), nên cần cập nhật file đó khi plan được duyệt.

## 2. Hiện trạng

- **App đích:** `apps/mobile` (Expo SDK 58, sửa gần nhất 05/11). `RouteHorse_mobile` (SDK 54) không có thay đổi từ 02/11 và chưa được commit. [06-ui.md](06-ui.md) vẫn ghi màn hình được code trong `RouteHorse_mobile`, cần sửa lại.
- **Cổng chặn:** `apps/mobile/src/App.tsx:934` đưa bốn role này tới màn "Tài khoản này sử dụng website".
- **Không thể chỉ mở cổng:** `App.tsx:574` chia role thành `customer` và "còn lại". Nếu mở cổng, nhân viên sẽ rơi vào nhánh tổ vận chuyển và gọi `/tracking/driver/trips`, route chỉ cho `DRIVER_ESCORT`.
- **Thiếu trong app:** socket realtime (app làm mới mỗi 30 giây), xem PDF hoặc tệp có xác thực, chọn tệp, xuất và chia sẻ tệp, bản đồ tương tác (`RouteMap` hiện là sơ đồ SVG chỉ đọc).
- **Backend:** các route cho bốn role đã đủ cho tính năng ở mục 3, không cần sửa theo quy ước ở 00-context mục 6.

## 3. Tính năng web cần có trên mobile

Danh sách này lấy từ những màn người dùng thực sự mở được trên web, không phải từ mọi file có trong code.

### Manager (`features/manager/ManagerWorkspace.tsx`)

| Khu vực | Tính năng | API chính |
| --- | --- | --- |
| Tiếp nhận đơn | 8 giai đoạn, tìm kiếm, lọc loại đơn, sắp xếp | `GET /manager/intake` |
| Chi tiết đơn | Thông tin đơn, khách, ngựa; chọn điều phối viên và tiếp nhận; xem giấy tờ | `GET /orders/:id`, `GET /manager/orders/:id/context`, `GET /orders/:id/review-options`, `POST /orders/:id/review`, `/documents/orders/*` |
| Kế hoạch chuyến | Xem tuyến, xe, tổ; kiểm tra điều kiện; duyệt, trả lại, bắt đầu vận chuyển | `GET /trips/:id`, `/readiness`, `/assignments`, `POST /review-plan`, `POST /start-transport` |
| Duyệt giá | Hàng chờ, lập dự toán, điều chỉnh, VAT, duyệt hoặc yêu cầu sửa, lịch sử báo giá và thu tiền | `/manager/quote-orders`, `/manager/orders/:id/quotes`, `/manager/quotes/:id/review`, `POST /pricing/estimate` |
| Doanh thu | Theo tháng/năm, số liệu, biểu đồ, cơ cấu, tuyến cao nhất, bảng đơn, xuất CSV | `GET /manager/revenue` |
| Bảng giá | Danh sách phiên bản, sửa nháp, áp dụng theo ngày hiệu lực | `/manager/pricing`, `POST /:id/publish` |
| Chung | Thông báo, tài khoản, cập nhật thanh toán realtime | `/notifications`, socket `payment:updated`, `order:status_updated` |

### Specialist (`features/specialist/SpecialistWorkspace.tsx`)

| Khu vực | Tính năng | API chính |
| --- | --- | --- |
| Chờ tiếp nhận | Danh sách, tìm kiếm, lọc loại chuyến, sắp xếp theo hạn, xem nhanh, tiếp nhận | `GET /specialist/orders`, `POST /:id/accept` |
| Thẩm định | Thông tin đơn, liên hệ, hồ sơ và ảnh từng ngựa | `GET /specialist/orders/:id`, `/photos/:fileId` |
| Giấy tờ | Xem tệp; hợp lệ kèm ngày hết hạn; không hợp lệ; yêu cầu bổ sung | `/documents/orders/:id/files/:fileId`, `/items/:id/review`, `/items/:id/request` |
| Kết luận | Duyệt, cần bổ sung, từ chối, kèm nhận xét và `revision` | `POST /specialist/orders/:id/conclude` |
| Hồ sơ cơ quan | Theo dõi và cập nhật trạng thái, tải tệp lên | `POST /documents/orders/:id/dossiers/:id` |

### Coordinator (`modules/coordinator/`)

| Khu vực | Tính năng | API chính |
| --- | --- | --- |
| Tổng quan | Lối tắt và chuyến gần đây | `GET /trips` |
| Danh sách chuyến | Lọc theo trạng thái, tìm kiếm | `GET /trips` |
| Lập kế hoạch | Chọn xe, chọn nhân sự, lịch khởi hành và giao, kiểm tra hợp lệ, gửi duyệt | `/trips/:id/plan-options`, `/assignment-options`, `PUT /assignments`, `PUT /plan`, `POST /submit-plan` |
| Lộ trình | Tìm địa chỉ, chạm bản đồ để đặt điểm, kéo hoặc sắp xếp điểm, xem các tuyến, lưu | `GET /maps/search`, `POST /route-preview`, `PUT /route-plan` |
| Sự cố | Đang mở và đã xử lý, chi tiết, lịch sử, gửi hướng xử lý kèm thời gian chờ, báo xong, chuông realtime | `GET /tracking/incidents`, `PATCH /tracking/incidents/:id`, socket `tracking:incident_reported`, `notification:new` |
| Chung | Thông báo, tài khoản | `/notifications`, `/users/me` |

### Admin (`features/auth/pages/components/DashboardLayout.tsx`)

Web chỉ có tổng quan, thông báo và tài khoản (`workspaces.ADMIN.areas` rỗng). Mobile chỉ cần thông báo và tài khoản.

### Có code nhưng web không có lối vào

| Tính năng | Vì sao không mở được |
| --- | --- |
| `FleetWorkspace` (quản lý xe) | Coordinator bị chuyển sang `/coordinator`, và route `fleet` chuyển về danh sách chuyến |
| `LocationsWorkspace` (địa điểm, cửa khẩu) | Specialist dùng `SpecialistWorkspace`, không qua `DashboardLayout` |
| `OperationsWorkspace` (tiến độ, hiệu chỉnh mốc, cảnh báo, nhật ký ngựa) | Chỉ gắn trong `DashboardLayout`, mà layout này giờ chỉ phục vụ Admin |
| `POST /manager/quotes/:id/receipts` (quản lý ghi thu tiền) | Web không có giao diện gọi route này |

Plan không làm các mục này trừ khi có quyết định khác (mục 8, câu 1).

## 4. Điều hướng và danh sách màn

Header của các role có chuông thông báo khi tab bar không có tab Thông báo.

| Role | Tab |
| --- | --- |
| Manager | Đơn · Báo giá · Doanh thu · Bảng giá · Tài khoản |
| Specialist | Chờ nhận · Thẩm định · Thông báo · Tài khoản |
| Coordinator | Chuyến · Sự cố · Thông báo · Tài khoản |
| Admin | Thông báo · Tài khoản |

| Mã | Màn | Ghi chú |
| --- | --- | --- |
| MGR-01 | Danh sách đơn | Chip giai đoạn và danh sách thay cho bảng kanban |
| MGR-02 | Chi tiết đơn | 3 đoạn: Thông tin, Lộ trình, Thẩm định |
| MGR-03 | Sheet tiếp nhận | Chọn điều phối viên, ghi chú |
| MGR-04 | Giấy tờ của đơn | Chỉ đọc |
| MGR-05 | Sheet trả lại kế hoạch | Bắt buộc nhập lý do |
| MGR-06 | Hàng chờ báo giá | |
| MGR-07 | Bảng tính giá | Hạng mục, tổng, lịch sử, thu tiền |
| MGR-08 | Lập dự toán | Thiết lập chuyến, điều chỉnh, VAT; tính lại khi đổi giá trị |
| MGR-09 | Doanh thu | Số liệu, biểu đồ, danh sách, xuất CSV |
| MGR-10 | Phiên bản bảng giá | |
| MGR-11 | Sửa bảng giá | Kèm sheet áp dụng |
| SPC-01 | Hồ sơ chờ nhận | Kèm sheet xem nhanh |
| SPC-02 | Hồ sơ đã nhận | Tiến độ, trạng thái |
| SPC-03 | Hồ sơ thẩm định | Chọn ngựa, thông tin, ảnh |
| SPC-04 | Checklist giấy tờ | Kèm sheet duyệt hoặc yêu cầu bổ sung |
| SPC-05 | Kết luận | Xác nhận trước khi gửi |
| SPC-06 | Hồ sơ cơ quan | Đổi trạng thái, tải tệp |
| CRD-01 | Danh sách chuyến | Đầu màn hiện lối tắt và số liệu của trang Tổng quan web |
| CRD-02 | Chuyến | Bốn phần, mỗi phần có trạng thái xong/thiếu, cuối màn là Gửi duyệt |
| CRD-03 | Chọn xe | |
| CRD-04 | Chọn nhân sự | Dùng lại quy tắc của `allocate-crew` |
| CRD-05 | Lịch | Giờ Việt Nam |
| CRD-06 | Lộ trình | Bản đồ, tìm kiếm, danh sách điểm, chọn tuyến |
| CRD-07 | Danh sách sự cố | Đang mở, Đã xử lý |
| CRD-08 | Chi tiết sự cố | Lịch sử, gửi hướng xử lý, báo xong |
| COM-10 | Xem tệp | PDF và ảnh, dùng cho Manager và Specialist |

Tổng cộng 26 màn mới; Admin dùng lại màn có sẵn.

Quy tắc thiết kế: theo 00-context mục 5 và [05-design-system.md](05-design-system.md). Nhân viên văn phòng dùng vùng chạm 44pt, không dùng mật độ 56pt của tổ vận chuyển. Bảng trên web chuyển thành danh sách, modal thành bottom sheet, master-detail thành hai màn nối tiếp. Theo [changelog.md](changelog.md), app là nguồn đúng nên không vẽ thêm HTML prototype; duyệt giao diện trên máy ảo.

## 5. Quyết định kỹ thuật

| Vấn đề | Quyết định | Lý do |
| --- | --- | --- |
| Điều hướng | Tách `Authenticated` thành một navigator cho mỗi nhóm role, khai báo tab và màn trong `navigation/`; giữ cơ chế stack `pages` hiện có | `App.tsx` đã hơn 1.000 dòng, thêm 4 role vào cùng file sẽ khó kiểm soát. Không thêm thư viện điều hướng |
| Vị trí code | `screens/manager/`, `screens/specialist/`, `screens/coordinator/`, dùng chung `ui.tsx`, `live-ui.tsx`, `overlay.tsx` | Mỗi role một thư mục, giao diện dùng chung một nơi |
| Realtime | Thêm `socket.io-client`, tự xác thực bằng token và kết nối lại, giữ làm mới 30 giây làm dự phòng | Coordinator cần biết sự cố ngay; đúng tên sự kiện đang dùng trên web |
| Xem tệp | Tải tệp có header xác thực bằng `expo-file-system` vào cache, xem bằng `react-native-webview`, chia sẻ bằng `expo-sharing`; xóa cache khi đăng xuất | Giấy tờ có dữ liệu cá nhân, API trả tệp theo quyền |
| Tải tệp lên | `expo-document-picker` | Hồ sơ cơ quan cần nhận PDF, không chỉ ảnh |
| Bản đồ lộ trình | Leaflet với nền OpenStreetMap trong WebView, trao đổi với app qua `postMessage` | Giống hệt web, chạy được trên Expo Go, không cần thêm token Mapbox ở máy người dùng |
| Tính dự toán | Gọi `POST /pricing/estimate` có debounce | Cùng công thức với web, không cần đưa `@my-project/shared` vào Metro. Dự toán luôn lấy bảng giá hiện hành, giống web |
| Đăng xuất và phiên | Dùng lại `session.tsx`; thêm ngắt socket | Đăng nhập đã dùng chung `/auth/login` |
| Offline | Nhân viên chỉ xem dữ liệu đã lưu, thao tác ghi bị khóa kèm lý do; không dùng hàng chờ `queue.ts` | Duyệt giá hoặc kết luận thẩm định cần dữ liệu mới nhất |
| Sửa đồng thời | Khi API từ chối vì `revision` cũ, báo rõ và tải lại, không ghi đè | Báo giá, thẩm định, kế hoạch đều có revision |
| Push | Làm sau | Chưa có FCM ở backend và app; thông báo trong app vẫn đủ khi app đang mở |

Thư viện mới cài bằng `npx expo install` để đúng phiên bản SDK 58, và phải kiểm tra lại trên Expo Go trước khi dùng.

## 6. Các giai đoạn

Thời lượng là ước lượng thô cho một người làm toàn thời gian.

### P0. Chốt phạm vi (0,5 ngày)

- Trả lời các câu ở mục 8.
- Cập nhật 00-context mục 3 và câu về `RouteHorse_mobile` trong 06-ui.

### P1. Nền tảng và Admin (3–4 ngày)

- Tách navigator, mở cổng theo role, sửa `titles`, `selfScrolling` và tải dữ liệu theo role.
- Mở thông báo đúng màn theo từng role (đơn, hồ sơ thẩm định, sự cố).
- Socket client, COM-10, chọn tệp, xuất tệp.
- Thành phần dùng chung: dòng danh sách có trạng thái, thanh chip lọc có đếm, ô tìm kiếm, thanh hành động đáy, sheet nhập lý do, ô nhập tiền.
- Admin hoàn thành ở đây.
- **Xong khi:** cả 6 role đăng nhập đúng bộ tab; customer và tổ vận chuyển không đổi hành vi; `npm run typecheck` và `npm test` đạt.

### P2. Specialist (3–4 ngày)

- SPC-01 đến SPC-06.
- Làm trước vì luồng độc lập và kiểm chứng được COM-10 cho Manager.
- **Xong khi:** đi hết một hồ sơ từ tiếp nhận tới cả ba loại kết luận, gồm yêu cầu bổ sung và thẩm định lại.

### P3. Manager (6–8 ngày)

- Lần lượt: đơn và tiếp nhận (MGR-01–04) → báo giá (MGR-06–08) → duyệt kế hoạch và bắt đầu vận chuyển (MGR-05) → doanh thu (MGR-09) → bảng giá (MGR-10–11).
- **Xong khi:** số liệu dự toán và doanh thu khớp với web trên cùng dữ liệu; thanh toán realtime cập nhật báo giá đang mở.

### P4. Coordinator (7–9 ngày)

- Lần lượt: sự cố (CRD-07–08) → danh sách và chuyến (CRD-01–02) → xe, nhân sự, lịch (CRD-03–05) → lộ trình (CRD-06).
- Sự cố làm trước vì đây là việc cần trên điện thoại nhất. Lộ trình làm cuối vì rủi ro nhất.
- `CoordinatorTripPage.tsx` dài 1.345 dòng; cần đọc kỹ để giữ đủ các quy tắc kiểm tra xe và tổ trước khi chuyển sang mobile.
- **Xong khi:** lập và gửi duyệt được một kế hoạch chỉ bằng điện thoại; sự cố mới hiện trong vòng vài giây khi app đang mở.

### P5. Kiểm thử liên role (3 ngày)

- Đi trọn luồng: khách gửi đơn → Manager tiếp nhận → Specialist thẩm định → Manager báo giá → khách đặt cọc → Coordinator lập kế hoạch → Manager duyệt và bắt đầu → tài xế chạy → sự cố → Coordinator xử lý.
- Kiểm tra sáng/tối, cỡ chữ lớn, mất mạng, phiên hết hạn, dữ liệu dài, TalkBack.
- Đối chiếu bảng ở mục 3 từng dòng và ghi kết quả vào file này.

**Tổng ước lượng: 23–29 ngày.** P2, P3 và P4 có thể làm song song sau P1 nếu có nhiều người, vì mỗi role một thư mục.

## 7. Rủi ro

| Rủi ro | Cách xử lý |
| --- | --- |
| `.env` gốc trỏ tới MySQL dùng chung của nhóm; P2–P5 ghi nhiều dữ liệu | Chạy trên MySQL local; chỉ dùng DB chung khi được đồng ý |
| Kéo thả điểm trên bản đồ trong WebView khó dùng trên màn nhỏ | Có thêm nút lên/xuống trong danh sách điểm |
| Màn lớn trên web (dự toán, kế hoạch chuyến) chật trên điện thoại | Chia thành các phần hoặc màn nối tiếp, không rút bớt trường |
| Bảng doanh thu và danh sách đơn dài | Dùng `FlatList`; API hiện trả toàn bộ, nên cần đo trên dữ liệu thật |
| `apps/mobile` đang có nhiều thay đổi chưa commit | Commit hoặc tách nhánh trước khi bắt đầu P1 |
| Tệp nhạy cảm còn trong cache | Không lưu lâu dài; xóa khi đăng xuất |

## 8. Câu hỏi cần quyết

1. **Bốn tính năng ở cuối mục 3 có làm không?** Đề xuất: không. Yêu cầu là ngang bằng web, mà người dùng web hiện không mở được chúng. Nếu cần quản lý xe, địa điểm hoặc màn vận hành, nên mở lại trên web trước. Nếu làm cả ba màn trên mobile, cộng thêm khoảng 5–7 ngày.
2. **"Các actor còn lại" có gồm Admin không?** Đề xuất: có. Chi phí gần như bằng 0 vì chỉ dùng màn có sẵn.
3. **Coordinator có cần lập lộ trình trên bản đồ ngay trên điện thoại không?** Đề xuất: có, đúng với yêu cầu đầy đủ như web. Nếu bỏ, tiết kiệm khoảng 3 ngày và tài khoản vẫn phải dùng web để lập tuyến.
4. **App đích có đúng là `apps/mobile` không?** Đề xuất: đúng, và ngừng dùng `RouteHorse_mobile`.
