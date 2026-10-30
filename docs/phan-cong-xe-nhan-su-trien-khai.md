# Phân công xe và nhân sự: triển khai và áp dụng

## Thay đổi

- Giữ `trip_assignments.trip_vehicle_id`, payload `vehicles[].crew[]` và quyền sửa DRAFT hiện tại.
- Hai modal chọn độc lập, nhân sự có thể chọn trước xe; hủy bỏ bản chọn trong modal. Thay hoặc bỏ toàn bộ xe không mất người. Các nút lưu kế hoạch hiện có vẫn yêu cầu tuyến và ngày giờ.
- Hai bộ lọc mặc định tất cả trạng thái. Xe hiển thị chuyến đang giữ/sử dụng; thẻ người chỉ có tên, chuyên môn, trạng thái. Không còn lý do khóa hay thông tin đánh giá lịch nháp trên thẻ.
- `allocate-crew.ts` giữ tổ đã lưu trên xe không đổi, bổ sung tối thiểu trước người thứ hai và điều chuyển người thứ hai nếu cần. Không thêm/xóa người; báo thiếu/thừa theo số xe.
- API lưu khóa Order → Trip → Legs, sau đó tất cả xe (cũ + mới), users/crew_profiles (cũ + mới) theo ID tăng dần. Kiểm tra sở hữu sau khóa; lưu tổ, giữ mới, giải phóng phần bỏ và audit cùng transaction READ COMMITTED. Cạnh tranh tài nguyên không dựa vào giờ dự kiến.
- Lưu → RESERVED cho cả xe/người. READY giữ nguyên. DEPARTED → IN_TRANSIT/IN_TRIP. DELIVERED → AVAILABLE, giữ lịch sử. Trả kế hoạch không giải phóng. Hiệu chỉnh tracking không được lấy lại hoặc giải phóng tài nguyên của chuyến khác.
- Trạng thái xe thủ công bị chặn nếu trái với phân công. Hiện không có API thay đổi thủ công `crew_profiles.work_status` trong mã nguồn; mọi ghi mới ở luồng giữ tài nguyên chung. SQL trực tiếp vẫn cần kiểm soát quyền vận hành database.
- Lỗi lưu lịch sau khi phân công đã thành công được thông báo riêng; đây vẫn là hai API, không phải giao dịch chung.

## API

- `GET /trips/:id/plan-options`: `vehicles[].currentTrips: {tripId, orderCode}[]`; `selectable` là boolean, xét chủ sở hữu. Không còn `blockingReasons`/`scheduleEvaluation` trong tùy chọn.
- `GET /trips/:id/assignment-options`: `workStatus` hỗ trợ AVAILABLE / RESERVED / IN_TRIP; `selectable` là boolean. Không trả thông tin chuyến cho thẻ người.
- `GET/PUT /trips/:id/assignments`: giữ cấu trúc theo xe; thêm RESERVED vào kiểu trạng thái. PUT giữ tài nguyên kể cả DRAFT.
- OpenAPI cập nhật tại `apps/api/src/shared/config/openapi.trips.ts`.

## Migration và dữ liệu cũ

Migration `1800000091000-CrewReservations.ts` chỉ mở rộng ENUM, không sửa phân công hay tự chuẩn hóa dữ liệu. Down từ chối khi còn người RESERVED, tránh làm mất trạng thái giữ chỗ.

Trước khi áp dụng vào môi trường dùng chung, người vận hành cần sao lưu, rà soát các migration đang chờ và thực hiện trong cửa sổ bảo trì ngừng ghi phân công/tracking. Phiên làm việc này chỉ chạy migration trên MySQL thử nghiệm riêng, chưa migrate hoặc sửa dữ liệu dùng chung.

1. Trỏ cấu hình DB tới đúng môi trường, kiểm tra `pnpm --filter api typeorm migration:show`.
2. Chạy báo cáo chỉ đọc: `node apps/api/scripts/report-trip-resources.cjs > resource-report.json`. Script dùng transaction READ ONLY, không chuẩn hóa hoặc chọn chuyến thắng.
3. Giải quyết phân công trùng bằng quyết định nghiệp vụ trước khi bật ghi theo quy tắc mới. Không xóa lịch sử chuyến đã giao. Nếu chuyến đã khóa, việc sửa dữ liệu phải có phương án và phê duyệt riêng; không nới quyền API để sửa.
4. Chạy `pnpm migration:run` trên môi trường đã chọn và kiểm tra ENUM có RESERVED. Lệnh này chạy **tất cả** migration đang chờ, cần rà soát bước 1 trước.
5. Với tài nguyên chỉ còn một chuyến chưa hoàn thành: trạng thái kỳ vọng là RESERVED, hoặc IN_TRANSIT (xe)/IN_TRIP (người) nếu đơn IN_TRANSIT. Không còn chuyến hoạt động: AVAILABLE. Cần đối chiếu báo cáo mới trong cùng cửa sổ bảo trì, khóa xe rồi users/crew_profiles theo ID và ghi audit khi áp dụng cập nhật đã được phê duyệt.
6. Chạy lại báo cáo và kiểm thử lưu → READY → DEPARTED → DELIVERED. Chỉ đưa hệ thống vào ghi bình thường khi không còn xung đột/chênh lệch chưa giải thích được.

