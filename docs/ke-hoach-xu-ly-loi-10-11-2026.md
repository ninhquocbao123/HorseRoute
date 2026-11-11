# Kế hoạch xử lý lỗi HorseRoute

Lập ngày 10/11/2026, dựa trên [danh-gia-hoi-dong-10-11-2026.md](danh-gia-hoi-dong-10-11-2026.md). Mã `P0-1`, `N3`... là mã lỗi trong báo cáo đó. Nền làm việc: nhánh `long`, commit `94e9733`.

Trạng thái: **Long đã duyệt ngày 10/11/2026. Đang làm giai đoạn 0. Giai đoạn A cần trả lời mục 2.**

## Tiến độ

| Việc | Trạng thái | Ghi chú |
| --- | --- | --- |
| 0.1 | Xong 11/11/2026 | Lệnh `pnpm db:setup`; migration Init dựng 25 bảng gốc trên DB trống, bỏ qua DB đã có bảng; `migration:run` chạy được bằng `-t each`; gỡ 5 script `apply-*`. Đã thử: DB trống, chạy lại, CLI, DB có sẵn dữ liệu, từ chối DB ở xa; cấu trúc giống hệt cách dựng cũ (358 cột, 145 chỉ mục, 179 ràng buộc). **Khác kế hoạch:** không đổi tên 5 cặp migration trùng timestamp, xem ghi chú ở mục 0.1 |
| 0.2 | Xong 11/11/2026 | Seed dựng schema bằng đúng migration của `db:setup`; xe theo `license_plate`, `status`, mỗi chuyến một xe qua `trip_vehicles`; hồ sơ tổ lái; báo giá và biên nhận cho mọi đơn đã duyệt; thêm đơn mới chờ tiếp nhận. Đã thử bằng API với cả 8 tài khoản: đăng nhập, chuyến của tài xế và hộ tống, báo giá, doanh thu, quản lý duyệt đơn mới, tài xế ghi mốc |
| 0.3 | Xong 11/11/2026 | 16/16 file test tích hợp đạt (174 ca), CI chạy cả 16 file trong một bước và báo mọi file lỗi. Viết lại theo mô hình đội xe: `vehicles`, `coordinator-resources`, `trips-*-checks`; `flow1` theo 3 giấy tờ bắt buộc; `flow4` theo phản hồi sự cố nhiều lần và ảnh bắt buộc; 3 file dùng `TEST_DB_*` thay socket `/tmp` và cổng cố định. Sửa 4 lỗi code lộ ra khi chạy test, xem N12 trong báo cáo. **Khác kế hoạch:** chưa tách để mỗi ca lỗi không chặn ca sau trong cùng file; CI vẫn chạy hết mọi file. **Nên có Tiến xem lại** phần viết lại `trips-*-checks`, vì nghiệp vụ "một xe chỉ thuộc một chuyến đang hoạt động, bất kể giờ" thay cho kiểm tra trùng giờ cũ |
| 0.4 | Xong 11/11/2026 | Playwright 1.64.1 vào devDependencies của web; lệnh `test`, `test:browser`, `test:e2e`. Test E2E mới `apps/web/test/e2e/full-flow.e2e.cjs` đi 14 chặng trên web, API, MySQL thật (database tạm, bản đồ giả, không gọi mạng ngoài), đạt 3 lần liên tiếp. CI cài Chromium, chạy cả ba và tải ảnh lúc lỗi lên. **Khác kế hoạch:** 29 test cũ đã lỗi thời được chuyển vào `apps/web/test/legacy/` kèm README thay vì xóa hay viết lại; phần chúng phủ mà E2E chưa phủ ghi trong README. Chưa chạy trên CI thật vì chưa push |
| 0.5 | Xong 11/11/2026 | `pnpm build` chạy được trên Windows (nháy kép trong bộ lọc pnpm). README viết lại theo Express, JWT, MySQL, Redis: cài đặt, `db:setup`, tạo tài khoản, chạy API và web, demo, mobile, cấu hình, kiểm thử, Docker. Thêm `.env.example` ở gốc và `apps/web/.env.example`. `database/README.md` bỏ phần Firebase, ghi rõ là tài liệu cũ. **Thêm ngoài kế hoạch:** lệnh `pnpm db:create-user`, vì DB mới không có tài khoản nhân viên nào và web chỉ cho khách tự đăng ký; CI chạy lệnh này sau `db:setup`. Đã thử trên bản sao sạch của repo (cài mới, MySQL và Redis tạm): `db:setup` hai lần, tạo đủ 6 vai trò, từ chối email trùng và DB ở xa, API và Swagger chạy, quản lý đăng nhập web, điều phối thêm xe qua API, test API 194/194 và test web đạt. Chưa thử `pnpm dev:infra` vì máy đang có MySQL, Redis của Long ở cổng 3306, 6379 |
| B1 | Xong 11/11/2026 | Làm sớm khi test E2E bắt được: thêm `q.subtotal` vào truy vấn báo giá của khách |

