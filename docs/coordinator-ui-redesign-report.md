# Báo cáo bàn giao thiết kế lại giao diện Coordinator

Ngày kiểm tra: 28/10/2026 (Asia/Ho_Chi_Minh)

## A. Kết quả thực hiện

Giao diện Coordinator hiện có workspace riêng tại `/coordinator`, route danh sách `/coordinator/trips` và màn lập kế hoạch `/coordinator/trips/:tripId` (route `/plan` tương thích cùng màn hình). Màn lập kế hoạch dùng dữ liệu API thật, giữ kế hoạch nhiều chặng, phân công nhiều nhân sự, lưu nháp và gửi duyệt tuần tự.

Các phần đã triển khai/hoàn thiện:

- Khung Coordinator có sidebar thu gọn, Drawer mobile, header, tài khoản thật, đăng xuất và menu theo vai trò.
- Workspace hai cột trên desktop, xếp một cột dưới 1024 px, card thông tin chuyến bên phải và thanh thao tác sticky.
- Mỗi chặng giữ địa điểm đi/đến, xe, giờ khởi hành, giờ đến và ID nếu đã lưu. Chỉ chặng mới được xóa; chặng mới chỉ nối ở cuối.
- Bản đồ Leaflet/OpenStreetMap và tuyến OSRM được ghi rõ là bản xem trước. Kéo/chọn tọa độ không thay đổi địa điểm lưu bằng API. Khi chỉ đọc, thao tác kéo/chọn bị khóa.
- Modal xe và nhân sự có tìm kiếm, lựa chọn nháp, Hủy/Xác nhận, phân trang 12 mục, trạng thái rỗng và lựa chọn rõ ràng. Modal nhân sự chỉ xác nhận khi có ít nhất một DRIVER và một ESCORT khác người, vẫn cho phép nhiều người ở mỗi vai trò.
- Card thông tin chuyến chỉ hiển thị dữ liệu thật đang có: mã đơn, trạng thái kế hoạch/đơn, lịch đầu-cuối, số chặng và địa điểm. Không dựng tên người gửi/nhận hoặc yêu cầu giả.
- Bổ sung kiểm tra chuyển đổi giờ Việt Nam ↔ UTC và giữ retry/lỗi/rỗng cho dịch vụ bản đồ.

Mức đáp ứng: các mục frontend được hợp đồng API hiện tại hỗ trợ đã hoàn thành. Chưa có API lưu hình tuyến/tọa độ preview, trạm nghỉ riêng, thông tin người gửi/nhận/yêu cầu trên trip detail, trạng thái rảnh theo lịch, hoặc từ chối đơn dành cho Coordinator; UI không mô phỏng các khả năng này.

## B. Danh sách file

Repository có thay đổi chưa commit từ trước khi đợt kiểm tra này bắt đầu. Bảng dưới mô tả các file thuộc kết quả Coordinator hiện có trong workspace; không khẳng định toàn bộ file đều được tạo mới trong riêng phiên làm việc này.

