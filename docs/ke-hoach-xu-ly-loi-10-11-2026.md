# Kế hoạch xử lý lỗi HorseRoute

Lập ngày 10/11/2026, dựa trên [danh-gia-hoi-dong-10-11-2026.md](danh-gia-hoi-dong-10-11-2026.md). Mã `P0-1`, `N3`... là mã lỗi trong báo cáo đó. Nền làm việc: nhánh `long`, commit `94e9733`.

Trạng thái: **Long đã duyệt ngày 10/11/2026. Đang làm giai đoạn 0. Giai đoạn A cần trả lời mục 2.**

## Tiến độ

| Việc | Trạng thái | Ghi chú |
| --- | --- | --- |
| 0.1 | Xong 11/11/2026 | Lệnh `pnpm db:setup`; migration Init dựng 25 bảng gốc trên DB trống, bỏ qua DB đã có bảng; `migration:run` chạy được bằng `-t each`; gỡ 5 script `apply-*`. Đã thử: DB trống, chạy lại, CLI, DB có sẵn dữ liệu, từ chối DB ở xa; cấu trúc giống hệt cách dựng cũ (358 cột, 145 chỉ mục, 179 ràng buộc). **Khác kế hoạch:** không đổi tên 5 cặp migration trùng timestamp, xem ghi chú ở mục 0.1 |
| 0.2 | Xong 11/11/2026 | Seed dựng schema bằng đúng migration của `db:setup`; xe theo `license_plate`, `status`, mỗi chuyến một xe qua `trip_vehicles`; hồ sơ tổ lái; báo giá và biên nhận cho mọi đơn đã duyệt; thêm đơn mới chờ tiếp nhận. Đã thử bằng API với cả 8 tài khoản: đăng nhập, chuyến của tài xế và hộ tống, báo giá, doanh thu, quản lý duyệt đơn mới, tài xế ghi mốc |
| 0.3 | Xong 11/11/2026 | 16/16 file test tích hợp đạt (174 ca), CI chạy cả 16 file trong một bước và báo mọi file lỗi. Viết lại theo mô hình đội xe: `vehicles`, `coordinator-resources`, `trips-*-checks`; `flow1` theo 3 giấy tờ bắt buộc; `flow4` theo phản hồi sự cố nhiều lần và ảnh bắt buộc; 3 file dùng `TEST_DB_*` thay socket `/tmp` và cổng cố định. Sửa 4 lỗi code lộ ra khi chạy test, xem N12 trong báo cáo. Bổ sung cùng ngày: 8 file chia theo ca (`coordinator-resources`, `flow1`, `flow2`, `flow3-read`, `flow4-tracking`, `locations`, `route-acceptance`, `vehicles`) dùng `test/checks.cjs`, ca lỗi ghi FAIL rồi chạy tiếp ca sau, cuối file liệt kê mọi ca lỗi và thoát mã 1 (đã thử bằng một ca lỗi cố ý). 8 file còn lại là một kịch bản nối tiếp, bước sau dùng dữ liệu bước trước, nên giữ nguyên. **Nên có Tiến xem lại** phần viết lại `trips-*-checks`, vì nghiệp vụ "một xe chỉ thuộc một chuyến đang hoạt động, bất kể giờ" thay cho kiểm tra trùng giờ cũ |
| 0.4 | Xong 11/11/2026 | Playwright 1.64.1 vào devDependencies của web; lệnh `test`, `test:browser`, `test:e2e`. Test E2E mới `apps/web/test/e2e/full-flow.e2e.cjs` đi 14 chặng trên web, API, MySQL thật (database tạm, bản đồ giả, không gọi mạng ngoài), đạt 3 lần liên tiếp. CI cài Chromium, chạy cả ba và tải ảnh lúc lỗi lên. **Khác kế hoạch:** 29 test cũ đã lỗi thời được chuyển vào `apps/web/test/legacy/` kèm README thay vì xóa hay viết lại; phần chúng phủ mà E2E chưa phủ ghi trong README. Chưa chạy trên CI thật vì chưa push |
| 0.5 | Xong 11/11/2026 | `pnpm build` chạy được trên Windows (nháy kép trong bộ lọc pnpm). README viết lại theo Express, JWT, MySQL, Redis: cài đặt, `db:setup`, tạo tài khoản, chạy API và web, demo, mobile, cấu hình, kiểm thử, Docker. Thêm `.env.example` ở gốc và `apps/web/.env.example`. `database/README.md` bỏ phần Firebase, ghi rõ là tài liệu cũ. **Thêm ngoài kế hoạch:** lệnh `pnpm db:create-user`, vì DB mới không có tài khoản nhân viên nào và web chỉ cho khách tự đăng ký; CI chạy lệnh này sau `db:setup`. Đã thử trên bản sao sạch của repo (cài mới, MySQL và Redis tạm): `db:setup` hai lần, tạo đủ 6 vai trò, từ chối email trùng và DB ở xa, API và Swagger chạy, quản lý đăng nhập web, điều phối thêm xe qua API, test API 194/194 và test web đạt. Chưa thử `pnpm dev:infra` vì máy đang có MySQL, Redis của Long ở cổng 3306, 6379 |
| A7 | Xong 11/11/2026 | Điều phối có menu "Phương tiện" (`/coordinator/fleet`), chuyên viên có mục "Địa điểm & trạm nghỉ". Lộ lỗi API: `/locations` trả 500 trên mọi DB dựng bằng migration vì còn truy vấn bảng `quarantine_rules` đã xóa; đã bỏ `ruleCount` ở API, web, Swagger, test tích hợp xóa bảng này để khớp DB thật. Dọn `role-workspaces.ts` để sang A3 |
| A6 | Xong 11/11/2026 | Nút "Yêu cầu bổ sung" và "Từ chối đơn" có lý do bắt buộc. E2E thêm: yêu cầu bổ sung, khách sửa và gửi lại (giữ thông tin đặt chuyến), từ chối đơn, thêm xe và điểm nghỉ từ giao diện; 19/19 chặng đạt. Chưa xem giao diện bằng mắt |
| A3 | Xong 11/11/2026 | API `/admin/accounts` (chỉ ADMIN): danh sách lọc theo vai trò, trạng thái, từ khóa; tạo nhân sự (tài xế, hộ tống kèm hồ sơ tổ lái); đổi vai trò; khóa và mở có lý do; đặt lại mật khẩu; ghi audit; không tự khóa hay tự đổi vai trò, không khóa hay đổi vai trò người đang chạy chuyến, không đổi khách thành nhân sự. Màn "Quản lý tài khoản" của Admin, dùng được ở 375 px. `role-workspaces.ts` chỉ còn phần ADMIN (vai trò khác đã có màn riêng). Test: tích hợp MySQL 7 ca, E2E thêm chặng Admin tạo tài xế, tài xế đăng nhập được, khóa thì không vào được (21/21). Đã xem trên dữ liệu thật WDP. **Hạn chế:** đặt lại mật khẩu chưa thu hồi token đang dùng, chờ A2 (`token_version`) |
| A1 | Xong 12/11/2026 | `GET /payments/config`; cờ `PAYMENT_SIMULATION_ENABLED` mặc định tắt ở production (tắt thì lệnh mô phỏng trả 404); web: nút đặt cọc, trả nốt dẫn tới VNPay (bật cả hai thì cho chọn), lỗi cấu hình thì báo lỗi chứ không đoán mô phỏng; trang kết quả quá 2 phút chưa có IPN thì hướng dẫn đối soát; mobile: tắt mô phỏng thì chuyển sang website. IPN đăng ký `https://horse-route-6oow.vercel.app/api/v1/payments/vnpay/ipn` (terminal 2ZUEUFSK). **Đã chạy một giao dịch Sandbox thật** (12/11/2026, đơn VCN-20261026-0001, thanh toán phần còn lại 11.733.792 đ, thẻ test NCB): VNPay gọi IPN về API trên Vercel (dùng chung WDP), phiên chuyển SUCCESS sau khoảng 2 phút, biên nhận `VNPAY_SANDBOX` mã 15733903, audit `VNPAY_PAYMENT` và `FULLY_PAID`, khách và quản lý nhận thông báo, màn quản lý và Doanh thu hiện đúng. Test: đơn vị 2 ca, E2E 23/23. **Lưu ý:** IPN đang do bản API trên Vercel (code của main) xử lý; sau khi merge long vào main thì cần chạy lại một giao dịch để kiểm code mới. Lệnh tra cứu `querydr` thử trả mã 99 nên chưa dùng |
| A4 | Xong 12/11/2026 | API `POST /orders/:id/cancel` theo Q2: khách tự hủy đơn chờ duyệt hoặc cần bổ sung; quản lý hủy tới trước khi xe xuất phát, lý do bắt buộc, khách đã trả tiền thì nhập số hoàn (0 tới số đã thu). Hủy xong trả xe và tổ lái, hủy phiên thanh toán đang chờ, ghi `order_refunds` và audit `CANCEL`, báo khách, quản lý, điều phối, tổ lái. Doanh thu trừ tiền hoàn trong kỳ. Web: nút hủy cho khách và quản lý (hộp lý do, ô số tiền hoàn có nút 0%, 50%, 100%), đơn đã hủy hiện số đã hoàn; bỏ nút "Từ chối đơn" bị khóa cứng của điều phối (chỉ quản lý hủy). Mobile: khách hủy đơn chờ duyệt, cần bổ sung. Migration `OrderRefunds` đã chạy trên WDP (Long đồng ý). Test: tích hợp 4 ca, E2E 23/23 (khách hủy, quản lý hủy có lý do), mobile 70/70. **Chưa:** E2E chưa đi nhánh hoàn tiền trên giao diện (API đã test); màn mobile chưa xem trên máy thật |
| A5 | Xong 12/11/2026 | Quản lý chuyển chuyến cho tài xế: khách chưa trả đủ tiền cọc của báo giá đã duyệt thì API trả 409 `DEPOSIT_REQUIRED`, trừ khi quản lý nêu lý do ngoại lệ (5-255 ký tự, audit `START_WITHOUT_DEPOSIT`). Bước kiểm tra sẵn sàng trả thêm tình trạng cọc; màn quản lý báo trước và mở hộp bắt nhập lý do. Biên nhận thủ công của quản lý dùng chung hàm `settleReceipt` với thanh toán trực tuyến: đủ cọc thì đơn sang PREPARING, trả đủ thì ghi audit và báo tổ lái, báo khách, phát socket. Test: flow3 (409 khi thiếu cọc, lý do quá ngắn 400, có lý do thì chuyển và ghi audit), test quản lý (biên nhận cọc đổi trạng thái, báo khách), E2E 22/22 (hộp lý do hiện khi thiếu cọc). **Khác kế hoạch:** đơn vẫn sang PREPARING khi điều phối gửi kế hoạch; chặn tiền đặt ở bước chuyển chuyến nên đủ an toàn |
| A2 (phần email, phiên) | Xong 11/11/2026 | Gửi email qua Gmail SMTP (nodemailer, mật khẩu ứng dụng). Đăng ký: có SMTP thì tài khoản chờ xác minh, nhập mã 6 số gửi qua email mới vào được; chưa có SMTP thì kích hoạt ngay như cũ. Quên mật khẩu trên web và mobile: mã một lần, hạn 15 phút, sai 5 lần thì hết hiệu lực, gửi lại sau 60 giây, câu trả lời không lộ email nào có tài khoản. `token_version` thu hồi mọi phiên khi đổi, đặt lại mật khẩu hoặc bị khóa (cả socket). Admin tạo nhân sự thì nhân sự nhận email báo (không kèm mật khẩu). Migration `AuthCodes` đã chạy trên WDP (Long đồng ý). Test: tích hợp 8 ca, E2E 22/22 (đăng ký nhập mã, quên mật khẩu), mobile 70/70. **Chưa:** thử gửi Gmail thật (chờ nhóm điền SMTP), xem màn mobile trên máy thật, refresh token và khóa tạm sau nhiều lần đăng nhập sai |
| A2 (khóa đăng nhập) | Xong 12/11/2026 | Sai mật khẩu 5 lần trong 15 phút thì tài khoản tạm khóa đăng nhập (API 403 `LOGIN_LOCKED`, câu báo số phút còn lại và gợi ý "Quên mật khẩu"); trong lúc khóa không kiểm tra mật khẩu nên không dò được. Mở khi lần sai cũ nhất qua 15 phút, khi tự đặt lại mật khẩu qua email, hoặc khi Admin đặt lại mật khẩu; đăng nhập đúng giữa chừng xóa bộ đếm. Lần sai ghi `audit_logs` (`LOGIN_FAILED`, `LOGIN_RESET`) nên **không cần migration** và Admin xem được dấu vết. Email không có tài khoản không ghi gì (giới hạn 30 lần/phút theo IP của N15 vẫn chặn). Web và app hiện đúng câu báo của API, không phải sửa giao diện. Test: tích hợp `auth-email.mysql.cjs` thêm 1 ca (9/9). **Lưu ý:** câu báo khóa cho biết email có tài khoản; chấp nhận để người dùng hiểu vì sao không vào được. Refresh token vẫn chưa làm (dời sau bảo vệ) |
| N15 | Xong 11/11/2026 | Giới hạn request theo tài khoản (300/phút), theo IP 1000/phút, đăng nhập 30/phút theo IP; web không đăng xuất khi 429, lỗi máy chủ, mất mạng mà thử lại và hiện màn Thử lại. Test: API 197/197 (thêm ca nhiều tài khoản chung IP và chặn dò mật khẩu), web thêm `auth-errors.cjs`, E2E 20/20. Đã thử trên dữ liệu thật (WDP): mở liền 16 màn của 6 vai trò không lỗi; giả lập 429 giữ phiên, 401 vẫn đăng xuất |
| B2 | Xong 11/11/2026 | Hàm `depositTimeLeft` trong `live-domain.ts`: đã cọc đủ thì không còn đếm ngược. Test mobile 69/69. Chưa thử trên máy thật |
| B6 | Xong 11/11/2026 | Bảng lịch sử tài xế, hộ tống cuộn ngang trong thẻ. E2E thêm chặng đo trang ở 375 px: mã cũ rộng 885 px (lỗi), mã mới không tràn; E2E 20/20 |
| B1 | Xong 11/11/2026 | Làm sớm khi test E2E bắt được: thêm `q.subtotal` vào truy vấn báo giá của khách |
| B5 + điều phối tự động | Xong 12/11/2026 | Làm theo `docs/ke-hoach-dieu-phoi-tu-dong-12-11-2026.md` (Long chốt H1–H6). Trang lập kế hoạch tự lập lộ trình: tra tọa độ hai đầu từ đơn, giờ xuất phát theo ngày và khung giờ khách chọn, điểm nghỉ sau khoảng 3h30 (trễ nhất 4h), nghỉ qua đêm khi quá 10 giờ lái/ngày, giờ đến = lái × 1,25 + bốc ngựa + nghỉ + cửa khẩu + 1 giờ dự phòng. Đơn sang Trung Quốc, Thái Lan tự chèn cửa khẩu (5 cửa khẩu Trung Quốc, 3 hành lang qua Lào, Campuchia sang Thái Lan); tài xế check-in "đã đến" và "đã qua" cửa khẩu, khách thấy trạng thái cửa khẩu. B5: chặn gửi duyệt và duyệt khi lái liên tục quá 6 giờ (409 `REST_RULE`), cảnh báo khi quá 4 giờ. Không có migration. Tối 12/11 đã thử trên giao diện với bản đồ thật (trong nước, Trung Quốc, cả 3 hành lang Thái Lan, check-in cửa khẩu, màn khách) và sửa 12 lỗi tìm được, trong đó có tuyến trong nước bị bản đồ cho đi tắt qua Lào. Chi tiết và phần chưa làm ở mục "Tiến độ thực hiện" của kế hoạch điều phối |
| B4 | Xong 12/11/2026 | Ô phụ của thẻ "Đã chạy" trên màn tài xế (web `trip-phase.ts`, app `trip-stats.ts`, cùng quy tắc) không còn lấy giờ giao của cả chặng làm "nghỉ tiếp sau" (trước hiện "71 giờ 59"). Chuyến theo lộ trình có điểm nghỉ: đếm ngược tới lần nghỉ trễ nhất, 4 giờ tính từ lần nghỉ gần nhất (check-in điểm nghỉ hoặc tới cửa khẩu; phía "đã qua cửa khẩu" không tính) hoặc từ lúc xuất phát; lái liên tục quá 4 giờ thì cảnh báo "cần nghỉ". Không còn điểm nghỉ phía trước thì hiện "tới nơi dự kiến HH:mm" hoặc "trễ X so với giờ đến dự kiến". Chưa xuất phát thì hiện giờ xuất phát dự kiến. Test: web `trip-phase.cjs` thêm 5 ca, mobile thêm 1 ca (71/71). **Chưa:** xem trên máy Android thật |
| B13 | Xong 12/11/2026 (thiếu 2 phần, xem cuối dòng) | Thông tin thông quan lưu trong `booking_details` (`customsCode` số tờ khai hải quan, `importPermit` giấy phép nhập khẩu, `border` cửa khẩu dự kiến), **không có migration**. (1) Đặt đơn quốc tế trên web và app có mục "Thông quan (không bắt buộc, có thể bổ sung sau)": chọn cửa khẩu theo nước nhận (Trung Quốc: Hữu Nghị, Móng Cái, Lào Cai, Tà Lùng, Thanh Thủy; Thái Lan: Lao Bảo, Cầu Treo, Mộc Bài, khớp hành lang tự lập lộ trình) hoặc "Để điều phối chọn", nhập số tờ khai, số giấy phép. (2) API `PUT /orders/:id/customs`: khách (đơn của mình), chuyên viên, quản lý bổ sung, sửa từ khi gửi đơn tới khi xe đang chạy; chỉ chuyến quốc tế; ghi audit `UPDATE_CUSTOMS`, báo điều phối viên phụ trách. Thẻ "Thông quan" ở chi tiết đơn của khách (web, app) và màn chuyên viên. (3) Quản lý chuyển chuyến cho tài xế: chuyến quốc tế chưa có số tờ khai thì API trả 409 `CUSTOMS_REQUIRED`, trừ khi nêu lý do (5-255 ký tự, audit `START_WITHOUT_CUSTOMS`), giống A5; bước kiểm tra sẵn sàng trả thêm `customs`; hộp lý do của quản lý gộp cả thiếu cọc và thiếu tờ khai. (4) Màn chuyến của tài xế (web, app) có mục "Giấy tờ thông quan": số tờ khai, giấy phép, cửa khẩu, hộ chiếu từng con ngựa, nhắc bộ giấy cần mang. Thêm: danh sách điểm ở màn duyệt của quản lý ghi đúng "Đến cửa khẩu"/"Qua cửa khẩu" thay vì "Điểm nghỉ". Test: tích hợp MySQL mới `order-customs.mysql.cjs` 3 ca (quyền, trạng thái, chặn chuyển chuyến, tài xế thấy mã), Swagger 100 route, mobile 72/72, E2E 23/23; đã thử trên giao diện web (DB tạm): khách bổ sung số tờ khai, lưu, đơn trong nước không có mục này. **Chưa làm:** tài xế mở file giấy tờ ngựa ở chặng cửa khẩu (cần API cho tài xế xem giấy tờ, hiện tài xế chưa có quyền); E2E chưa có luồng đơn quốc tế (đã có test tích hợp API). **Cần Long xác nhận nghiệp vụ:** bộ giấy tài xế mang qua cửa khẩu (đang ghi: tờ khai đã thông quan, chứng nhận kiểm dịch xuất khẩu, giấy phép nhập khẩu, hộ chiếu ngựa). **Ghi chú test:** khi chạy cả 21 file MySQL một lượt, `pricing.mysql.cjs` lỗi một lần rồi đạt 3 lần chạy lại (file này không đổi trong đợt này), nghi lỗi chập chờn theo thời gian |
| C4 | Xong một phần 12/11/2026 | Gỡ khỏi git (tệp trên máy vẫn giữ): `.idea/` (9 tệp), `database/__pycache__/*.pyc`, `package-lock.json` ở gốc (rỗng, dự án dùng pnpm; `apps/mobile/package-lock.json` vẫn giữ). `.gitignore` thêm `.idea/`, `__pycache__/`, `*.pyc`, `/package-lock.json`, `backups/*` trừ `backups/wdp_before_trip_fleet_20261028.sql` (vẫn là nguồn của `pnpm db:local` theo cập nhật 11/11). Đã kiểm `ca.pem`: chứng chỉ CA công khai của dự án Aiven (chỉ có `BEGIN CERTIFICATE`, không có khóa riêng, hạn 2036), giữ lại. Rà toàn repo không còn tệp nén, log, tệp tạm. **Chưa làm, chờ Long (Q6):** xóa file backup khỏi lịch sử git (phải force-push, cả nhóm clone lại) và kiểm tra 5 địa chỉ Gmail trong file backup có phải email thật không. **Lưu ý cho nhóm:** người đang dùng IntelliJ/Android Studio kéo commit này về thì thư mục `.idea/` trên máy họ bị xóa theo; mở lại IDE sẽ tự tạo lại |
| D3 | Xong 12/11/2026 | Theo Q4 (không cho khách xem GPS thật): viết [quyet-dinh-gps-khach-hang.md](quyet-dinh-gps-khach-hang.md) gồm quyết định, 4 lý do (riêng tư tổ lái, an toàn hàng giá trị cao, tránh hiểu lầm do GPS chập chờn, khách vẫn đủ thông tin qua mốc, điểm nghỉ, cửa khẩu, giờ đến), cách code thực hiện, hướng mở nếu sau này đổi ý, câu trả lời khi hội đồng hỏi. Đã đọc code xác nhận: bản đồ của khách không đọc `trip_positions`, `latestPosition` luôn null. Test `flow4-tracking.mysql.cjs` thêm assertion: tài xế đã gửi GPS mà bản đồ của khách vẫn chỉ có vị trí ước tính, không lộ tọa độ (26/26) |

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

