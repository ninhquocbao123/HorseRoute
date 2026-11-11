# Đánh giá dự án HorseRoute dưới góc nhìn hội đồng chấm

Ngày rà soát: 10/11/2026. Bản được rà soát: nhánh `long`, commit `94e9733` (mới hơn `main` 9 commit). Người rà soát đóng vai giảng viên hội đồng, chuyên web và mobile.

## 1. Kết luận nhanh

Dự án có phần lõi nghiệp vụ tốt hơn mặt bằng đồ án: phân quyền kiểm tra ở máy chủ, giao dịch có khóa, audit log, kiểm tra file bằng chữ ký nội dung, hàng chờ offline trên mobile. Điểm yếu nằm ở những thứ hội đồng nhìn thấy ngay khi hỏi sâu: thanh toán vẫn do khách tự bấm xác nhận, CI đang đỏ, không dựng lại được cơ sở dữ liệu từ repo, thiếu các chức năng nền (quên mật khẩu, quản trị tài khoản, hủy đơn), và bản triển khai Docker có lỗi cấu hình.

Ước lượng theo thang 10, nếu bảo vệ với hiện trạng này:

| Tiêu chí | Điểm ước lượng | Lý do chính |
| --- | --- | --- |
| Độ đầy đủ chức năng theo luồng | 7,0 | Đã bấm tay trọn luồng trên web và mobile, chạy được; thiếu hủy đơn, hoàn tiền, quản trị, quên mật khẩu, từ chối đơn, màn quản lý xe |
| Chất lượng kỹ thuật backend | 7,5 | Phân quyền và giao dịch chắc; quản lý schema và code dồn dòng kéo điểm xuống |
| Web | 7,0 | Đủ 5 vai trò; gói JS lớn, test trình duyệt không chạy được |
| Mobile | 7,0 | Hàng chờ offline và GPS làm kỹ; chưa có push, chưa có bản build phát hành, chưa thử iOS |
| Kiểm thử và CI/CD | 5,5 | Unit test tốt; test tích hợp lỗi thời, CI đỏ, seed demo hỏng |
| Bảo mật | 6,5 | Nền tốt; lỗ hổng nghiệp vụ ở thanh toán, thiếu vòng đời phiên đăng nhập |
| Tài liệu và quy trình | 6,0 | Nhiều tài liệu kế hoạch; README sai, thiếu SRS, ERD, hướng dẫn triển khai |

Tổng thể khoảng 6,8 đến 7,2. Đây là ước lượng chủ quan theo khung chấm phổ biến, không phải khung chấm chính thức của trường. Sửa xong nhóm P0 ở mục 4 thì có thể lên khoảng 8.

## 2. Phạm vi và cách kiểm tra

Đã làm:

- Đọc mã nguồn lõi của API (app, middleware, auth, users, orders, payments, manager, customer, routes của mọi module, phần phân quyền và bản đồ của tracking), khung web (router, auth, axios, socket, dashboard theo vai trò, thanh toán) và khung mobile (session, http, cấu hình, danh sách màn, API đang gọi).
- Chạy cài đặt, build, typecheck, unit test, 16 bộ test tích hợp MySQL trên một MySQL Docker riêng (database tạm, tự xóa), và test của web.
- Rà cấu hình Docker, nginx, CI, lịch sử git, các file dữ liệu trong repo.

- Bấm tay toàn bộ luồng trên web và app Android (máy ảo `Pixel_9a`, Expo Go) trên một MySQL dùng một lần, không đụng DB chung Aiven. Chi tiết ở mục 3b, lỗi mới ở mục 4b.

Chưa làm, nên không kết luận:

- Không đọc từng dòng các file giao diện lớn (`CoordinatorTripPage.tsx`, `CustomerScreens.tsx`, `CrewWork.tsx`, phần lớn `tracking.service.ts`). Nhận xét về các file này dựa trên cấu trúc, test, các đoạn đã đọc và kết quả bấm tay.
- Không thử VNPay Sandbox thật vì cần khóa merchant.
- Không chạy trên iOS và máy Android thật. GPS nền không thử được vì Expo Go không hỗ trợ.
- Không chạy bản Docker compose production, nên các nhận định ở P1-5 vẫn là suy luận từ cấu hình.
- Chưa thử: đơn quốc tế, chuyến nhiều xe và nhiều chặng, luồng khách sửa đơn khi bị yêu cầu bổ sung (giao diện quản lý không tạo được trạng thái này, xem N1), cập nhật thời gian thực qua socket trên web, chế độ tối và cỡ chữ lớn.

## 3. Kết quả chạy kiểm thử

Chạy trên Windows 11, Node 24, pnpm 9.15, MySQL 8.0 trong Docker.

| Hạng mục | Kết quả | Ghi chú |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | Đạt | |
| `pnpm build` ở gốc | Báo thành công nhưng chỉ build `shared` | In ra "No projects matched the filters"; `api` và `web` không được build trên Windows |
| Build riêng `api` (tsc) | Đạt | |
| Build riêng `web` (tsc + vite) | Đạt, có cảnh báo gói lớn | `maplibre-gl` 1.054 KB, `index` 632 KB, `HomePage` 542 KB (trước nén gzip) |
| Typecheck mobile | Đạt | |
| Unit test API (`node --test`) | 190/190 đạt | |
| Test mobile | 68/68 đạt | Chỉ test hàm thuần, không test giao diện |
| Test web không cần trình duyệt | 7/7 file đạt | `trip-phase`, `route-progress`, `map-view-plan`, `map-labels`, `roles.render`, `allocate-crew`, `driver-map-theme` |
| Test trình duyệt web (Playwright, API giả) | 0/5 file đã thử đạt | `public-pages`, `flow1`, `customer`, `manager`, `payments` đều timeout vì không thấy phần tử. Không phải do môi trường: Playwright với Edge chạy tốt trên web thật (mục 3b). Các test tìm nút và tiêu đề của giao diện cũ, ví dụ "Xin chào, Khách kiểm tra." không còn trong code. Chưa chạy hết 33 file |
| Test tích hợp MySQL | 7/16 file đạt | Chi tiết bảng dưới |
| Seed demo `seed-flow4-demo.cjs` | Lỗi | `Unknown column 'plate_or_code'`. Chạy trên commit `a6bd015`; trên `long` file vẫn còn dùng cột này, chưa chạy lại |