| Đường dẫn | Trạng thái workspace | Mục đích |
| --- | --- | --- |
| `apps/web/src/app/router/CoordinatorRoute.tsx` | Tạo mới | Guard đăng nhập và vai trò Coordinator |
| `apps/web/src/app/router/index.tsx` | Chỉnh sửa | Khai báo workspace và route Coordinator |
| `apps/web/src/app/router/TripsRoute.tsx` | Chỉnh sửa | Chuyển lối vào cũ của Coordinator sang workspace mới |
| `apps/web/src/modules/coordinator/layouts/CoordinatorLayout.tsx` | Tạo mới | Sidebar, header, Drawer, tài khoản, đăng xuất, dirty warning |
| `apps/web/src/modules/coordinator/pages/CoordinatorTripPage.tsx` | Tạo mới/hoàn thiện | Điều phối dữ liệu, nhiều chặng, lịch, xe, nhân sự, lưu/gửi, modal và card chuyến |
| `apps/web/src/modules/coordinator/pages/CoordinatorTripsPage.tsx` | Tạo mới | Danh sách chuyến thật và lối vào chi tiết |
| `apps/web/src/modules/coordinator/pages/CoordinatorOverviewPage.tsx` | Tạo mới | Trang tổng quan Coordinator |
| `apps/web/src/modules/coordinator/pages/CoordinatorAccountPage.tsx` | Tạo mới | Thông tin tài khoản thật |
| `apps/web/src/modules/coordinator/pages/CoordinatorNotificationsPage.tsx` | Tạo mới | Trung tâm thông báo trong khung mới |
| `apps/web/src/modules/coordinator/maps/TripRoutePlanner.tsx` | Tạo mới/hoàn thiện | Tạo waypoint từ chặng, tính tuyến tham khảo, khóa preview khi chỉ đọc, retry lỗi |
| `apps/web/src/modules/coordinator/maps/RouteMap.tsx` | Tạo mới | Bản đồ, marker, polyline, resize và lỗi tile |
| `apps/web/src/modules/coordinator/maps/map.service.ts` | Tạo mới | Gọi OSRM và kiểm tra phản hồi/tọa độ |
| `apps/web/src/modules/coordinator/maps/map.service.test.mjs` | Tạo mới | Test tọa độ, invalidation key và dữ liệu OSRM |
| `apps/web/src/modules/coordinator/styles/coordinator.css` | Tạo mới | Token và khung Coordinator được scope |
| `apps/web/src/modules/coordinator/styles/reference.css` | Tạo mới/hoàn thiện | Bố cục/card/responsive/trip facts theo thiết kế tham khảo |
| `apps/web/src/modules/coordinator/styles/assignment-picker.css` | Tạo mới | Modal resource và responsive mobile |
| `apps/web/src/modules/coordinator/theme/coordinator.theme.ts` | Tạo mới | Theme Ant Design Coordinator |
| `apps/web/src/modules/trips/api/trips.api.ts` | Chỉnh sửa | API plan options, assignments, lưu và gửi duyệt |
| `apps/web/src/modules/trips/utils/trip-time.utils.test.mjs` | Tạo mới | Test giờ Việt Nam và UTC `Z` độc lập timezone OS |
| `apps/web/package.json`, `pnpm-lock.yaml` | Chỉnh sửa | Dependency bản đồ/UI đã dùng bởi module |

Các file Coordinator phụ trợ (paths, trang placeholder/operations, summary và error mapper) nằm cùng module nhưng không thay đổi hợp đồng backend.

## C. So sánh với tài liệu tham khảo

| Hạng mục | Đã áp dụng | Khác biệt còn lại | Lý do |
| --- | --- | --- | --- |
| Màu/card/spacing | Token `#0f4d55`, `#f4faf9`, card trắng, viền `#d4e4e4`, radius và typography | Một số component dùng style Ant Design hiện hữu | Giữ bộ component dự án, tránh dependency mới |
| Layout | Sidebar/header, desktop hai cột, right card, action bar sticky | Right card không có dữ liệu người gửi/nhận | API trip detail không trả dữ liệu đó |
| Responsive | Drawer dưới `lg`, grid một cột, modal full-height mobile, map 330 px mobile, không tràn ngang | Chưa có ảnh chụp viewport thực tế | Không có môi trường web/API demo khả dụng |
| Lộ trình | Danh mục địa điểm thật, nhiều chặng, map + OSRM | Không tìm địa chỉ tự do, không lưu đường/tọa độ kéo | Backend không có endpoint/payload tương ứng |
| Phương tiện | Chọn xe theo từng chặng, tìm biển số, phân trang | Không gắn nhãn “đang rảnh” | API chỉ trả `isActive`, không trả lịch rảnh |
| Nhân sự | Nhiều DRIVER/ESCORT, không trùng người, modal draft | Không có bộ lọc chuyên môn/lịch | API chỉ trả `id`, `fullName` |
| Lịch | Ngày giờ cho từng chặng, hiển thị UTC+7, gửi UTC `Z` | Không có trạm nghỉ độc lập | API plan không có trường trạm nghỉ |
| Từ chối đơn | Nút vô hiệu có giải thích | Không thực hiện hành vi | Không có API Coordinator; không dùng nhầm API Manager |