## 1. Nguyên tắc

- Làm tuần tự theo giai đoạn. Giai đoạn 0 đi trước vì nó tạo lưới an toàn cho mọi việc sau.
- Mỗi việc là một commit riêng, kèm test, theo định dạng `[dd.mm.yyyy][Long - ...]`.
- Không chạy test và migration thử trên DB chung Aiven. Migration mới chỉ đưa lên DB chung khi Long đồng ý.
- Sửa `packages/shared` thì nhắc build lại gói này.
- Thêm thư viện mobile thì cập nhật cả `apps/mobile/package-lock.json` và `pnpm-lock.yaml`.
- Không gỡ test khỏi CI để lấy dấu xanh.
- Ước lượng công là ngày làm của một người, chỉ để so độ lớn giữa các việc.

## 2. Cần Long quyết định trước

| # | Câu hỏi | Đề xuất | Ảnh hưởng |
| --- | --- | --- | --- |
| Q1 | Có khóa VNPay Sandbox và địa chỉ API công khai để nhận IPN chưa? Khóa tự đặt vào `.env`, không gửi qua chat | Có, dùng dịch vụ đường hầm HTTPS hoặc API đã triển khai | A1. Thiếu thì giữ mô phỏng, chỉ tắt được ở production |
| Q2 | Ai được hủy đơn, ở trạng thái nào, hoàn bao nhiêu cọc? | Trước khi duyệt: khách tự hủy. Sau khi duyệt, trước khi xuất phát: quản lý hủy. Đang chạy: không hủy. Mức hoàn cọc do quản lý nhập, có lý do | A4 |
| Q3 | Bắt buộc đủ cọc mới được chuyển chuyến cho tài xế? | Có, quản lý được ngoại lệ có lý do, giống ngoại lệ giao ngựa | A5 |
| Q4 | Khách có được xem GPS thật không? | Có, chậm khoảng 1 đến 2 phút. Nếu giữ nguyên thì ghi rõ lý do trong tài liệu | D3 |
| Q5 | Quy tắc nghỉ cho ngựa: tối đa bao nhiêu giờ chạy liên tục? | Tham số hệ thống, mặc định cảnh báo khi vượt 4 giờ, cấm gửi duyệt khi vượt 8 giờ. Con số cần người hiểu nghiệp vụ chốt | B5 |
| Q6 | Xóa file backup khỏi lịch sử git? Việc này ghi đè lịch sử, cả nhóm phải clone lại | Kiểm tra email trong file trước. Thật thì xóa, sau khi báo cả nhóm | C4 |
| Q7 | Có làm iOS không? | Không, nói rõ phạm vi Android khi bảo vệ, trừ khi có máy Mac và tài khoản Apple | D4 |
| Q8 | Ngày bảo vệ là ngày nào? | Long cho biết để cắt phạm vi: thiếu thời gian thì dừng sau giai đoạn C | Toàn kế hoạch |

