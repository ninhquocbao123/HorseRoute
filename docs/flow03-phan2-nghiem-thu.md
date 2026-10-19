# Flow 03 — Kết quả triển khai Phần 2

Ngày: 19/10/2026.

## Chức năng đã triển khai

- `getTrips` gọi GET `/trips` qua Axios dùng chung (base URL từ VITE_API_URL), gửi đúng hai tham số `page`, `limit` và Bearer token hiện có.
- Types TripSummary, TripListParams, TripListResponse; query key có accountId; React Query hủy request cũ qua AbortSignal và không tự retry lỗi 4xx.
- Component TripListControls quản lý hiển thị phân trang, số dòng và làm mới; callback do page/hook cung cấp. TripList hiển thị bảng trên vùng nội dung rộng và card khi hẹp; TripStatusBadge dùng nhãn trạng thái tập trung.
- Dữ liệu chỉ lấy từ response API. Frontend không tự lọc theo Coordinator, không gọi detail/readiness từng dòng và không tạo số liệu ngoài TripSummary.
- `page`/`limit` đồng bộ URL; mặc định 1/20; sửa tham số âm, không phải số, vượt giới hạn hoặc offset không an toàn. Chỉ gửi các tham số được backend hỗ trợ.
- Giới hạn số dòng từ 1 đến 100, dropdown mặc định 10/20/50/100; vẫn hiển thị chính xác giới hạn khác nếu URL hợp lệ. Đổi số dòng trở về trang 1.
- Trang vượt tổng số trang được chuyển về trang cuối bằng replace; khi tổng về 0 thì trở về trang 1.
- Loading skeleton; lỗi tải có thử lại; nếu làm mới thất bại thì giữ dữ liệu cũ kèm thông báo rõ ràng. Empty state có nội dung riêng cho Manager/Coordinator.
- ID giữ nguyên string, gồm BIGINT lớn. Thời gian hiển thị theo Asia/Ho_Chi_Minh (UTC+07:00), ngày chưa có kế hoạch hiển thị rõ.
- Mở chi tiết mang theo page/limit trên URL; link về danh sách, browser Back và refresh tại chi tiết giữ phân trang. Link sang khu vực kế hoạch cũng giữ các tham số này.
- Không có thao tác tạo/sửa chuyến trong Phần 2. Chi tiết và lập kế hoạch vẫn là khung của Phần 1.

## File chính

Tất cả đường dẫn dưới đây tính từ `apps/web/src/modules/trips/`:

- `api/trips.api.ts`, `types/trip.types.ts`.
- `constants/trip-query-keys.ts`, `constants/trip-status.constants.ts`.
- `hooks/use-trips-query.ts`, `hooks/use-trip-list-navigation.ts`.
- `components/TripList.tsx`, `components/TripListControls.tsx`, `components/TripStatusBadge.tsx`.
- `pages/TripListPage.tsx`; cập nhật link trong TripDetailPage và TripPlanPage.
- `utils/trip-list.utils.ts`, `styles/trips.css`.

## Cách kiểm tra thủ công

1. Chạy API theo cấu hình dự án và frontend `pnpm --filter web dev`; kiểm tra VITE_API_URL trỏ đúng `/api/v1`.
2. Đăng nhập Manager, mở `/dashboard/trips?page=1&limit=20`.
3. Đối chiếu danh sách, total, trạng thái và thời gian với response GET trips. Đổi trang, số dòng và làm mới.
4. Chọn một chuyến ở trang 2; refresh chi tiết rồi bấm “Danh sách chuyến”, kiểm tra vẫn page=2 và limit cũ. Thử browser Back.
5. Đăng nhập Coordinator, xác nhận backend chỉ trả chuyến được giao và total tương ứng.
6. Thử viewport hẹp, danh sách rỗng, ngắt kết nối API rồi thử lại.

## Kiểm tra đã thực hiện

| Kiểm tra | Kết quả |
|---|---|
| `pnpm --filter web lint` | Đạt |
| `pnpm --filter web build` | Đạt |
| `git diff --check` | Đạt |
| Trình duyệt: loading, phân trang 41 bản ghi, total, thay limit | Đạt |
| Trình duyệt: ID BIGINT nguyên vẹn; hiển thị giờ UTC+07:00 | Đạt |
| Trình duyệt: chi tiết → refresh → link về danh sách; browser Back | Đạt — giữ page/limit |
| Trình duyệt: lỗi 503 khi làm mới, dữ liệu cũ có nhãn, thử lại | Đạt |
| Trình duyệt: lỗi 403 ban đầu không tự retry; thử lại khôi phục danh sách | Đạt |
| Trình duyệt: page/limit sai, tham số thừa/trùng, trang vượt total | Đạt |
| Trình duyệt: Manager/Coordinator rỗng và giới hạn hợp lệ tùy ý (7) | Đạt |
| Trình duyệt: chỉ request GET trips với page/limit, không gọi detail/readiness mỗi dòng | Đạt |
| Trình duyệt: 320, 375, 768, 1024, 1440, 1920px | Đạt — không cuộn ngang toàn trang |
| Kiểm tra ảnh desktop 1440px/mobile 375px | Đạt — bảng/card và nút đọc được |
| API + MySQL thật: phạm vi Manager/Coordinator, total, phân trang | Đạt trên database thử nghiệm riêng qua bộ test có sẵn |
| Toàn bộ `flow3-read.mysql.cjs` | 60 kiểm tra đạt, exit code 0; database thử nghiệm đã được dọn dẹp |

Script UI: `apps/web/test/trips-list.browser.mjs`. Script dùng API fixtures để kiểm tra ổn định các trạng thái lỗi và dữ liệu biên; không gửi request sang backend thật. Cần Playwright/Chromium có sẵn; có thể cung cấp đường dẫn runtime qua PLAYWRIGHT_MODULE và BROWSER_EXECUTABLE. TRIPS_TEST_URL mặc định `http://127.0.0.1:5178`.

```bash
# Terminal 1 — frontend phục vụ kiểm thử
VITE_API_URL=/api/v1 pnpm --filter web dev --host 127.0.0.1 --port 5178

# Terminal 2 — khi Playwright đã được cài và resolve được
node apps/web/test/trips-list.browser.mjs

# API integration dùng schema thử nghiệm ngẫu nhiên, tự dọn dẹp
node apps/api/test/flow3-read.mysql.cjs
```

## Giới hạn kiểm tra

Đã kiểm tra UI với fixtures và API với MySQL thật bằng hai lượt kiểm tra riêng. Chưa chạy một phiên trình duyệt xuyên suốt bằng tài khoản thật trên database nghiệp vụ đang sử dụng. Mã ứng dụng gọi API thật, không có fallback dữ liệu giả. Không thay đổi backend hoặc dữ liệu nghiệp vụ để bổ sung tính năng này.

Tiếp theo: **Phần 3 — Chi tiết chuyến chỉ đọc**.