## D. API và dữ liệu

| Endpoint | Nơi dùng |
| --- | --- |
| `GET /api/v1/trips` | `CoordinatorTripsPage`, `useTripsQuery` |
| `GET /api/v1/trips/:id` | `CoordinatorTripPage`, `useTripDetailQuery` |
| `GET /api/v1/trips/:id/plan-options` | `useTripPlanOptionsQuery` |
| `GET /api/v1/trips/:id/assignment-options` | `useTripAssignmentsQuery` |
| `GET /api/v1/trips/:id/assignments` | `useTripAssignmentsQuery` |
| `PUT /api/v1/trips/:id/plan` | `saveTripPlan` |
| `PUT /api/v1/trips/:id/assignments` | `saveTripAssignments` |
| `POST /api/v1/trips/:id/submit-plan` | `submitTripPlan` |

Luồng “Gửi duyệt”: kiểm tra form → lưu plan → nếu roster thay đổi thì lưu assignments → submit. Các bước có phụ thuộc chạy tuần tự. Nếu plan đã lưu nhưng bước sau lỗi, UI báo rõ “Kế hoạch đã lưu; bước tiếp theo chưa được xác nhận”, giữ trạng thái dirty phù hợp và refetch detail.

Map dùng tọa độ từ plan options để hiển thị. Tọa độ kéo/click và geometry OSRM chỉ ở state/query cache phía client, không nằm trong payload plan.

Không thay đổi backend, endpoint, schema database hay database. Không đọc/import dump SQL vì hợp đồng đã xác minh trực tiếp từ `apps/api/src/features/trips`.

## E. Quy tắc nghiệp vụ được giữ

- **Phân quyền:** `CoordinatorRoute` chỉ cho `COORDINATOR`; backend routes tiếp tục `authorize(Role.COORDINATOR)` cho mutation.
- **Trạng thái chỉnh sửa:** plan chỉ editable khi `DRAFT`, order `APPROVED/PREPARING`, và mọi chặng `NOT_STARTED`; assignment có điều kiện riêng. Backend vẫn là nguồn quyết định cuối cùng.
- **Lịch theo chặng:** mỗi phần tử giữ `plannedDepartureAt`/`plannedArrivalAt`; schema client kiểm tra nối địa điểm và thời gian giữa các chặng.
- **UTC/giờ Việt Nam:** `utcToInput` hiển thị `Asia/Ho_Chi_Minh`; `inputToUtc` tạo ISO UTC có `Z`. Test round-trip không phụ thuộc timezone hệ điều hành.
- **ID/thứ tự chặng:** chặng đã lưu luôn gửi `id`; UI không cho xóa chặng có ID và chỉ thêm chặng mới cuối danh sách. Backend đối chiếu toàn bộ ID/thứ tự trong `TripsService.savePlan`.
- **Nhân sự:** payload là mảng, hỗ trợ nhiều người; một `userId` chỉ có một vai trò; cần ít nhất một DRIVER và một ESCORT. Modal Hủy không ghi lựa chọn nháp.
- **Thành công một phần:** plan được đánh dấu sạch sau khi server xác nhận; lỗi assignment/submit sau đó được diễn đạt là lỗi bước tiếp theo, không phủ nhận plan đã lưu.
- **Thay đổi chưa lưu:** layout gắn `beforeunload`; các điều hướng do menu/nút của workspace gọi xác nhận trước khi rời trang.

## F. Kết quả kiểm tra