## 3. Tổng quan

| Giai đoạn | Mục tiêu | Lỗi xử lý | Công ước lượng |
| --- | --- | --- | --- |
| 0. Nền tảng | Clone về chạy được, CI xanh, có seed demo | P0-2, P0-3, phần build và README của P2-7, P2-2 | 5–7 ngày |
| A. Nghiệp vụ lõi và bảo mật | Không còn lỗ hổng hội đồng hỏi là thấy | P0-1, P1-1, P1-2, P1-3, P1-4, N1, N2 | 8–11 ngày |
| B. Lỗi nhỏ và độ tin cậy dữ liệu | Sửa lỗi hiển thị, mốc hành trình đáng tin | N3–N9, N11, P2-5 | 4–6 ngày |
| C. Triển khai | Bản Docker chạy đúng, repo sạch | P1-5, P2-4, phần giám sát của P3 | 2–3 ngày |
| D. Mobile phát hành | Có APK, có push, thử máy thật | P1-6, P1-7, P2-6 | 5–7 ngày |
| E. Chất lượng mã và tài liệu | Dễ bảo trì, đủ hồ sơ nộp | P2-1, P2-3, P2-7, N10 | 5–8 ngày |
| F. Bổ sung nếu còn thời gian | Điểm cộng | P3 còn lại | Tùy chọn |

Tổng khoảng 29–42 ngày công, chưa tính F. Nhóm nhiều người có thể làm song song A, B, D sau khi xong giai đoạn 0.

## 4. Giai đoạn 0: Nền tảng

**0.1 Dựng DB từ đầu bằng một lệnh (P0-3).**

- Xuất schema hiện tại thành migration gốc duy nhất thay cho `1700000000000-Init.ts`. Đưa 26 bảng của `test/fixtures/schema.sql` vào migration này.
- ~~Đổi tên 5 cặp migration trùng timestamp~~ Không làm. TypeORM đánh dấu migration đã chạy theo **tên class**, nên đổi tên sẽ khiến DB chung chạy lại các migration cũ. Thứ tự giữa hai migration trùng timestamp vẫn cố định (TypeORM sắp theo timestamp, rồi theo thứ tự tệp), hai migration trong mỗi cặp không phụ thuộc nhau. Test `test/migrations.test.cjs` giữ tên class không trùng. Chỉ đổi tên nếu Long muốn, kèm script sửa bảng `migrations` của DB chung.
- Nguyên nhân lỗi ở migration thứ 16 (`RemoveQuarantineRules`): nó tự mở transaction sau câu `DROP TABLE`, mà DDL trong MySQL tự commit, nên chế độ transaction mặc định của TypeORM vỡ. Đã đặt `transaction = false` cho migration này và chạy ở chế độ `each`.
- Bỏ các script `apps/api/scripts/apply-*-migration.cjs` sau khi xác nhận migration đã phủ hết.
- Thêm `pnpm db:setup`: tạo DB, chạy migration, nạp danh mục (3 loại giấy tờ, bảng giá, tham số).
- Nghiệm thu: DB trống, chạy `pnpm db:setup` xong API khởi động và đăng nhập được. CI chạy đúng lệnh này.

**0.2 Sửa seed demo (P0-2).**

- `seed-flow4-demo.cjs` đổi sang `license_plate`, `status`, `vehicle_type` mới, thêm `trip_vehicles`, `crew_profiles`, đơn có báo giá và biên nhận.
- Có tài khoản đủ 7 vai trò và các đơn ở nhiều trạng thái để demo.
- Nghiệm thu: chạy theo `docs/demo-local.md` từ DB trống, web và mobile đăng nhập và thấy dữ liệu.

**0.3 Cho test tích hợp xanh (P0-2).**