Test tích hợp MySQL, từng file:

| File | Kết quả | Nguyên nhân khi lỗi |
| --- | --- | --- |
| `flow2`, `customer`, `manager`, `payments`, `pricing`, `specialist`, `vnpay` | Đạt | |
| `flow3-read` (CI có chạy) | Lỗi sau 8 ca đạt | `Unknown column 'is_active'`: test còn theo schema xe cũ |
| `flow4-tracking` (CI có chạy) | Lỗi sau 10 ca đạt | Sai lệch kết quả mong đợi ở một ca; file dừng ở ca lỗi đầu tiên nên chưa biết các ca sau |
| `flow1` | Lỗi sau 7 ca đạt | "Chưa cấu hình đủ 3 giấy tờ ngựa bắt buộc": dữ liệu mẫu của test thiếu danh mục giấy tờ |
| `locations`, `vehicles` | Lỗi | `Unknown column 'plate_or_code'` |
| `coordinator-resources` | Lỗi sau 1 ca đạt | Sai lệch nghiệp vụ: ca "self resource is eligible but draft schedule is not evaluated" mong `null`, nhận `false`. Cần xem là test cũ hay code sai |
| `resource-reservations`, `route-acceptance` | Không chạy được trên Windows | Test đòi đường dẫn socket `/tmp/...`, chỉ chạy trên Linux. Không tính là lỗi của code |
| `trip-fleet` | Không chạy được | Test nối tới MySQL ở cổng 33379 cố định, không dùng cấu hình chung. Không tính là lỗi của code |

Trong 9 file lỗi: 4 file lỗi vì test và dữ liệu mẫu lệch với schema hiện tại (`flow3-read`, `flow1`, `locations`, `vehicles`), 2 file lệch kết quả mong đợi chưa rõ do test hay do code (`flow4-tracking`, `coordinator-resources`), 3 file do môi trường. Các file dừng ở ca lỗi đầu tiên nên chưa biết kết quả các ca phía sau.

## 3b. Kết quả bấm tay trên web và mobile

Cách dựng: MySQL và Redis Docker dùng một lần, schema từ `test/fixtures/schema.sql` cộng 28 migration, API cổng 3100, web cổng 5190, Metro cổng 8090. Dữ liệu tài khoản nhân sự, xe và địa điểm chèn bằng SQL vì hệ thống không có màn tạo (P1-2, N2). Không sửa script seed của repo.

Giới hạn: một số ô nhập được điền bằng script trong trình duyệt để đi nhanh; các nút, hộp thoại và luồng đều chạy qua giao diện thật. File giấy tờ của khách tải qua đúng API của form bằng ảnh giả. Chuyến thứ hai `VCN-TEST-OFFLINE` được chèn thẳng ở trạng thái READY để thử offline.

### Luồng chính, một đơn từ đầu đến cuối (`VCN-20261110-0001`, TP.HCM đi Đà Nẵng, 838 km)

| # | Vai trò | Thao tác | Nền tảng | Kết quả |
| --- | --- | --- | --- | --- |
| 1 | Khách | Đăng ký, báo lỗi khi mật khẩu không khớp và chưa đồng ý điều khoản | Web | Đạt |
| 2 | Khách | Tạo hồ sơ ngựa, giấy tờ | Web | Đạt |
| 3 | Khách | Đặt chuyến 4 bước, tính quãng đường, dự toán 33.481.460 đ | Web | Đạt, đã đối chiếu công thức bảng giá |
| 4 | Nhân sự | Đăng nhập sai báo lỗi, đăng nhập đúng | Web | Đạt |
| 5 | Quản lý | Tiếp nhận đơn, chọn điều phối | Web | Đạt, nhưng không có nút từ chối (N1) |
| 6 | Chuyên viên | Nhận hồ sơ, duyệt 3 giấy tờ, kết luận | Web | Đạt |
| 7 | Quản lý | Lập và duyệt báo giá | Web | Đạt |
| 8 | Khách | Xem báo giá, đặt cọc mô phỏng: thất bại, thử lại, thành công | Web | Đạt, có lỗi hiển thị 0% (N3) |
| 9 | Điều phối | Tìm địa chỉ, tính 2 tuyến, chọn xe và tổ lái, gửi duyệt | Web | Đạt, tìm địa chỉ kém (N8) |
| 10 | Quản lý | Duyệt kế hoạch, chuyển chuyến cho tài xế | Web | Đạt |
| 11 | Tài xế | Thấy chuyến, checklist 5 mục, bắt đầu chuyến | Mobile | Đạt, xuất phát sớm 10 ngày không cảnh báo (N5) |
| 12 | Tài xế | Bản đồ MapLibre, xe, tuyến, tốc độ, GPS (12 điểm vào DB) | Mobile | Đạt, có số liệu vô lý (N6) |
| 13 | Tài xế | Ghi đã đến khi khách còn nợ: hiện "Chờ khách thanh toán", bị chặn giao | Mobile | Đạt |
| 14 | Hộ tống | Ghi uống nước 12 L | Mobile | Đạt, có trong DB |
| 15 | Hộ tống | Báo cáo sức khỏe: bắt buộc ảnh, chụp ảnh, gửi khách | Mobile | Đạt |
| 16 | Khách | Hành trình, nhật ký chăm sóc, báo cáo, thông báo | Mobile | Đạt |
| 17 | Khách | Trả nốt 23.437.022 đ mô phỏng | Mobile | Đạt, có dòng hiển thị sai (N4) |
| 18 | Tài xế | Xác nhận giao ngựa, tự tắt GPS, đơn `DELIVERED` | Mobile | Đạt |