### Long trả lời ngày 11/11/2026

| # | Trả lời | Áp dụng |
| --- | --- | --- |
| Q1 | Có khóa VNPay Sandbox và địa chỉ API công khai. Long tự đặt khóa vào `.env` | A1 làm đủ: giao dịch sandbox thật qua IPN, mô phỏng tắt ở production |
| Q2 | Theo đề xuất | A4: trước khi duyệt khách tự hủy; sau khi duyệt, trước khi xuất phát quản lý hủy, nhập mức hoàn cọc và lý do; đang chạy không hủy |
| Q3 | Có, quản lý được ngoại lệ có lý do | A5 theo đề xuất |
| Q4 | Không cho khách xem GPS thật | D3: giữ mốc hành trình, ghi lý do trong tài liệu (riêng tư tổ lái, an toàn hàng giá trị cao) |
| Q5 | Ngựa nghỉ sau mỗi 3 đến 6 giờ chạy liên tục, nghỉ 30 phút rồi đi tiếp | B5: chạy liên tục quá 3 giờ chưa có điểm nghỉ thì cảnh báo; quá 6 giờ thì chặn gửi duyệt; điểm nghỉ tối thiểu 30 phút. Ba con số là tham số hệ thống |
| Q6 | Long hỏi lại lý do, chưa quyết | Xem giải thích ở dưới. Đề xuất trước bảo vệ: chỉ xóa file bằng commit mới, chưa ghi đè lịch sử |
| Q7 | Chỉ Android | D4 không làm iOS, nói rõ phạm vi khi bảo vệ |
| Q8 | Khoảng 7 ngày nữa ra hội đồng (khoảng 18/11/2026) | Không đủ cho cả kế hoạch (29–42 ngày công). Làm theo mục "Phạm vi 7 ngày" dưới đây |