- `flow3-read`, `locations`, `vehicles`, `flow4-tracking`, `flow1`: đổi cột cũ, viết lại `trips-*-checks.cjs` theo phân xe và nhân sự từng xe, thêm danh mục giấy tờ vào dữ liệu mẫu `flow1`. Phần viết lại flow3 nên có Tiến xem cùng để chốt ca nào còn đúng nghiệp vụ.
- `flow4-tracking`, `coordinator-resources`: đọc kỹ từng ca lệch để phân biệt test cũ với code sai. Code sai thì sửa code, thêm vào giai đoạn B.
- `resource-reservations`, `route-acceptance`, `trip-fleet`: dùng chung cấu hình `TEST_DB_*` thay vì socket `/tmp` và cổng cố định để chạy được trên Windows và CI.
- Thêm cả 16 file vào CI. Sửa test để mỗi ca lỗi không chặn các ca sau.
- Nghiệm thu: 16/16 file đạt, CI trên GitHub xanh.

**0.4 Sửa test trình duyệt web (P2-2).**

- Thêm Playwright vào `devDependencies` của web, thêm script `test` và `test:e2e`.
- Viết lại các test theo giao diện hiện tại. Ưu tiên một test đi trọn luồng như bảng mục 3b của báo cáo, chạy trên API thật với DB tạm, thay cho nhiều test API giả đã lỗi thời. File không còn giá trị thì xóa.
- Thêm vào CI.
- Nghiệm thu: test E2E đi trọn từ đăng ký đến giao ngựa trong CI.

**0.5 Build và README (P2-7).**

- Sửa script `build` ở gốc để chạy được trên Windows, dùng dấu nháy kép hoặc script Node.
- Viết lại `README.md`: Express, JWT, MySQL, cách chạy thật. Thêm `.env.example` ở gốc và `apps/web/.env.example`. Bỏ phần Firebase ở `database/README.md`.
- Nghiệm thu: làm đúng README trên máy sạch, chạy được.

## 5. Giai đoạn A: Nghiệp vụ lõi và bảo mật

**A1. Thanh toán (P0-1).** Phụ thuộc Q1.

- Thêm biến `PAYMENT_SIMULATION_ENABLED`, mặc định tắt khi `NODE_ENV=production`. Khi tắt, `POST /payments/sessions` và `/complete` trả 404. Web và mobile ẩn lựa chọn mô phỏng dựa trên một cờ API trả về.
- Khi có khóa: chạy trọn một giao dịch VNPay Sandbox trên web, nối mobile theo `docs/mobile-design/10-thanh-toan-mobile-plan.md`.
- Thêm trang kết quả khi IPN chưa về, có hướng dẫn rõ thay vì chờ mãi.
- Nghiệm thu: bật production thì gọi `complete` bị 404. Một giao dịch sandbox thật ghi biên nhận qua IPN, có video dự phòng.

**A2. Tài khoản và phiên (P1-1).**

- Giới hạn riêng `/auth/login` và `/auth/register` theo email cộng IP, khóa tạm sau nhiều lần sai.
- Thêm cột `token_version` vào `users`, đưa vào JWT, so khi xác thực và khi nối socket. Tăng khi đổi mật khẩu, khóa tài khoản hoặc bấm đăng xuất mọi thiết bị.
- Rút access token còn 15–60 phút, thêm refresh token có xoay vòng lưu băm trong DB. Web và mobile tự làm mới. Hàng chờ offline và GPS nền phải chạy đúng khi token hết hạn.
- Quên mật khẩu: mã dùng một lần có hạn, gửi email. Thêm dịch vụ email dùng chung với D2 nếu cần.
- Siết chính sách mật khẩu.
- Nghiệm thu: token cũ bị 401 sau khi đổi mật khẩu; sai nhiều lần bị khóa tạm; đặt lại mật khẩu được qua email. Thêm test.

**A3. Quản trị tài khoản (P1-2).**

- API cho ADMIN: danh sách có lọc, tạo nhân sự, gán vai trò và loại tổ lái, khóa và mở, đặt lại mật khẩu.
- Màn Admin trên web, dùng được ở cỡ điện thoại.
- Ghi audit.
- Nghiệm thu: tạo tài khoản tài xế từ màn Admin, đăng nhập được, không cần SQL.