### Luồng phụ

| Thao tác | Kết quả |
| --- | --- |
| Mất mạng: ghi mốc, hiện "1 mục chờ gửi", DB chưa đổi; có mạng lại tự gửi sau khoảng 24 giây | Đạt |
| Tài xế báo sự cố có ảnh trên mobile; điều phối thấy trên web, xem được ảnh, gửi hướng xử lý, đóng sự cố | Đạt; ảnh có 2 trên 4 lần chụp không gắn vào form (N11) |
| Validation form sự cố và báo cáo: thiếu ảnh, thiếu mức độ | Đạt |
| Đơn chưa đặt cọc đồng nào, tài xế vẫn xuất phát được (dữ liệu chèn ở READY) | Xác nhận P1-4 ở bước xuất phát |
| Quét mọi mục menu 7 vai trò, 1280 px và 375 px, bắt lỗi console và API | Không có lỗi JS, không có API 4xx/5xx; có 1 màn tràn ngang (N7). Chưa quét được menu của điều phối và Admin ở 375 px vì script không bấm trúng, nên hai khu vực này chưa kết luận ở cỡ điện thoại |

### Dò phân quyền và bảo mật trên API thử

| Kiểm tra | Kết quả |
| --- | --- |
| Khách khác xem đơn, báo giá, thanh toán, timeline, bản đồ, giấy tờ | 403/404, đúng |
| Tài xế khác xem chuyến, gửi GPS | 404, đúng |
| Khách gọi API quản lý, danh sách user; điều phối xem doanh thu; chuyên viên xem bảng giá | 403, đúng |
| API danh sách user có lộ `passwordHash` | Không |
| Đăng nhập chuỗi SQL injection, id quá dài, JSON hỏng | 400, đúng |
| Token cũ sau khi đổi mật khẩu | Vẫn dùng được (200), xác nhận P1-1 |
| Thử sai mật khẩu liên tục | Không khóa tài khoản; chỉ dừng ở giới hạn chung theo IP (429 sau 62 lần, cộng với các gọi trước đó trong cùng phút), xác nhận P1-1 |

### Kiểm thử API theo đúng payload mobile

`apps/mobile/scripts/e2e-api.mts` chạy trên DB thử: **46/46 đạt**. Script này phủ thêm các ca mà bấm tay chưa đi hết, gồm ngoại lệ giao ngựa, chống gửi trùng và chặn chéo tài khoản.

## 4. Thiếu sót, xếp theo mức độ

Mỗi mục ghi: hiện trạng, bằng chứng, hậu quả, hướng sửa. "Đã xác minh" nghĩa là đọc thấy trong code hoặc chạy ra kết quả; "suy luận" nghĩa là rút ra từ cấu hình, chưa chạy thử.

### P0. Phải sửa trước khi bảo vệ

**P0-1. Khách hàng tự xác nhận đã trả tiền.** Đã xác minh.

- `POST /payments/sessions/:code/complete` nhận `result: "SUCCESS"` từ chính khách hàng rồi ghi biên nhận thật vào `order_receipts`, chuyển đơn sang `PREPARING`, và mở khóa bước giao ngựa. Xem `apps/api/src/features/payments/payments.routes.ts` dòng 16 và `payments.service.ts` hàm `settle`.
- Không có biến môi trường nào để tắt đường này ở production. Web gọi nó trong `PaymentSimulationModal.tsx`, mobile gọi trong `CustomerScreens.tsx`.
- Quy tắc "chưa trả đủ thì chưa giao được ngựa" (mã 402) vì thế bị lách hoàn toàn. Nhóm đã ghi nhận điều này ở `docs/mobile-design/13-tien-do-tong-hop.md`, nhưng hội đồng vẫn sẽ tính là thiếu.
- VNPay Sandbox đã có code ký, kiểm chữ ký và IPN (`vnpay.ts`, test `vnpay.mysql.cjs` qua), nhưng chưa có bằng chứng chạy với tài khoản merchant thật. Luồng này chỉ ghi nhận tiền qua IPN, mà IPN cần API có địa chỉ công khai; chạy trên localhost thì trang kết quả đứng mãi ở "Đang chờ VNPAY xác nhận".
- Hướng sửa: thêm cờ `PAYMENT_SIMULATION_ENABLED`, mặc định tắt khi `NODE_ENV=production`, trả 404 cho đường `complete` khi tắt. Trước ngày demo, lấy khóa sandbox, triển khai API lên một địa chỉ HTTPS, chạy trọn một giao dịch và quay video dự phòng.

**P0-2. CI đỏ và bộ test tích hợp lỗi thời.** Đã xác minh bằng cách chạy.

- CI chạy `flow3-read.mysql.cjs` và `flow4-tracking.mysql.cjs`. Kết quả chạy trên máy ở bảng mục 3.
- Nguyên nhân chính: schema xe đổi từ `plate_or_code`, `is_active` sang `license_plate`, `status`, và API phân công đổi sang theo từng xe, nhưng test và script seed chưa đổi theo.
- `apps/api/scripts/seed-flow4-demo.cjs` hỏng cùng lý do, nên môi trường demo cục bộ trong `docs/demo-local.md` không dựng được.
- Hậu quả: không còn lưới an toàn cho luồng 3 và 4, là hai luồng phức tạp nhất. Hội đồng mở tab Actions trên GitHub sẽ thấy dấu đỏ.
- Hướng sửa: viết lại `trips-*-checks.cjs` theo API mới, sửa 5 ca của flow4, sửa seed. Không gỡ bước test khỏi CI để lấy dấu xanh.

**P0-3. Không dựng lại được cơ sở dữ liệu từ repo.** Đã xác minh.