**Vì sao Q6 hỏi về file backup.** `backups/wdp_before_trip_fleet_20261028.sql` là bản sao DB đã nằm trên GitHub (nhánh `main` và các nhánh khác, từ commit `3f54b9d` ngày 29/10/2026). Trong đó có bảng `users` với chuỗi băm mật khẩu và địa chỉ email: phần lớn là email giả `@wdp.example`, nhưng có 5 địa chỉ Gmail và vài tên miền trông như thật. Ai clone repo cũng đọc được. Nếu đó là email thật của người trong nhóm hay khách thật, đây là lộ dữ liệu cá nhân và hội đồng có thể hỏi. Xóa file bằng commit mới chỉ làm nó biến mất ở bản hiện tại, lịch sử git vẫn giữ. Muốn mất hẳn phải viết lại lịch sử và force-push, cả nhóm phải clone lại, dễ mất việc của người khác. Một tuần trước bảo vệ thì không nên làm. Đề xuất: (1) xóa file và thêm `backups/` vào `.gitignore` bằng commit thường (C4); (2) nếu 5 Gmail là thật thì đổi mật khẩu các tài khoản đó trên DB chung; (3) để việc viết lại lịch sử sau bảo vệ, hoặc không làm nếu email là giả.

### Phạm vi 7 ngày