**A4. Hủy đơn và hoàn tiền (P1-3).** Phụ thuộc Q2.

- API hủy theo vai trò và trạng thái, giải phóng xe và tổ lái đã giữ, ghi audit, gửi thông báo.
- Thêm cách ghi hoàn tiền, ví dụ biên nhận âm hoặc bảng `order_refunds`, cập nhật công thức đã thu và doanh thu.
- Giao diện web cho khách và quản lý, mobile cho khách.
- Quyết định số phận nút "Từ chối đơn" đang khóa của điều phối: làm API hoặc bỏ nút.
- Nghiệm thu: test cho từng trạng thái; xe và tổ lái rảnh lại sau khi hủy.

**A5. Ép đặt cọc và thống nhất ghi nhận tiền (P1-4).** Phụ thuộc Q3.

- Thêm điều kiện đủ cọc vào `readiness` và `releaseToDriver`, có ngoại lệ của quản lý.
- Chỉ cho đơn sang `PREPARING` theo một quy tắc rõ ràng.
- Gom biên nhận thủ công của quản lý và thanh toán trực tuyến về một hàm, để cùng đổi trạng thái, gửi thông báo, phát socket.
- Nghiệm thu: đơn chưa cọc bị chặn ở bước chuyển chuyến, có thông báo rõ.

**A6. Quản lý từ chối và yêu cầu bổ sung (N1).**

- Thêm nút và hộp nhập lý do vào `OrderIntakeDetail.tsx`.
- Thử luồng khách nhận yêu cầu, sửa, gửi lại trên web và mobile. Luồng này chưa từng được thử trên giao diện mới nên có thể lộ lỗi thêm.
- Nghiệm thu: thêm vào test E2E.

**A7. Màn xe và địa điểm (N2).**

- Gắn `FleetWorkspace` vào layout điều phối, `LocationsWorkspace` vào menu chuyên viên. Bỏ redirect `/coordinator/fleet`.
- Xóa các mục menu không còn dùng trong `role-workspaces.ts`.
- Nghiệm thu: thêm xe và trạm nghỉ từ giao diện rồi dùng được khi lập kế hoạch.

## 6. Giai đoạn B: Lỗi nhỏ và độ tin cậy dữ liệu