- Migration `1700000000000-Init.ts` không tạo bảng nào. Schema gốc `wdp_schema_v2.sql` mà `database/README.md` nhắc tới không có trong repo. README gốc lại hướng dẫn `pnpm migration:run` trên DB trống.
- Có 5 cặp migration trùng timestamp (`1800000007000`, `...8000`, `...9000`, `...10000`, `...13000`), thứ tự chạy phụ thuộc tên file.
- Song song với migration còn có các script `apps/api/scripts/apply-*-migration.cjs`. Hai cơ chế cùng thay đổi schema.
- Theo ghi chú của nhóm, chạy migration ở chế độ transaction mặc định lỗi ở migration thứ 16, phải dùng `-t none`.
- Hậu quả: người chấm clone repo về không chạy được. Đây là câu hỏi rất hay gặp: "Em dựng hệ thống từ đầu cho thầy xem".
- Hướng sửa: xuất schema hiện tại thành một migration gốc duy nhất (baseline), đổi tên các migration trùng, bỏ các script `apply-*`, thêm một lệnh `pnpm db:setup` tạo DB và nạp dữ liệu mẫu, rồi cho CI chạy đúng lệnh đó.

### P1. Mức cao

**P1-1. Vòng đời tài khoản và phiên đăng nhập còn thiếu.** Đã xác minh.

- Nút "Quên mật khẩu?" trên trang đăng nhập chỉ hiện dòng "Hệ thống chưa hỗ trợ đặt lại mật khẩu tự động". Không có API quên mật khẩu, không xác minh email, không có refresh token, không có đăng xuất phía máy chủ. Module auth chỉ có `login` và `register`.
- JWT sống 7 ngày (`jwt.util.ts`), web lưu ở `localStorage`. Đổi mật khẩu không làm token cũ hết hiệu lực.
- Đường `/auth/login` không có giới hạn riêng, chỉ có giới hạn chung 100 yêu cầu mỗi phút theo IP, nên dò mật khẩu được khoảng 100 lần mỗi phút cho mỗi IP. Không có khóa tạm tài khoản sau nhiều lần sai.
- Chính sách mật khẩu chỉ yêu cầu 8 ký tự.
- Hướng sửa: thêm giới hạn riêng cho login theo email và IP; thêm cột `token_version` vào `users` và kiểm tra khi xác thực để thu hồi token khi đổi mật khẩu hoặc khóa tài khoản; rút token xuống 15 đến 60 phút kèm refresh token; làm quên mật khẩu qua email.

**P1-2. Không có chức năng quản trị.** Đã xác minh.

- Vai trò `ADMIN` chỉ có một API `GET /users`. Giao diện Admin trên web là một khung trống (`role-workspaces.ts`, `areas: []`).
- Không có cách tạo tài khoản nhân sự (quản lý, điều phối, chuyên viên, tài xế, hộ tống), khóa hay mở khóa, đặt lại mật khẩu, đổi vai trò. Tài khoản nhân sự hiện chỉ tạo được bằng SQL.
- Hướng sửa: màn quản lý người dùng tối thiểu gồm danh sách, tạo, khóa, đặt lại mật khẩu, gán loại tổ lái.

**P1-3. Không hủy được đơn, không có hoàn tiền.** Đã xác minh.

- Trạng thái `CANCELLED` có trong enum và trong các câu lọc, nhưng không có API nào đặt trạng thái này. Khách chỉ xóa được đơn nháp.
- Không có quy tắc hoàn cọc, không có chứng từ hoàn tiền.
- Hướng sửa: API hủy đơn theo trạng thái (trước duyệt: khách tự hủy; sau đặt cọc: quản lý duyệt hủy), giải phóng xe và tổ lái đã giữ, ghi chứng từ hoàn tiền âm.

**P1-4. Đặt cọc không phải điều kiện để chạy chuyến.** Đã xác minh.

- Đơn sang `PREPARING` theo hai đường: khách đặt cọc đủ, hoặc điều phối gửi kế hoạch (`trips.repository.ts`, câu `UPDATE orders SET status='PREPARING' ... status='APPROVED'`). Đường thứ hai không kiểm tra tiền.
- Bước kiểm tra sẵn sàng và bước quản lý chuyển chuyến cho tài xế không đọc `order_receipts`. Chỉ đến mốc giao ngựa mới chặn bằng 402.
- Hậu quả: công ty có thể chở ngựa hàng nghìn km rồi mới phát hiện khách chưa trả đồng nào. Báo giá ghi "đặt cọc x%" nhưng hệ thống không ép.
- Ghi biên nhận thủ công của quản lý (`manager.service.ts`, hàm `receipt`) cũng không gửi thông báo, không phát socket, không đổi trạng thái như thanh toán trực tuyến.
- Hướng sửa: thêm điều kiện "đã đủ cọc" vào danh sách chặn của `readiness`, và cho biên nhận thủ công đi chung một hàm ghi nhận với thanh toán trực tuyến.

**P1-5. Bản triển khai Docker có ba lỗi cấu hình.** Đã xác minh trong file; hậu quả là suy luận, chưa chạy thử compose.

- `docker/nginx/default.conf` chỉ chuyển tiếp `/api/`. Không có khối cho `/socket.io/` với header `Upgrade`, trong khi web nối socket về cùng gốc với API. Thông báo thời gian thực sẽ không hoạt động khi chạy bằng compose.
- API không đặt `trust proxy`. Sau nginx, mọi người dùng mang cùng một IP, nên chia nhau hạn mức 100 yêu cầu mỗi phút. Vài người dùng cùng lúc là đủ nhận lỗi 429.
- Dịch vụ `api` trong `docker-compose.yml` không gắn volume cho thư mục `var/private-documents`. Tạo lại container là mất hết giấy tờ và ảnh đã tải lên khi dùng kho `local`.
- Thêm: Redis là bắt buộc để API khởi động (`index.ts`, bước `redis`) nhưng không có dòng code nào dùng Redis. Bộ giới hạn tần suất vẫn lưu trong bộ nhớ tiến trình.
- Hướng sửa: thêm khối `location /socket.io/`, đặt `app.set('trust proxy', 1)`, thêm volume, và hoặc dùng Redis làm kho cho rate limit hoặc bỏ hẳn Redis.