Ưu tiên thứ hội đồng thấy khi demo và hỏi. Mỗi việc vẫn có test và commit riêng.

| Ngày | Việc | Lý do |
| --- | --- | --- |
| 1 | A7 màn xe và địa điểm; A6 quản lý từ chối, yêu cầu bổ sung; B2, B6 | Lỗ hổng thấy ngay khi bấm demo, sửa nhỏ |
| 2 | A3 màn Admin tạo, khóa tài khoản nhân sự | Hiện phải dùng lệnh dòng lệnh để có nhân viên |
| 3 | A5 ép đặt cọc; A4 hủy đơn và hoàn cọc | Câu hỏi nghiệp vụ hội đồng hay hỏi |
| 4 | A1 VNPay Sandbox thật, tắt mô phỏng ở production | Thanh toán thật là điểm nhấn demo |
| 5 | B13 thông tin thông quan chuyến quốc tế (Long thêm 12/11); B5 quy tắc nghỉ cho ngựa theo Q5; B4 | Nghiệp vụ đặc thù của đề tài |
| 6 | B8 câu chữ; phần giới hạn đăng nhập của A2; C4 dọn repo; D3 ghi tài liệu | Đánh bóng, giảm câu hỏi bảo mật |
| 7 | Không thêm tính năng: chạy lại toàn bộ test, seed demo, tập kịch bản demo trên web và điện thoại Android | Đóng băng trước bảo vệ |