### Báo cáo thực tế lúc 12:35 ngày 30/10/2026 (Việt Nam)

Nguồn: `docs/artifacts/resource-reservations/existing-data-report.json`, truy vấn chỉ đọc database cấu hình hiện tại.

| Tài nguyên | Hiện tại | Chuyến liên quan | Xử lý đề xuất |
|---|---|---|---|
| Xe 1 | AVAILABLE | 25 READY, 29 PREPARING | Xung đột: cần người phụ trách quyết định chuyến giữ xe và bố trí xe thay thế cho chuyến còn lại |
| Xe 2 | AVAILABLE | 28 IN_TRANSIT | Đề xuất IN_TRANSIT sau khi xác minh thực tế |
| Người 22 | AVAILABLE | 28 IN_TRANSIT | Đề xuất IN_TRIP |
| Người 23 | AVAILABLE | 29 PREPARING | Đề xuất RESERVED |
| Người 27 | AVAILABLE | 25 READY | Đề xuất RESERVED |
| Người 1023 | AVAILABLE | 28 IN_TRANSIT, 29 PREPARING | Xung đột: cần xác nhận người đang làm chuyến nào và nhân sự thay thế; không tự ưu tiên chuyến đang chạy |
| Người 1027 | AVAILABLE | 25 READY | Đề xuất RESERVED |

Không có phân công nhân sự thiếu liên kết xe trong báo cáo. Chưa áp dụng bất kỳ đề xuất cập nhật nào vào dữ liệu dùng chung. Sau khi người phụ trách giải quyết hai xung đột, cần báo cáo lại; không dùng snapshot này làm lệnh cập nhật mù.

## Kiểm thử và cách chạy

- `pnpm build`: shared, API, frontend (bao gồm kiểm tra TypeScript).
- `pnpm --filter api test`: bộ kiểm thử API; các bài HTTP cần quyền mở cổng cục bộ.
- `node apps/web/test/allocate-crew.test.cjs`: định mức, giữ tổ, điều chuyển, thay xe, ổn định và không thay đổi đầu vào.
- `RESOURCE_TEST_MYSQL_SOCKET=/tmp/horseroute-acceptance-mysql-reservations/mysql.sock node apps/api/test/resource-reservations.mysql.cjs`: migration, own-resource, rollback sau lỗi ghi, giữ xe/người đồng thời, hai cuộc đua độc lập, duyệt/trả về/READY, milestone thật, lịch sử, hiệu chỉnh cũ, chặn trạng thái thủ công, bảo vệ down migration. Chỉ nhận socket riêng dưới `/tmp/horseroute-acceptance-mysql-*`; không đọc `.env`, tạo/drop schema thử ngẫu nhiên.
- Khởi động frontend kiểm thử: `VITE_API_URL=http://127.0.0.1:13478/api/v1 pnpm --filter web exec vite --host 127.0.0.1 --port 5178 --strictPort`.
- `ROUTE_TEST_MYSQL_SOCKET=/tmp/horseroute-acceptance-mysql-reservations/mysql.sock node apps/api/test/resource-reservations.browser.cjs`: trình duyệt thật + API thật + MySQL riêng. Dùng fixture tổng hợp, không gọi bản đồ thật. Kiểm tra chọn trước xe, hủy, thẻ bận, tự chọn lại tài nguyên của chuyến, thay/bỏ xe giữ người và thông báo lỗi lưu từng phần.

MySQL thử nghiệm cần được khởi tạo riêng (`--initialize-insecure`), chỉ mở Unix socket, `--skip-networking --mysqlx=OFF`; không dùng socket/database sản xuất. Đường dẫn Playwright/Chromium mặc định trong browser test phù hợp máy hiện tại, có thể đổi qua PLAYWRIGHT_MODULE và CHROMIUM_PATH.

## Kết quả xác minh ngày 30/10/2026

Build shared/API/web và TypeScript đều qua. Bộ API: **171/171** qua; bộ tự bố trí: **5/5** qua. Kiểm thử MySQL thực và trình duyệt thực đều qua các ca nêu trên. Chi tiết ở `docs/artifacts/resource-reservations/verification.txt`. Bài kiểm tra OpenAPI đã cập nhật số endpoint kỳ vọng từ 86 lên 93 cho các endpoint hiện có; thay đổi này không thêm endpoint.

Giới hạn: kiểm thử giao dịch và giao diện dùng dữ liệu tổng hợp trên MySQL riêng, chưa thử vận hành trên production. Không chạy lại toàn bộ các script MySQL legacy độc lập; bộ regression mới bao phủ vòng đời giữ tài nguyên hiện tại. Hai xung đột dữ liệu cũ và các trạng thái sai được báo cáo, **chưa sửa** vì cần quyết định nghiệp vụ và quyền áp dụng vào môi trường dùng chung. Không còn hạng mục mã nguồn đã yêu cầu bị bỏ lại; chưa triển khai/push/PR hoặc migrate môi trường dùng chung.