**P1-6. Kênh thông báo mới có trong ứng dụng.** Đã xác minh.

- Mọi thông báo ghi với `channel='IN_APP'`. Không gửi email, không SMS, không push.
- Mobile chưa có FCM (README của mobile ghi rõ) và không nối socket, chỉ hỏi lại định kỳ. Tài xế khóa màn hình sẽ không biết có cảnh báo từ điều phối; khách không biết xe đã tới nếu không mở app.
- Hướng sửa: tối thiểu thêm push qua Expo Notifications cho ba sự kiện: cảnh báo của điều phối, báo cáo sức khỏe ngựa, xe tới nơi chờ thanh toán.

**P1-7. Khách hàng không thấy vị trí GPS thật.** Đã xác minh.

- `getCustomerOrderMap` luôn trả `latestPosition: null` và đặt xe ở điểm xuất phát của chặng đang chạy (`source: 'ESTIMATED'`). Khách chỉ thấy tiến độ theo mốc.
- Tài liệu phạm vi (`docs/mobile-design/00-context.md`) ghi khách "theo dõi vị trí". Nếu đây là quyết định có chủ đích (bảo mật lộ trình), cần ghi rõ trong tài liệu và nói trước với hội đồng, vì "theo dõi hành trình" là điểm bán hàng chính của sản phẩm.

### P2. Mức trung bình

**P2-1. Mã nguồn khó bảo trì.**

- Nhiều file viết dồn dòng như mã đã nén: `manager.service.ts` 90 dòng nhưng 15 KB, `VnpayCheckout.tsx`, `customer.service.ts`, `auth.service.ts`. Một dòng chứa cả truy vấn SQL, kiểm tra nghiệp vụ và trả kết quả.
- Mobile đưa cả thư viện MapLibre (khoảng 1 MB) vào git dưới dạng chuỗi trong `apps/mobile/src/map/vendor.generated.ts`. Nên sinh file này lúc build.
- File quá lớn: `tracking.service.ts` khoảng 1.900 dòng, `tracking.repository.ts` khoảng 1.400, `CoordinatorTripPage.tsx` 1.345, mobile `CustomerScreens.tsx` 2.246 và `CrewWork.tsx` 1.972.
- API và web không có ESLint, không có Prettier; lệnh `lint` thực chất là `tsc --noEmit`. API có khoảng 80 chỗ dùng `any`.
- Chỉ có một entity TypeORM (`User`); phần còn lại là SQL thô viết thẳng trong service. Tầng repository không nhất quán: orders, trips, tracking có; payments, manager, customer, specialist không có.
- Hai cấu trúc thư mục cùng tồn tại trên web: `features/` và `modules/`. Màn điều phối có hai bản (`modules/trips/pages` và `modules/coordinator/pages`).

**P2-2. Kiểm thử giao diện không chạy được.**

- `apps/web/test` có khoảng 50 file, nhưng `package.json` của web không có script `test`, Playwright không nằm trong `devDependencies`, CI không chạy file nào.
- Kết quả chạy thử ở mục 3. Nhóm cũng đã ghi nhận các test trình duyệt đều timeout.
- Mobile chỉ có test cho hàm thuần (domain). Không có test component, không có test giao diện tự động (Maestro hoặc Detox).

**P2-3. Hiệu năng tải trang web.** Số liệu ở bảng mục 3. Toàn bộ không gian làm việc của khách, quản lý, chuyên viên, tài xế nằm chung một trang `/dashboard`, chọn theo `?view=`, nên tải chung một gói lớn. Nên tách route theo vai trò và tải lười thư viện bản đồ.

**P2-4. Dữ liệu và file không nên nằm trong git.**

- `backups/wdp_before_trip_fleet_20261028.sql` (860 KB) chứa bảng `users` có chuỗi băm mật khẩu và 13 địa chỉ Gmail. Nếu là email thật thì đây là lộ dữ liệu cá nhân; cần xóa khỏi lịch sử git, không chỉ xóa file.
- `.idea/`, `database/__pycache__/*.pyc`, `package-lock.json` ở gốc (dự án dùng pnpm), `ca.pem`.
- Mobile có cả `package-lock.json` (npm) lẫn nằm trong workspace pnpm; hai trình quản lý gói cho một ứng dụng.

**P2-5. Lỗi và điểm yếu nhỏ trong nghiệp vụ.**

- So ngày theo UTC: "ngày khởi hành không ở quá khứ" và "ngày sinh không ở tương lai" dùng `new Date().toISOString()`. Từ 0 giờ đến 7 giờ sáng giờ Việt Nam, khách chọn được ngày hôm qua.
- Mã đơn `VCN-yyyymmdd-nnnn` giới hạn 9.999 đơn mỗi ngày và cấp số bằng `MAX()+1` rồi thử lại khi trùng. Đủ cho đồ án, nên nói rõ giới hạn.
- Ảnh đại diện lưu dạng base64 trong MySQL (tối đa 5 MB mỗi người) thay vì kho file.
- Phiên thanh toán `PENDING` không có tác vụ dọn; một đơn có thể có nhiều phiên treo.
- Số tiền nhân 100 bằng số thực khi đối chiếu VNPay (`Number(amount) * 100`). Nên dùng số nguyên.
- Một số danh sách không phân trang: `manager/intake` trả mọi đơn, `orders/customer-workspace` trả mọi đơn, ngựa và biên nhận của khách.
- `GET /health` chỉ kiểm tra MySQL, không kiểm tra Redis và kho file.

**P2-6. Mobile chưa ở mức phát hành.**