| Việc | Lỗi | Cách sửa | Nghiệm thu |
| --- | --- | --- | --- |
| B1 | N3 | Thêm `q.subtotal` vào câu SELECT ở `orders.service.ts` dòng 48 | Khách và quản lý cùng thấy 100%; thêm unit test |
| B2 | N4 | Chỉ hiện đếm ngược khi chưa đủ cọc, `CustomerScreens.tsx` dòng 1039 | Test hàm thuần trong `live-domain` |
| B3 | N5 | Khi ghi đến và giao: so vị trí mới nhất với điểm đích. Xa hơn ngưỡng thì cảnh báo trên app và lưu cờ để điều phối thấy, không chặn cứng vì GPS có thể sai. Xuất phát quá sớm so với kế hoạch thì hỏi xác nhận | Có cờ trên dữ liệu chuyến và web điều phối; test API |
| B4 | N6 | Sửa `trip-stats.ts`: không có điểm nghỉ thì hiện thông tin hợp lý, không tính tới giờ giao | Test trong `tests/map.test.ts` |
| B5 | N6, Q5 | Tham số giờ chạy tối đa; kiểm tra khi gửi duyệt kế hoạch | Kế hoạch vượt ngưỡng bị cảnh báo hoặc chặn |
| B6 | N7 | Thêm `scroll={{ x: true }}` hoặc đổi sang thẻ ở cỡ nhỏ, `DriverHistory.tsx` | Không tràn ở 375 px; thêm kiểm tra tràn vào E2E |
| B7 | N8 | Tìm nhiều bước: nguyên văn, bỏ tên trại, phường cộng tỉnh. Ưu tiên kết quả trong tỉnh của đơn. Ghi rõ khi phải chọn trên bản đồ | Địa chỉ mẫu ở báo cáo có kết quả đúng tỉnh |
| B8 | N9 | Đổi câu chữ: lỗi kỹ thuật sang lời dễ hiểu, "Manager" sang "Quản lý", mốc cuối thành "Đã đến điểm giao", thống nhất "Hộ tống", đổi phút sang giờ phút, định dạng số kiểu Việt Nam, bỏ lặp số lượng, thống nhất một tên thương hiệu | Rà lại bảng thuật ngữ, cập nhật test |
| B9 | N11 | Thử trên máy thật. Thêm thông báo khi không nhận được ảnh trong `PhotoPicker` | 10 lần chụp liên tiếp trên máy thật đều gắn được |
| B10 | P2-5 | So ngày theo giờ Việt Nam thay UTC ở `orders.service.ts`, `customer.service.ts` | Test mốc 0 giờ đến 7 giờ sáng |
| B11 | P2-5 | Số tiền VNPay tính bằng số nguyên; phân trang `manager/intake` và `customer-workspace`; tác vụ dọn phiên `PENDING`; chuyển avatar sang kho file; `/health` kiểm tra Redis và kho file | Test từng mục |
| B12 | Mục 6 báo cáo | Kiểm tra lại giấy tờ khi xuất phát; thu hồi ngoại lệ giao ngựa; làm FR-TRP-02 và FR-TRP-09 hoặc ghi rõ ngoài phạm vi; cập nhật `implementation-status.md` | Test và tài liệu khớp |

## 7. Giai đoạn C: Triển khai

- **C1 (P1-5).** Thêm khối `location /socket.io/` có `Upgrade` vào `docker/nginx/default.conf`.
- **C2 (P1-5).** Thêm `app.set('trust proxy', 1)`, đưa số hop vào biến môi trường để không bị giả IP.
- **C3 (P1-5).** Thêm volume cho kho file. Hoặc dùng Redis làm kho cho rate limit, hoặc bỏ Redis khỏi điều kiện khởi động.
- **C4 (P2-4).** Phụ thuộc Q6. Gỡ `backups/`, `.idea/`, `database/__pycache__/`, `package-lock.json` ở gốc khỏi git, thêm vào `.gitignore`. Kiểm tra `ca.pem` là chứng chỉ công khai. Xử lý lịch sử nếu Q6 đồng ý.
- **C5 (P3).** Thêm Sentry hoặc tương đương, kịch bản sao lưu DB.
- Nghiệm thu: `docker compose up` từ máy sạch; socket nối được qua nginx; nhiều người dùng không chung hạn mức; tạo lại container file vẫn còn.

## 8. Giai đoạn D: Mobile phát hành

- **D1 (P2-6).** Thêm `eas.json`, icon, splash, adaptive icon. Chốt địa chỉ HTTPS của API. Build APK ký.
- **D2 (P1-6).** Push bằng Expo Notifications và FCM: lưu token thiết bị ở API, gửi cho cảnh báo điều phối, báo cáo sức khỏe, xe tới chờ thanh toán. Thêm email cho sự kiện quan trọng nếu A2 đã có dịch vụ email. Mở đúng màn khi bấm thông báo.
- **D3 (P1-7).** Phụ thuộc Q4. Mở GPS cho khách, hoặc ghi rõ quyết định trong tài liệu.
- **D4 (P2-6).** Thử trên máy thật: GPS nền 30 phút, pin, độ nóng, TalkBack, cỡ chữ lớn. iOS theo Q7.
- **D5 (P2-6).** Sửa tài liệu cho khớp thực tế (AsyncStorage thay SQLite). Giấy tờ trên mobile: làm trong app, hoặc giữ mở web và tự chuyển phiên đăng nhập.
- **D6 (P2-2).** Thêm test giao diện mobile bằng Maestro cho luồng tài xế và khách.
- Nghiệm thu: cài APK lên máy thật, chạy trọn luồng tài xế với màn hình tắt, nhận push.