| Kiểm tra/lệnh | Kết quả | Bằng chứng/tóm tắt |
| --- | --- | --- |
| `pnpm --filter web lint` | PASS | `tsc --noEmit`, exit 0 |
| `pnpm --filter web build` | PASS | 3579 modules, Vite build hoàn tất 23.13 s |
| `node --test apps/web/src/modules/coordinator/maps/map.service.test.mjs apps/web/src/modules/trips/utils/trip-time.utils.test.mjs` | PASS | 2 test files, fail 0 |
| `node --test apps/api/test/trips.test.cjs` | PASS | Trip contract/service tests, fail 0 |
| Browser desktop 1440/1024 | NOT RUN | Không có `apps/api/.env.demo`; socket cục bộ bị sandbox từ chối |
| Browser tablet/mobile 768/390 | NOT RUN | Cùng giới hạn môi trường; không ghi PASS suy đoán từ CSS |
| E2E lưu nháp/reload/chỉ đọc/modal | NOT RUN | Không có API/DB demo cục bộ xác định an toàn; không dùng DB thật |
| Gửi duyệt | NOT RUN | Chủ động không gửi duyệt dữ liệu thật |

Build có cảnh báo chunk trên 500 kB từ các bundle hiện hữu (đặc biệt Mapbox/Home), không làm build thất bại. Coordinator trip được lazy-load riêng.

## G. Hình ảnh

Không tạo ảnh. Không có môi trường API demo/tài khoản kiểm thử đang chạy; việc dựng ảnh bằng mock sẽ trái yêu cầu dùng dữ liệu thật.

## H. Giới hạn và công việc tiếp theo

- Cần API mới nếu muốn lưu geometry/tọa độ preview, tìm địa chỉ, trạm nghỉ riêng, hoặc thao tác từ chối đơn của Coordinator.
- Cần mở rộng DTO trip detail nếu muốn hiện người gửi, người nhận, yêu cầu vận chuyển hoặc số ngựa trong right card.
- `plan-options` chỉ chứng minh xe active; lịch rảnh/xung đột vẫn do backend kiểm tra khi submit/review, UI không gắn nhãn rảnh giả.
- Cần chạy browser E2E trên DB demo cục bộ và chụp 1440/1024/768/390 trước khi nghiệm thu hình ảnh cuối.
- Workspace đã có thay đổi chưa commit ngoài module Coordinator và file `apps/web.zip`; chúng được giữ nguyên, không xóa hay hoàn nguyên.

## I. Hướng dẫn người dùng kiểm tra

1. Chuẩn bị DB demo riêng theo `docs/demo-local.md`; không trỏ `.env.demo` vào DB dùng chung.
2. Chạy `pnpm dev:api:demo` và `pnpm dev:web:demo`.
3. Mở `http://localhost:5180/staff/login`, đăng nhập tài khoản Coordinator demo.
4. Vào **Chuyến vận chuyển**, mở một trip DRAFT thuộc đúng Coordinator.
5. Kiểm tra từng chặng: điểm nối tiếp, xe, ngày/giờ; kéo marker và xác nhận cảnh báo “chỉ xem trước”.
6. Mở modal xe/nhân sự, đổi lựa chọn rồi Hủy; mở lại để kiểm tra dữ liệu cũ. Sau đó chọn đủ DRIVER/ESCORT và Xác nhận.
7. Lưu nháp, tải lại trang và đối chiếu ID/thứ tự/giờ/xe/roster.
8. Tạo thay đổi chưa lưu rồi dùng menu hoặc đóng tab để kiểm tra cảnh báo.
9. Mở trip không còn DRAFT hoặc có chặng đã chạy để kiểm tra chế độ chỉ đọc.
10. Dùng DevTools kiểm tra 1440, 1024, 768 và 390 px; xác nhận Drawer, modal, map và action bar không gây cuộn ngang/che nội dung.
11. Chỉ thử **Gửi duyệt** trên trip demo có thể reset; không gửi một chuyến thật để nghiệm thu UI.