- Không có `eas.json`, `app.json` không khai báo icon, splash, adaptive icon. Chưa có APK hay AAB ký để cài lên máy người chấm. README ghi "chưa xác minh build APK".
- Chỉ có thư mục `android/`. iOS chưa build, chưa thử.
- GPS nền cần development build; trong Expo Go chỉ chạy khi app mở. Đây là chức năng chính của tài xế nên phải thử trên máy thật trước ngày bảo vệ.
- Điều hướng tự viết trong `App.tsx` (khoảng 1.200 dòng), không dùng thư viện điều hướng. Hệ quả: không có deep link (mở thông báo vào đúng màn), tự xử lý nút Back.
- Thiết kế ghi dùng SQLite cho offline; thực tế dùng AsyncStorage với JSON. Chấp nhận được cho hàng chờ nhỏ, nhưng cần sửa tài liệu cho khớp.
- Địa chỉ API mặc định là `http://` theo máy chạy Metro. Bản phát hành cần HTTPS và địa chỉ cố định.
- Bản đồ chạy trong WebView (MapLibre). Chưa đo pin, độ nóng và độ mượt trên máy thật.
- Giấy tờ của ngựa trên mobile vẫn mở sang web và phải đăng nhập lại.

**P2-7. Tài liệu.**

- `README.md` gốc mô tả NestJS và Firebase; thực tế là Express và JWT. Nhắc tới `.env.example` nhưng file này không có trong repo. Liệt kê endpoint `/auth/sync` không tồn tại.
- `database/README.md` cũng ghi backend dùng Firebase.
- `pnpm build` ở gốc trên Windows chỉ build `shared` rồi báo thành công (dấu nháy đơn trong script không được cmd hiểu). Người chấm dùng Windows sẽ tưởng đã build xong.
- Thư mục `docs/` có hơn 40 file kế hoạch và nghiệm thu theo từng đợt, nhưng thiếu các tài liệu hội đồng thường đòi: đặc tả yêu cầu (SRS) với danh sách use case, sơ đồ ERD, sơ đồ kiến trúc dạng hình, bảng test case kèm kết quả, hướng dẫn cài đặt và triển khai, hướng dẫn sử dụng theo vai trò.
- Quy ước commit không thống nhất: 63 trên 136 commit theo mẫu `[dd.mm.yyyy][Tên - ...]`, còn lại theo `feat(...)` hoặc tự do. Có hai danh tính git cho cùng một người ở hai thành viên.

### P3. Mức thấp, nên có nếu còn thời gian

- Giao diện chỉ có tiếng Việt dù sản phẩm phục vụ tuyến Việt Nam, Trung Quốc, Thái Lan, Campuchia.
- Chưa có đánh giá sau chuyến, chưa có biên bản bàn giao có chữ ký hoặc ảnh gắn vào mốc giao (hiện ảnh đi qua sự cố giao ngựa).
- Chưa xuất được báo giá, biên nhận, hợp đồng ra PDF.
- Chưa có báo cáo vận hành ngoài doanh thu: tỷ lệ đúng giờ, số sự cố theo tuyến, hiệu suất xe.
- Chưa quét virus file tải lên. Kiểm tra chữ ký nội dung đã tốt, nhưng PDF vẫn có thể chứa mã độc.
- Chưa có giám sát, cảnh báo lỗi (Sentry hoặc tương đương), chưa có chiến lược sao lưu DB.
- Trợ năng: mobile có khoảng 80 nhãn trợ năng; chưa thử TalkBack và cỡ chữ hệ thống lớn trên bản đồ.

## 4b. Lỗi mới phát hiện khi bấm tay

**N1 (P1). Quản lý không từ chối hoặc yêu cầu bổ sung được đơn.** Đã xác minh. Màn tiếp nhận chỉ có "Hủy" (đóng hộp thoại) và "Tiếp nhận đơn": `apps/web/src/features/manager/OrderIntakeDetail.tsx` dòng 29 chỉ gọi `onReview('APPROVED')`. API có đủ `REJECTED` và `NEED_INFO`, form cũ trong `OrdersWorkspace.tsx` có nhưng quản lý không còn đi vào đó. Hậu quả: khách không bao giờ nhận được yêu cầu bổ sung, trạng thái `NEED_INFO` và `REJECTED` chết trên giao diện. Nút "Từ chối đơn" của điều phối cũng bị khóa cứng, ghi chú "Chưa có API" (`CoordinatorTripPage.tsx` dòng 852).

**N2 (P1). Không có màn quản lý xe và địa điểm.** Đã xác minh. `FleetWorkspace` và `LocationsWorkspace` chỉ được vẽ trong `DashboardLayout`, mà chỉ ADMIN còn đi vào layout này; đường `/coordinator/fleet` tự chuyển về danh sách chuyến; menu chuyên viên chỉ còn 2 mục. API CRUD vẫn có. Hậu quả: thêm xe, thêm trạm nghỉ phải dùng SQL. Các mục "Quy định kiểm dịch" và "Theo dõi thông quan" trong `role-workspaces.ts` cũng không còn lối vào.

**N3 (P2). Khách thấy báo giá "Vận chuyển 0%", quản lý thấy 100%.** Đã xác minh, rõ nguyên nhân. `apps/api/src/features/orders/orders.service.ts` dòng 48 không SELECT `q.subtotal`, nên `CustomerQuote.tsx` dòng 141 luôn rơi vào nhánh 0.

**N4 (P2). Mobile hiện "Còn 21 giờ 10 phút để đặt cọc" dù đã cọc xong.** Đã xác minh. `apps/mobile/src/screens/CustomerScreens.tsx` dòng 1039 không kiểm tra số đã trả.

**N5 (P1). Mốc hành trình không đối chiếu với GPS và lịch.** Đã xác minh khi chạy. Tài xế đang ở TP.HCM bấm "Đã đến" Đà Nẵng (854 km) sau 1 phút và được ghi nhận. Chuyến kế hoạch 20/11 xuất phát được từ 10/11, không có cảnh báo. Khách nhận thông báo xe đã tới và bị yêu cầu trả tiền dựa trên mốc này.