Dời sau bảo vệ: phần còn lại của A2 (refresh token, quên mật khẩu), B3, B7, B9–B12, C1–C3, C5, D1, D2, D4–D6, E, F. Khi hội đồng hỏi, trả lời theo báo cáo đánh giá và kế hoạch này.

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
| B13 | Long đề xuất 12/11/2026 | Thông tin thông quan cho chuyến quốc tế. Hiện `booking_details` đã có `customsCode`, `importPermit`, `border` (API nhận) nhưng không màn nào nhập hay hiện. Làm: (1) đặt đơn quốc tế cho nhập không bắt buộc mã thông quan (số tờ khai hải quan), số giấy phép nhập khẩu, cửa khẩu dự kiến, ghi "có thể bổ sung sau" vì số tờ khai thường chỉ có sau khi có giấy kiểm dịch; (2) sau khi duyệt, khách hoặc chuyên viên bổ sung, sửa ở chi tiết đơn (web, mobile); (3) đơn quốc tế thiếu mã thông quan thì chặn quản lý chuyển chuyến cho tài xế, có ngoại lệ kèm lý do như A5; (4) màn chuyến của tài xế hiện mã thông quan, giấy phép nhập khẩu và lối mở giấy tờ ngựa ở chặng qua cửa khẩu. **Cần xác nhận nghiệp vụ:** bộ giấy tài xế cần mang qua cửa khẩu (tờ khai đã thông quan, chứng nhận kiểm dịch xuất khẩu, giấy phép nhập khẩu, hộ chiếu ngựa) | Đơn quốc tế đặt được khi chưa có mã; thiếu mã thì không chuyển chuyến nếu không có lý do; tài xế thấy mã ở chặng cửa khẩu; test API và E2E |

## 7. Giai đoạn C: Triển khai

- **C1 (P1-5).** Thêm khối `location /socket.io/` có `Upgrade` vào `docker/nginx/default.conf`.
- **C2 (P1-5).** Thêm `app.set('trust proxy', 1)`, đưa số hop vào biến môi trường để không bị giả IP.
- **C3 (P1-5).** Thêm volume cho kho file. Hoặc dùng Redis làm kho cho rate limit, hoặc bỏ Redis khỏi điều kiện khởi động.
- **C4 (P2-4).** Phụ thuộc Q6. **Cập nhật 11/11/2026:** Aiven không truy cập được, `backups/wdp_before_trip_fleet_20261028.sql` thành nguồn của bản sao database (`pnpm db:local`, `docs/db-local-copy.md`), nên giữ file này cho tới khi nhóm có database chung mới. Gỡ phần còn lại của `backups/`, `.idea/`, `database/__pycache__/`, `package-lock.json` ở gốc khỏi git, thêm vào `.gitignore`. Kiểm tra `ca.pem` là chứng chỉ công khai. Xử lý lịch sử nếu Q6 đồng ý.
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