## 9. Giai đoạn E: Chất lượng mã và tài liệu

- **E1 (P2-1).** Thêm ESLint và Prettier cho API và web, đưa vào CI. Định dạng lại các file viết dồn dòng trước, trong commit riêng không đổi logic.
- **E2 (P2-1).** Tách file lớn theo phần có test che: `tracking.service.ts`, `CoordinatorTripPage.tsx`, `CustomerScreens.tsx`, `CrewWork.tsx`, `App.tsx`. Không gộp với thay đổi nghiệp vụ.
- **E3 (P2-1).** Thống nhất tầng repository cho payments, manager, customer, specialist. Giảm `any` ở API. Gộp `features/` và `modules/` trên web, xóa màn điều phối cũ. Sinh `vendor.generated.ts` lúc build.
- **E4 (P2-3).** Tách route theo vai trò, tải lười thư viện bản đồ, gỡ thư viện bản đồ thừa nếu có. Mục tiêu: chunk khởi đầu dưới 300 KB gzip.
- **E5 (N10).** Thay API Ant Design đã lỗi thời.
- **E6 (P2-7).** Viết SRS và use case, ERD, sơ đồ kiến trúc dạng hình, bảng test case kèm kết quả, hướng dẫn cài đặt và triển khai, hướng dẫn sử dụng theo vai trò. Gom tài liệu kế hoạch cũ vào thư mục lưu trữ. Thống nhất quy ước commit từ nay.

## 10. Giai đoạn F: Bổ sung nếu còn thời gian (P3)

- Tiếng Anh cho toàn bộ giao diện, hiện mới có ở trang công khai.
- Đánh giá sau chuyến; biên bản bàn giao có chữ ký và ảnh gắn vào mốc giao.
- Xuất PDF báo giá, biên nhận, hợp đồng.
- Báo cáo vận hành: tỷ lệ đúng giờ, sự cố theo tuyến, hiệu suất xe.
- Quét virus file tải lên.

## 11. Bảng đối chiếu: mọi lỗi đều có việc xử lý

| Lỗi | Việc | Lỗi | Việc |
| --- | --- | --- | --- |
| P0-1 | A1 | P2-6 | D1, D4, D5 |
| P0-2 | 0.2, 0.3 | P2-7 | 0.5, E6 |
| P0-3 | 0.1 | P3 | C5, F |
| P1-1 | A2 | N1 | A6 |
| P1-2 | A3 | N2 | A7 |
| P1-3 | A4 | N3 | B1 |
| P1-4 | A5 | N4 | B2 |
| P1-5 | C1, C2, C3 | N5 | B3 |
| P1-6 | D2 | N6 | B4, B5 |
| P1-7 | D3 | N7 | B6 |
| P2-1 | E1, E2, E3 | N8 | B7 |
| P2-2 | 0.4, D6 | N9 | B8 |
| P2-3 | E4 | N10 | E5 |
| P2-4 | C4 | N11 | B9 |
| P2-5 | B10, B11 | Mục 6 báo cáo | B12 |

## 12. Điều kiện hoàn thành toàn bộ

1. DB trống dựng được bằng một lệnh, có seed demo đủ vai trò.
2. CI xanh trên GitHub: build, unit, 16 file tích hợp, E2E web.
3. Test E2E đi trọn từ đăng ký đến giao ngựa, có nhánh từ chối, bổ sung, hủy.
4. Bật production thì không còn thanh toán mô phỏng; có một giao dịch VNPay Sandbox thành công.
5. Lặp lại toàn bộ bảng mục 3b của báo cáo trên bản cuối, không còn dòng có lỗi.
6. APK cài được trên máy thật, GPS nền và push hoạt động.
7. Hồ sơ nộp đủ theo E6.