**N6 (P2). Chưa có quy tắc nghỉ cho ngựa.** Đã xác minh. Kế hoạch một chặng 854 km không điểm nghỉ vẫn gửi và duyệt được. Thẻ trên bản đồ hiện "nghỉ tiếp sau 271 giờ 52" (`apps/mobile/src/map/trip-stats.ts` dòng 168) vì tính tới giờ giao dự kiến. Với sản phẩm vận chuyển động vật sống, đây là câu hỏi nghiệp vụ hội đồng dễ hỏi.

**N7 (P2). Trang lịch sử của tài xế và hộ tống trên web tràn ngang ở cỡ điện thoại** (885 px trên màn 375 px). `Table` trong `DriverHistory.tsx` dòng 83 không có `scroll`. Khu vực này vốn thiết kế cho điện thoại.

**N8 (P2). Tìm địa chỉ của điều phối cho kết quả kém.** Đã xác minh. Địa chỉ nguyên văn của đơn đi Đà Nẵng báo "Không tìm thấy"; địa chỉ TP.HCM chỉ trả về đồn công an và viện y tế gần tên phường. Điều phối phải tự sửa từ khóa hoặc chọn trên bản đồ. Phụ thuộc dịch vụ Photon công cộng.

**N9 (P3). Câu chữ và định dạng.**

- Tài xế thấy lỗi kỹ thuật `java.net.ConnectException: Failed to connect to /10.0.2.2:3100` trong Hàng chờ gửi.
- Khách đọc "Manager đã chuyển chuyến cho tổ tài xế" (`trips.repository.ts` dòng 287) và "Đã đến trạm dừng" khi xe đã tới điểm giao.
- Cùng một vai trò lúc là "Lơ xe" (web điều phối), lúc là "Hộ tống".
- "Khoảng 647 phút lái xe" nên đổi thành giờ. Mobile hiện `8.38`, `VAT 0.00%`, `Đặt cọc 30.00%`, và dòng "Vượt 238 km × 15.750 đ/km × 238" lặp số lượng. Bước xác nhận web hiện ngày dạng `2026-11-20`.
- Ba tên thương hiệu: "Vận chuyển ngựa", "HorseRoute", "WDP EQUINE" (`DashboardShell.tsx` dòng 73).

**N10 (P3). Console có cảnh báo API Ant Design đã lỗi thời**: `maskClosable`, `destroyOnClose`, `Spin tip`, `Drawer width`.

**N11 (P3, cần thử máy thật). Ảnh vừa chụp đôi khi không gắn vào form.** 2 trên 4 lần chụp, form không báo gì và vẫn 0/3; sau khi dọn cache thì được. Máy ảo còn 319 MB trống (95%) nên nhiều khả năng do môi trường, chưa khẳng định. Dù vậy `PhotoPicker` trong `live-ui.tsx` im lặng khi không nhận được ảnh, nên nên có thông báo.

**N12 (P2). Lỗi code lộ ra khi sửa test tích hợp (11/11/2026), đã sửa trong mục 0.3 của kế hoạch.**

- Gửi duyệt kế hoạch khi chưa phân công xe trả 400 kèm câu tiếng Anh của thư viện kiểm tra dữ liệu ("Array must contain at least 1 element(s)"). Nay trả 409 kèm lời tiếng Việt. Lỗi của dữ liệu đội xe đã lưu (vượt sức chứa, sai tổng số ngựa, tổ lái không hợp lệ) cũng chuyển từ 400 sang 409.
- Lưu lại đúng đội xe đang có vẫn xóa và tạo lại bản ghi, ghi audit và báo lại tổ lái mỗi lần bấm. Nay không làm gì.
- Báo sự cố và ghi nhật ký chăm sóc kiểm tra nội dung (ảnh) trước khi kiểm tra người gửi có thuộc chuyến không. Nay kiểm tra phân công trước, người ngoài chuyến luôn nhận 404.
- Test `route-acceptance` không xóa database thử sau khi chạy. Nay mặc định xóa.

**N13 (P3). Giao diện điều phối hứa hơn API cho phép.** Khi kế hoạch không còn ở trạng thái nháp, màn điều phối ghi "Nhân sự có thể được cập nhật riêng", nhưng API chỉ nhận phân công khi kế hoạch còn nháp (409 với các trạng thái khác). Cần sửa câu chữ hoặc mở API theo đúng nghiệp vụ mong muốn.

**N14 (P3). Số hộ chiếu FEI không có dấu bắt buộc nhưng lại bắt buộc khi đặt chuyến.** Phát hiện khi viết test E2E (11/11/2026). Form hồ sơ ngựa không đánh dấu `*` cho ô này, nhưng bước chọn ngựa khi đặt chuyến chặn nếu thiếu và chỉ báo bằng một thông báo nổi vài giây (`CustomerJourney.tsx`). Nên đánh dấu bắt buộc ngay trên form hồ sơ, hoặc hiện lỗi ngay trên thẻ ngựa.

**N15 (P1, phát hiện 11/11/2026 khi chạy trên dữ liệu thật). Mở nhiều màn liên tiếp thì bị đá ra màn đăng nhập.** API giới hạn 100 request/phút cho mỗi IP, kể cả người đã đăng nhập; cả nhóm chung wifi hay demo nhiều vai trò trên một laptop là chung một IP. Khi `/users/me` gặp 429, `AuthProvider` xóa token và báo phiên hết hạn. Đã sửa cùng ngày: API giới hạn theo tài khoản (300/phút), theo IP chỉ còn chống dội (1000/phút), đăng nhập và đăng ký có giới hạn IP riêng 30/phút; web chỉ đăng xuất khi 401, 403, 404, còn 429, lỗi máy chủ, mất mạng thì giữ phiên, thử lại theo Retry-After và hiện màn "Thử lại".

## 5. Điểm mạnh nên trình bày với hội đồng

- Phân quyền kiểm tra ở máy chủ theo vai trò đọc từ DB, không tin vai trò trong token; có test chứng minh ("JWT ADMIN claim cannot grant Manager authority"). Điều phối chỉ thấy chuyến mình phụ trách, tài xế chỉ thấy chuyến được phân công.
- Giao dịch có khóa hàng (`FOR UPDATE`) ở thanh toán, duyệt đơn, duyệt kế hoạch, phân xe; chống trùng bằng `requestId` và khóa lạc quan `revision`.
- Audit log cho đơn, báo giá, biên nhận, giấy tờ, kế hoạch chuyến.
- File tải lên: kiểm tra chữ ký nội dung, giới hạn 5 MB, lưu bằng UUID, kho riêng tư, từ chối bucket công khai.
- VNPay: chỉ tin IPN có chữ ký, so số tiền, chống ghi nhận lần hai, so sánh chữ ký bằng `timingSafeEqual`.
- Mobile: hàng chờ offline có hoàn tác, xử lý mất phản hồi (409 và 402), token trong SecureStore, 0 chỗ dùng `any`.
- Khởi động và tắt API có trình tự, log có cấu trúc kèm `requestId`, Swagger tắt ở production.
- Gói `shared` dùng chung kiểu dữ liệu, bảng giá và dữ liệu tỉnh xã giữa API, web và mobile.

## 6. Thiếu sót theo từng luồng

| Luồng | Chạy được | Còn thiếu |
| --- | --- | --- |
| 1. Tạo và duyệt đơn | Nháp, gửi, duyệt, tự tạo chuyến nháp | Giao diện quản lý không từ chối và yêu cầu bổ sung được (N1); hủy đơn; sửa đơn sau khi duyệt; phân trang danh sách của quản lý |
| 2. Hồ sơ và giấy tờ | Tải lên theo phiên bản, thẩm định, yêu cầu bổ sung, hết hạn tự động | Quy định kiểm dịch theo tuyến đã bị gỡ (migration `RemoveQuarantineRules`) nhưng menu "Quy định kiểm dịch" của chuyên viên vẫn còn; cần kiểm tra menu này có nội dung không |
| Báo giá và thanh toán | Bảng giá có phiên bản, báo giá, biên nhận thủ công, thanh toán mô phỏng, chặn giao khi còn nợ | Cổng thanh toán thật; hoàn tiền; ép đặt cọc; hóa đơn PDF |
| 3. Lập kế hoạch chuyến | Chặng, xe, tổ lái, duyệt kế hoạch, kiểm tra sẵn sàng | Quản lý danh mục điểm dừng (FR-TRP-02) và sửa kế hoạch đã duyệt (FR-TRP-09) theo `implementation-status.md`; chưa kiểm tra lại giấy tờ lúc xuất phát |
| 4. Theo dõi chuyến | Mốc chặng, GPS, nhật ký ngựa, sự cố, cảnh báo, timeline | Push; GPS thật cho khách; ảnh bàn giao gắn vào mốc giao; thu hồi ngoại lệ giao đã duyệt |

`docs/implementation-status.md` chưa cập nhật theo trạng thái hiện tại (ví dụ vẫn nhắc `mark-ready` trong khi route là `start-transport`).

## 7. Câu hỏi hội đồng có thể hỏi

1. Khách tự bấm "Xác nhận thanh toán" thì hệ thống tin à? Trong thực tế chặn thế nào?
2. Clone repo về, làm sao dựng DB và chạy được? Làm thử đi.
3. CI đang đỏ, vì sao? Test hỏng hay code hỏng?
4. Token bị lộ thì thu hồi thế nào? Nhân viên nghỉ việc thì khóa ra sao khi token còn 7 ngày?
5. Ai tạo tài khoản tài xế? Admin làm được gì?
6. Khách muốn hủy đơn sau khi đặt cọc thì sao?
7. Xe mất sóng 2 giờ thì dữ liệu mốc và GPS đi đâu? Hai thiết bị cùng gửi một mốc thì sao? (Câu này nhóm trả lời tốt, nên chuẩn bị demo.)
8. Vì sao viết SQL thô thay vì dùng ORM đã cài? Vì sao Redis bắt buộc mà không dùng?
9. Hai người dùng cùng duyệt một kế hoạch thì sao? (Có khóa, nên chỉ vào code.)
10. Chạy 100 xe cùng gửi GPS thì nghẽn ở đâu? Có chỉ mục nào cho `trip_positions`?
11. App mobile cài lên máy thầy thế nào? Có bản iOS không?
12. Khách có thấy xe đang ở đâu không? Vì sao không?

## 8. Thứ tự làm đề xuất trước ngày bảo vệ

Kế hoạch xử lý đầy đủ, gồm cả các lỗi N1 đến N11, ở [ke-hoach-xu-ly-loi-10-11-2026.md](ke-hoach-xu-ly-loi-10-11-2026.md). Danh sách dưới đây là bản tóm tắt ban đầu.

1. Cờ tắt thanh toán mô phỏng, chạy trọn một giao dịch VNPay Sandbox trên API có địa chỉ công khai (P0-1).
2. Migration gốc, lệnh `db:setup`, sửa seed demo (P0-3 và một phần P0-2). Việc này cũng mở đường cho việc tự test giao diện.
3. Sửa test flow3, flow4 cho CI xanh (P0-2).
4. Sửa README, thêm `.env.example`, sửa lệnh `build` chạy được trên Windows (P2-7). Ít công, hiệu quả lớn với người chấm.
5. Giới hạn riêng cho login, thu hồi token khi đổi mật khẩu, quên mật khẩu (P1-1).
6. Màn Admin quản lý tài khoản (P1-2).
7. Hủy đơn (P1-3) và ép đặt cọc (P1-4).
8. Sửa nginx, `trust proxy`, volume (P1-5).
9. Build APK ký, cài lên máy thật, thử GPS nền 30 phút (P2-6).
10. Xóa file backup khỏi lịch sử git nếu email trong đó là thật (P2-4).
11. Bổ sung SRS, ERD, bảng test case, hướng dẫn triển khai (P2-7).
