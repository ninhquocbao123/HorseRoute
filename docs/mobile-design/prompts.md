# Bộ prompt Claude Code — Thiết kế mobile app Vận chuyển ngựa

Oct 29, 2026 · @Long

> Bản đã sửa ngày 29/10/2026 theo plan đã duyệt: chốt màu và font theo web hiện tại, thêm quy tắc chống phong cách AI, chỉ xuất HTML (Figma MCP không kết nối được), chỉ sẵn nguồn đọc trong repo, thêm nhóm review "Bản sắc". Các chỗ sửa đánh dấu [SỬA].

## Cách dùng bộ prompt

Chạy 8 prompt theo đúng thứ tự, mỗi prompt là một giai đoạn; đọc và duyệt kết quả trước khi sang prompt tiếp theo. Design system được đặt trước UI chi tiết, vì UI phải dựng từ token và component có sẵn thì mới nhất quán.

1. Prompt 0 — Bối cảnh & quy tắc (chạy một lần, Claude Code lưu thành file context)
2. Prompt 1 — Kiểm kê dữ liệu từ codebase
3. Prompt 2 — Ý tưởng & danh sách screen
4. Prompt 3 — User flow
5. Prompt 4 — Wireframe
6. Prompt 5 — Design system
7. Prompt 6 — UI chi tiết
8. Prompt 7 — Review

Mẹo khi chạy:

- Mở Claude Code ở thư mục gốc repo HorseRoute. Mọi kết quả nằm trong `docs/mobile-design/`, không sửa code web/backend.
- Prompt 1–3 nên chạy ở chế độ Plan (Shift+Tab) nếu bạn muốn xem kế hoạch trước.
- Giữa các giai đoạn có thể `/clear` cho nhẹ context; file context ở Prompt 0 và các file output giúp Claude Code nối mạch.
- Chỗ nào trong ngoặc vuông `[...]` là chỗ bạn tự điền.
- [SỬA] Wireframe và UI chỉ xuất HTML xem trên trình duyệt. Nếu sau này cần Figma, dựng plugin từ bản HTML đã chốt.

## Prompt 0 — Bối cảnh dự án & quy tắc thiết kế

Prompt này tạo file `docs/mobile-design/00-context.md` — "luật chơi" mà mọi prompt sau đều đọc lại.

```text
Bạn là Senior Mobile Product Designer kiêm React Native engineer, am hiểu Apple Human Interface Guidelines và Material Design 3.

NHIỆM VỤ GIAI ĐOẠN NÀY: tạo file docs/mobile-design/00-context.md chứa toàn bộ bối cảnh và quy tắc dưới đây, viết gọn, rõ. Đây là file nguồn sự thật cho mọi giai đoạn thiết kế sau. KHÔNG sửa bất kỳ file code nào.

## 1. Dự án
- Sản phẩm: nền tảng vận chuyển ngựa (HorseRoute). Đã có web React + TypeScript, backend Express + MySQL.
- Mục tiêu: thiết kế mobile app MVP cho 3 actor, chưa code app.

## 2. Quyết định công nghệ (đã chốt, không đề xuất thay)
- Mobile: React Native + Expo development build, dùng chung Android/iOS, TypeScript.
- Backend: giữ Express + MySQL và API hiện có.
- Tái sử dụng: kiểu dữ liệu, trạng thái nghiệp vụ, logic, API. Viết lại giao diện mobile.
- Bổ sung: SQLite lưu offline, FCM cho push, token lưu bằng Keychain/Keystore (expo-secure-store).

## 3. Phạm vi MVP
- Chủ ngựa (customer): hồ sơ ngựa, gửi yêu cầu vận chuyển đơn giản, xem đơn/báo giá, theo dõi vị trí, nhận thông báo.
- Tài xế (driver): xem chuyến được giao, checklist, cập nhật mốc chặng, GPS nền, báo sự cố kèm ảnh.
- Người hộ tống (escort): xem danh sách ngựa, ghi nhật ký chăm sóc/sức khỏe, chụp ảnh, báo bất thường.
- Ngoài phạm vi: các chức năng admin/điều phối và mọi thứ không liệt kê ở trên. Nếu thấy cần, ghi vào mục "Đề xuất sau MVP", không thiết kế.

## 4. Bối cảnh sử dụng từng actor (ảnh hưởng trực tiếp tới thiết kế)
- Customer: dùng lúc rảnh, cần cảm giác tin cậy, sang, minh bạch về giá và vị trí ngựa.
- Driver: dùng khi đang lái/dừng xe, ngoài trời, nắng gắt, có thể đeo găng, sóng yếu. → Vùng chạm lớn (≥56pt cho hành động chính), tương phản cao, ít thao tác, không nhập liệu dài, hoạt động offline.
- Escort: thao tác một tay trong chuồng/thùng xe, tay kia giữ ngựa. → Nhập nhanh bằng chọn sẵn (chip, stepper), chụp ảnh 1 chạm, lưu nháp tự động, offline.

## 5. Quy tắc thiết kế bắt buộc
- Ngôn ngữ UI: tiếng Việt, dấu đầy đủ; font Be Vietnam Pro (đã chốt, giống web). [SỬA]
- Lưới 8pt (bước nhỏ 4pt). Lề ngang màn hình 16pt, dùng xuyên suốt. Tôn trọng Safe Area.
- Typography: tối đa 1 font, ≤4 cỡ chữ mỗi màn hình, body ≥16pt; phân cấp bằng độ đậm và màu. Hỗ trợ phóng to chữ hệ thống.
- Màu: quy tắc 60-30-10, đúng MỘT màu nhấn cho hành động; thang xám có hệ thống; màu ngữ nghĩa (thành công/cảnh báo/lỗi/thông tin); tương phản chữ ≥4.5:1; không truyền nghĩa chỉ bằng màu. Có light và dark mode.
- Mỗi màn hình MỘT hành động chính; nút Primary / Secondary / Tertiary rõ cấp.
- Vùng chạm ≥44×44pt (driver ≥56pt), cách nhau ≥8pt. Hành động chính ở nửa dưới (thumb zone), nút chính cố định đáy khi cần.
- Điều hướng: tab bar 3–5 tab có icon + nhãn; mỗi actor một bộ tab riêng; back ở góc trái, vuốt cạnh để quay lại; bottom sheet cho tác vụ tạm thời.
- Icon: một bộ duy nhất (đề xuất Lucide/Phosphor), cùng nét, khung 24pt; outline = thường, filled = đang chọn.
- Bo góc theo hệ (8 / 12–16 / 20–24), bo góc đồng tâm; bóng mềm, opacity thấp.
- Mỗi màn hình phải có đủ trạng thái: bình thường, trống, đang tải (skeleton), lỗi, offline/đang chờ đồng bộ, dữ liệu dài/bất thường.
- Chuyển động 150–300ms, spring/ease-out; phản hồi chạm tức thì; haptic cho hành động quan trọng; tôn trọng Reduce Motion.
- UX writing: nút là động từ cụ thể ("Xác nhận đã lấy ngựa", không phải "OK"); lỗi nói rõ cách khắc phục; thuật ngữ thống nhất với web.
- Xin quyền (vị trí nền, camera, thông báo) đúng lúc cần, có màn giải thích trước.
- Trợ năng: mọi icon/nút có nhãn cho VoiceOver/TalkBack.

## 5b. Bản sắc thương hiệu (đã chốt, lấy từ web hiện tại) [SỬA]
Nguồn: apps/web/src/features/home/landing-page.css (:root), apps/web/src/features/tracking/driver/driver-shell.css (--drs-*), apps/web/src/features/customer/customer.css.
Bỏ qua bộ xanh rừng #193e32 trong apps/web/src/styles/theme-tokens.ts: đó là token cũ, chỉ còn dùng cho Ant Design mặc định.
- brand #0b3b42, brand2 #14606a (header, tab đang chọn, nền đậm). Dark: surface #0c2326.
- accent DUY NHẤT cho hành động chính: vàng #f4b942, chữ trên nút #2b1a00 (9.5:1). Không dùng vàng làm chữ trên nền sáng (1.8:1); chữ/link vàng dùng #a86a00 và chỉ khi ≥18pt đậm.
- bg #f6faf9 / #061416; surface #ffffff / #0c2326; textPrimary #0d2a2e / #e8f4f4; textSecondary #546d71 / #96b4b7; border #d8e6e6 / #1a3a3e; surfaceMuted #e7f1f1 / #08191b.
- Ngữ nghĩa (gốc từ driver-shell.css, Prompt 5 tinh chỉnh tương phản): success #166534, danger #dc2626, warning #ca8a04.
- 60–30–10: 60% nền sáng, 30% teal, 10% vàng (một nút chính mỗi màn).
- Logo: apps/web/public/brand/horse-transport-logo.png. Bo góc như web: 12 cho control/nút, 16–20 cho card.

## 5c. Chống phong cách "AI" (bắt buộc) [SỬA]
- Không gradient tím/xanh dương, không mesh, glassmorphism, glow. Gradient duy nhất được phép: teal #0b3b42 → #14606a, chỉ ở thẻ chuyến đang chạy của customer.
- Không emoji trong UI, không icon sparkle/robot. Một bộ icon nét duy nhất: Lucide.
- Không màu ngoài token. Màu tím #5b4bb0 đang dùng cho trạng thái "nghỉ" ở apps/web/src/features/tracking/escort/escort.css phải thay bằng teal nhạt + icon.
- Không bố cục template: không lưới 3 thẻ tính năng giống nhau, không tiêu đề quảng cáo kiểu "Trải nghiệm thông minh", không lời chào kèm emoji.
- Nội dung là trung tâm: chữ lớn nhất trên màn là thông tin người dùng cần nhất (VD driver: điểm đến tiếp theo + giờ).
- Mật độ như app vận hành thật: list gọn, số liệu rõ, ít card lồng card; phân tách bằng đường kẻ border và khoảng trắng; bóng gần như không có.
- Ảnh ngựa: ảnh thật trong apps/web/src/assets/ hoặc placeholder trung tính; không minh họa 3D.

## 5d. Nguồn tham khảo có sẵn trong web [SỬA]
Web đã có UI dạng mobile cho driver và escort; kế thừa flow và thuật ngữ thay vì nghĩ lại:
- Driver: apps/web/src/features/tracking/driver/ (DriverShell.tsx, trip-phase.ts, driver-ui.ts, PreDepartureChecklist.tsx, SeverityPicker.tsx, DamageTargetChips.tsx, IncidentReportPage.tsx, useGpsSharing.ts, StopTimeline.tsx).
- Escort: apps/web/src/features/tracking/escort/ (QuickLogCard.tsx, care-ui.ts, HorseCareCard.tsx, CareHistoryList.tsx).
- Customer: apps/web/src/features/customer/ (CustomerWorkspace.tsx, CustomerJourney.tsx, HorseProfiles.tsx, CustomerOrders.tsx), apps/web/src/features/tracking/customer/.
- Đường xuất trực quan: chỉ HTML (Figma MCP không kết nối được).

## 6. Quy ước làm việc
- Mọi output ghi vào docs/mobile-design/, đánh số theo giai đoạn (01-, 02-, ...).
- Không đoán dữ liệu: mọi trường dữ liệu phải truy được về file code thật (đường dẫn + tên). Thiếu thì ghi vào mục "Khoảng trống dữ liệu".
- Kết thúc mỗi giai đoạn: tóm tắt 5 dòng + danh sách câu hỏi cần tôi quyết, rồi DỪNG chờ tôi duyệt.

Sau khi tạo file, thêm một dòng vào CLAUDE.md (tạo nếu chưa có): "Khi làm việc về thiết kế mobile, luôn đọc docs/mobile-design/00-context.md trước."
```

## Prompt 1 — Kiểm kê dữ liệu cho mobile

Kết quả: `01-data-inventory.md` — bản đồ dữ liệu thật mà các màn hình sẽ dùng, kèm những gì backend còn thiếu.

```text
Đọc docs/mobile-design/00-context.md trước.

NHIỆM VỤ: đọc toàn bộ codebase hiện tại (web frontend + backend) và lập bản kiểm kê dữ liệu phục vụ thiết kế mobile MVP. CHỈ ĐỌC, không sửa code. Ghi kết quả vào docs/mobile-design/01-data-inventory.md.

Gợi ý nguồn đọc [SỬA]: backend Express ở apps/api/src (features/*, database/migrations, routes/index.ts, shared/middlewares/auth.middleware.ts); type dùng chung ở packages/shared; web ở apps/web/src (features/*, modules/trips, modules/coordinator); tài liệu ở docs/ (đặc biệt role-workspaces.md, ke-hoach-flow4-tracking.md, ke-hoach-ban-do-gps.md, implementation-status.md); dữ liệu mẫu ở apps/api/scripts/seed-flow4-demo.cjs. Lưu ý README gốc còn ghi NestJS + Firebase là thông tin cũ; kiểm tra cơ chế xác thực thật trong code (đã có migration DropFirebaseUid).

Cách làm:
1. Khảo sát cấu trúc repo: liệt kê thư mục chính, nơi đặt model/schema MySQL, migration, route Express, controller, type TypeScript dùng chung, service gọi API ở web, hằng số trạng thái/enum.
2. Thực thể dữ liệu: với mỗi bảng/entity liên quan tới customer, driver, escort (người dùng, ngựa, đơn/yêu cầu vận chuyển, báo giá, chuyến, chặng/mốc, xe, checklist, sự cố, nhật ký chăm sóc/sức khỏe, ảnh/tệp, thông báo, vị trí GPS...) lập bảng: Tên trường | Kiểu | Bắt buộc? | Ý nghĩa nghiệp vụ | Ví dụ giá trị | File nguồn.
3. Trạng thái nghiệp vụ: liệt kê mọi enum/status (trạng thái đơn, chuyến, báo giá, sự cố...), vẽ state machine bằng Mermaid stateDiagram: ai (actor nào) được chuyển trạng thái nào, điều kiện gì.
4. API: bảng endpoint liên quan 3 actor: Method | Path | Actor/quyền | Input | Output chính | Phân trang? | File nguồn. Ghi rõ cơ chế xác thực hiện tại (JWT/session/refresh token).
5. Phân quyền: mỗi actor xem/sửa được dữ liệu nào.
6. Ánh xạ chức năng MVP → dữ liệu: với TỪNG chức năng trong phạm vi MVP của 3 actor, ghi: dữ liệu cần hiển thị, dữ liệu cần nhập, endpoint dùng, trạng thái liên quan, và mức sẵn sàng: Đủ / Thiếu một phần / Chưa có.
7. Khoảng trống dữ liệu cho mobile: những gì backend chưa hỗ trợ nhưng mobile cần, ví dụ: lưu device token FCM, nhận vị trí GPS theo lô (batch), upload ảnh nhiều tấm/nén, đồng bộ offline (updatedAt, id tạo từ client, xử lý xung đột), refresh token, phân trang. Mỗi mục: mô tả, mức độ cần thiết (Bắt buộc MVP / Nên có), đề xuất thay đổi API (chỉ đề xuất, không code).
8. Dữ liệu cần lưu offline (SQLite) cho driver và escort: bảng nào, trường nào, chiều đồng bộ (tải về / gửi lên / hai chiều).
9. Thuật ngữ: bảng thuật ngữ tiếng Việt đang dùng trên web cho từng khái niệm, để mobile dùng đúng từ.
10. Dữ liệu mẫu: tìm seed/fixture có sẵn; nếu không có, đề xuất một bộ dữ liệu mẫu thực tế (tên ngựa, địa điểm Việt Nam, giá VND) để dùng khi vẽ UI.

Yêu cầu: mọi khẳng định phải có đường dẫn file. Chỗ nào không chắc ghi "CẦN XÁC NHẬN". Cuối file: tóm tắt 5 dòng + câu hỏi cho tôi. Sau đó DỪNG.
```

## Prompt 2 — Ý tưởng & danh sách screen theo 3 actor

Kết quả: `02-screens.md` — cấu trúc điều hướng, danh sách màn hình và ý tưởng thiết kế cho từng actor.

```text
Đọc docs/mobile-design/00-context.md và 01-data-inventory.md trước.

NHIỆM VỤ: từ dữ liệu đã kiểm kê, lên kiến trúc thông tin và danh sách screen cho customer, driver, escort. Ghi vào docs/mobile-design/02-screens.md. Không sửa code.

1. Phần chung: splash, đăng nhập, quên mật khẩu, chọn/nhận diện vai trò sau đăng nhập, màn xin quyền (vị trí, camera, thông báo), trung tâm thông báo, hồ sơ & cài đặt, trạng thái offline/đồng bộ toàn cục. Nêu rõ xác định vai trò lấy từ dữ liệu nào.

2. Với MỖI actor:
   a. Persona ngắn (3 dòng): họ là ai, dùng app trong hoàn cảnh nào, mục tiêu, nỗi lo lớn nhất.
   b. Top 3 "job to be done" quan trọng nhất.
   c. Cấu trúc tab bar (3–5 tab): tên tab, icon đề xuất, lý do.
   d. Bảng screen: Mã (VD: CUS-01) | Tên screen | Mục đích (1 câu) | Hành động chính duy nhất | Dữ liệu hiển thị (trường cụ thể từ 01) | Dữ liệu nhập | Endpoint | Kiểu trình bày (màn đầy đủ / bottom sheet / modal) | Cần offline? | Độ ưu tiên (P0/P1).
   e. Ý tưởng thiết kế nổi bật cho actor đó, ví dụ:
      - Customer: màn đơn đang chạy kiểu "live activity" với bản đồ + timeline mốc chặng + thẻ ngựa; tạo yêu cầu vận chuyển dạng từng bước ngắn (stepper) với tóm tắt cuối; so sánh/chấp nhận báo giá rõ ràng.
      - Driver: màn "Chuyến hôm nay" với một nút hành động lớn theo ngữ cảnh (Bắt đầu chuyến → Đã tới điểm lấy → Đã giao), checklist dạng chạm lớn, nút báo sự cố luôn trong tầm tay, chỉ báo GPS/đồng bộ.
      - Escort: danh sách ngựa trên chuyến dạng thẻ có ảnh và trạng thái sức khỏe; ghi nhật ký nhanh bằng chip chọn sẵn (ăn, uống, nhiệt độ, hành vi) + ghi chú + ảnh; báo bất thường 2 chạm.
      Đây chỉ là gợi ý: hãy đề xuất dựa trên dữ liệu thật, và đưa 2 hướng khác nhau cho màn hình quan trọng nhất của mỗi actor, nêu ưu/nhược, chọn một hướng khuyến nghị.

3. Ma trận đối chiếu: mọi chức năng MVP trong 00-context.md → screen nào đáp ứng. Không được sót, không thừa screen ngoài phạm vi.

4. Thông báo push: bảng sự kiện → actor nhận → nội dung mẫu tiếng Việt → bấm vào mở screen nào (deep link).

5. [SỬA] Quyết định phạm vi đã chốt: thanh toán VNPay và hồ sơ giấy tờ của customer chỉ hiển thị trạng thái trên mobile (đã thanh toán / chờ thanh toán, giấy tờ đủ / thiếu); thao tác thanh toán và tải giấy tờ mở web. Ghi vào "Đề xuất sau MVP" nếu muốn làm native.

Cuối file: tóm tắt số screen mỗi actor, câu hỏi cần tôi quyết. DỪNG chờ duyệt.
```

## Prompt 3 — User flow

Kết quả: `03-user-flows.md` (Mermaid), tùy chọn vẽ thêm vào FigJam.

```text
Đọc docs/mobile-design/00-context.md, 01-data-inventory.md, 02-screens.md trước.

NHIỆM VỤ: vẽ user flow cho các tác vụ chính, ghi vào docs/mobile-design/03-user-flows.md bằng Mermaid flowchart. Dùng đúng mã screen (CUS-xx, DRV-xx, ESC-xx) từ 02-screens.md. Không sửa code.

Flow bắt buộc:
- Chung: mở app lần đầu → đăng nhập → điều hướng theo vai trò; token hết hạn; mất mạng giữa chừng.
- Customer: (1) tạo hồ sơ ngựa; (2) gửi yêu cầu vận chuyển → nhận báo giá → chấp nhận/từ chối; (3) theo dõi chuyến đang chạy từ push notification → xem vị trí → hoàn thành.
- Driver: (1) nhận thông báo chuyến được giao → xem chi tiết; (2) làm checklist trước chuyến → bắt đầu (bật GPS nền); (3) cập nhật từng mốc chặng đến khi giao xong; (4) báo sự cố kèm ảnh khi không có mạng.
- Escort: (1) xem ngựa trên chuyến; (2) ghi nhật ký chăm sóc/sức khỏe kèm ảnh; (3) báo bất thường → ai nhận được thông báo.

Mỗi flow phải có:
- Điểm bắt đầu (trigger), điểm kết thúc thành công.
- Nhánh lỗi và trường hợp biên: từ chối quyền vị trí/camera, GPS tắt, mất mạng (lưu SQLite → hàng chờ đồng bộ → gửi lại), upload ảnh thất bại, trạng thái đơn bị thay đổi bởi người khác, app bị tắt giữa chừng.
- Ghi trên mũi tên: hành động người dùng hoặc sự kiện hệ thống; đánh dấu bước nào gọi API nào và đổi trạng thái nghiệp vụ nào (khớp state machine ở 01).
- Đếm số bước (số lần chạm) của đường chính; nếu flow nào > 5 bước cho tác vụ thường xuyên của driver/escort, đề xuất cách rút gọn.

[SỬA] Không vẽ FigJam; Mermaid trong 03-user-flows.md là bản chính.

Cuối file: danh sách thay đổi cần cập nhật vào 02-screens.md (nếu phát hiện thiếu screen) + câu hỏi cho tôi. DỪNG chờ duyệt.
```

## Prompt 4 — Wireframe

Kết quả: wireframe xám (low-fi) cho toàn bộ screen P0, xuất HTML dạng prototype bấm được. [SỬA 29/10: Long muốn xem và thao tác trước khi thiết kế, sau đó đưa sang Figma bằng plugin html.to.design]

```text
Đọc docs/mobile-design/00-context.md, 02-screens.md, 03-user-flows.md trước.

NHIỆM VỤ: vẽ wireframe low-fidelity cho mọi screen P0 của 3 actor (sau đó đến P1 nếu tôi duyệt). Không sửa code web/backend.

Quy tắc wireframe:
- Khung iPhone 390×844pt (thêm 1 bản Android 360×800 cho 3 màn quan trọng nhất để kiểm tra màn nhỏ). Có vùng Safe Area, status bar, home indicator.
- Chỉ thang xám + 1 màu nhấn duy nhất đánh dấu hành động chính. Không ảnh thật (dùng khung gạch chéo), không trang trí.
- Nội dung thật bằng tiếng Việt lấy từ dữ liệu mẫu ở 01 (không dùng lorem ipsum), đúng trường dữ liệu đã liệt kê.
- Tuân thủ lưới 8pt, lề 16pt, vùng chạm ≥44pt (driver ≥56pt), hành động chính trong thumb zone.
- Mỗi screen P0 vẽ kèm các biến thể trạng thái: trống, đang tải (skeleton), lỗi, offline/đang chờ đồng bộ. Biến thể có thể vẽ nhỏ hơn, xếp cạnh màn chính.
- Ghi chú (annotation) bên cạnh: hành động chính, dữ liệu/endpoint dùng, hành vi đặc biệt (kéo để làm mới, vuốt, haptic...).

- Màu nhấn duy nhất trong wireframe là vàng #f4b942 (chữ #2b1a00), đúng màu nút chính đã chốt ở 00-context.md mục 5b. [SỬA]

CÁCH XUẤT [SỬA: chỉ HTML]:
HTML: tạo thư mục docs/mobile-design/wireframes/, mỗi actor một file HTML tĩnh (CSS thuần, không framework) hiển thị các khung 390×844 xếp lưới theo flow, kèm index.html liên kết tất cả. Mở được trực tiếp bằng trình duyệt.
- [SỬA] Prototype bấm được: mỗi màn là một khung 390×844; mọi nút/hàng/tab dẫn tới màn đích theo 03-user-flows.md; có chế độ "Xem tất cả màn" (lưới) và chế độ "Bấm thử" (một khung, chuyển màn khi chạm); biến thể trạng thái (trống, skeleton, lỗi, offline) chuyển bằng thanh công cụ bên ngoài khung.
- [SỬA] Dựng để chuyển sang Figma ít vỡ: layout bằng flexbox (tương ứng Auto Layout), không position absolute trừ status bar/nút cố định đáy, không pseudo-element mang nội dung, chữ thật (không ảnh chữ), mỗi màn một phần tử có id = mã screen.

Làm theo thứ tự: Driver → Escort → Customer → Common (driver/escort khó nhất về bối cảnh sử dụng). Xong mỗi actor thì dừng lại cho tôi xem trước khi làm tiếp.

Sau cùng: ghi docs/mobile-design/04-wireframes.md gồm link/đường dẫn, danh sách screen đã vẽ, quyết định bố cục quan trọng và lý do.
```

## Prompt 5 — Design system

Kết quả: token + thư viện component (tài liệu, file theme TypeScript dùng thẳng cho React Native, và bản HTML để xem).

```text
Đọc docs/mobile-design/00-context.md, 02-screens.md, 04-wireframes.md trước. [SỬA] Màu thương hiệu, font, logo đã chốt ở 00-context.md mục 5b (lấy từ web); dùng đúng các giá trị đó, ghi nguồn, không đề xuất màu mới. Tuân thủ mục 5c (chống phong cách AI).

NHIỆM VỤ: xây dựng design system cho mobile app. Không sửa code web/backend.

1. Design tokens (có light + dark):
   - Màu: 1 màu nhấn là vàng, sinh thang 50–900 từ #f4b942 (500); thang brand teal 50–900 từ #0b3b42/#14606a; thang xám 10 bậc ngả teal, neo ở #546d71 và #d8e6e6; màu ngữ nghĩa (success/warning/danger/info). Đặt tên theo vai trò (bg/surface/surfaceElevated/textPrimary/textSecondary/border/accent/onAccent...), không theo tên màu. Kiểm tra và ghi tỉ lệ tương phản cho mọi cặp chữ/nền (≥4.5:1).
   - Màu trạng thái nghiệp vụ: mỗi status đơn/chuyến/sức khỏe ngựa ở 01 được gán màu + icon + nhãn (không chỉ màu).
   - Typography: font Be Vietnam Pro (kiểm tra dấu tiếng Việt, đặc biệt ệ, ộ, ữ ở cỡ 12–13), thang theo iOS: largeTitle 34, title1 28, title2 22, title3 20, headline 17 semibold, body 17, callout 16, subhead 15, footnote 13, caption 12; kèm lineHeight, letterSpacing, weight.
   - Spacing: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
   - Radius: 8 / 12 / 16 / 24 / full. Shadow: 3 mức mềm (opacity 4–10%), dark mode dùng nền sáng hơn thay bóng.
   - Motion: duration (150/250/350ms), easing, cấu hình spring.
   - Kích thước: touchTarget 44, touchTargetLarge 56, iconSize 16/20/24.

2. Component (mỗi cái ghi: variant, size, mọi state — default/pressed/disabled/loading/error —, props dự kiến, quy tắc dùng/không dùng):
   Button (primary/secondary/tertiary/destructive, size L dành cho driver), IconButton, TextField, TextArea, Select/Picker, DateTimePicker, Chip/ChoiceChip (cho nhật ký escort), Stepper số, Checkbox/ChecklistItem cỡ lớn, Switch, Card, ListItem, HorseCard, TripCard, OrderCard, QuoteCard, StatusBadge, Timeline mốc chặng, MapView container, PhotoPicker/PhotoGrid có trạng thái upload, BottomSheet, Modal/Dialog xác nhận, Toast, Banner (offline/đồng bộ/GPS), SyncIndicator, EmptyState, ErrorState, Skeleton, TabBar, NavigationHeader (large title), SOS/IncidentButton, PermissionPrimer.

3. Output:
   - docs/mobile-design/05-design-system.md: toàn bộ token + spec component + nguyên tắc sử dụng.
   - docs/mobile-design/tokens/theme.ts: token dạng TypeScript (export lightTheme, darkTheme, typography, spacing, radius, shadow, motion), để sau này copy thẳng vào app Expo. Type chặt, không dùng any.
   - Trực quan [SỬA: chỉ HTML]: docs/mobile-design/design-system.html hiển thị bảng màu, typography, spacing và mọi component ở mọi state, có nút chuyển light/dark.

Cuối: tóm tắt + câu hỏi cho tôi (đặc biệt về thang màu sinh ra và màu ngữ nghĩa). DỪNG chờ duyệt.
```

## Prompt 6 — UI chi tiết

Kết quả: màn hình high-fidelity dựng hoàn toàn từ design system, light + dark.

```text
Đọc docs/mobile-design/00-context.md, 02-screens.md, 03-user-flows.md, 04-wireframes.md, 05-design-system.md và tokens/theme.ts trước.

NHIỆM VỤ: chuyển wireframe đã duyệt thành UI chi tiết (high-fidelity) cho mọi screen P0. Không sửa code web/backend.

Quy tắc:
- CHỈ dùng token và component trong design system. Không tự đặt màu, cỡ chữ, khoảng cách lẻ. Nếu cần component mới → thêm vào design system trước (cập nhật 05 và theme.ts), ghi lại lý do.
- Giữ bố cục wireframe đã duyệt; mọi thay đổi bố cục phải ghi lý do.
- Dữ liệu mẫu thật, tiếng Việt: tên ngựa, giống, tuổi, địa điểm Việt Nam, giá VND định dạng 12.500.000 ₫, ngày giờ dd/MM/yyyy HH:mm. Thử cả tên dài và số lớn.
- Mỗi screen P0: bản light + dark, và đủ trạng thái (trống, skeleton, lỗi, offline/chờ đồng bộ).
- Ảnh ngựa: dùng placeholder trung tính cùng tỉ lệ khung, bo góc theo token.
- Cảm giác chung: sang, sạch, nhiều khoảng trắng; customer thiên về tin cậy/cao cấp; driver ưu tiên dễ đọc ngoài nắng, nút lớn; escort ưu tiên nhập nhanh một tay.
- Ghi chú tương tác cho dev: chuyển cảnh, haptic, kéo để làm mới, vuốt, hành vi bàn phím (loại bàn phím cho từng ô nhập).

- Đối chiếu với landing page của web (apps/web/src/features/home/) để bảo đảm cùng một bản sắc; tuân thủ 00-context.md mục 5c. [SỬA]

CÁCH XUẤT [SỬA: chỉ HTML]: docs/mobile-design/ui/ — mỗi actor một file, dùng CSS variables sinh từ theme.ts, có nút chuyển light/dark, có thể bấm chuyển màn theo flow chính, kèm index.html.

Thứ tự: Driver → Escort → Customer → Common. Xong mỗi actor: tự rà lại theo checklist ở 00-context.md mục 5, sửa lỗi, rồi DỪNG cho tôi xem.

Sau cùng: ghi docs/mobile-design/06-ui.md — link/đường dẫn, danh sách screen đã xong, component mới đã thêm, ghi chú bàn giao cho dev React Native (screen nào dùng component nào, endpoint nào).
```

## Prompt 7 — Review sau thiết kế

Kết quả: `07-review.md` — báo cáo lỗi có mức độ và cách sửa. Review bằng subagent "mắt mới" để thiết kế không tự chấm điểm mình.

```text
NHIỆM VỤ: review độc lập toàn bộ thiết kế mobile. Hãy dùng một subagent mới (chưa tham gia thiết kế) với vai trò: Design Lead khó tính từ một công ty top đầu, kết hợp chuyên gia accessibility và một tài xế/người hộ tống thực tế. Chỉ đọc, không sửa trong lúc review.

Đầu vào: docs/mobile-design/00 → 06, tokens/theme.ts, và HTML UI (chụp/xem từng màn hình thật, không chỉ đọc mô tả).

Kiểm tra theo 9 nhóm:
1. Phủ phạm vi: mọi chức năng MVP có screen; không có screen ngoài phạm vi; mọi trường hiển thị/nhập khớp dữ liệu và API thật ở 01 (phát hiện trường "bịa").
2. Flow: số bước tác vụ chính, nhánh lỗi, offline, quyền bị từ chối, chỗ người dùng có thể bị kẹt.
3. Phân cấp thị giác: mỗi màn đúng 1 hành động chính; hiểu mục đích trong 3 giây.
4. Tuân thủ design system: màu/cỡ chữ/khoảng cách lẻ ngoài token; component bị tách rời; lệch lưới 8pt; lệch lề.
5. Typography & màu: ≤4 cỡ chữ/màn, body ≥16pt, tương phản ≥4.5:1 cả light/dark, chỉ 1 màu nhấn, trạng thái không chỉ dựa vào màu, chữ phóng to không vỡ layout.
6. Tương tác & công thái học: vùng chạm (44/56pt), thumb zone, dùng một tay, đọc được ngoài nắng, thao tác khi đeo găng; phản hồi chạm, haptic, motion.
7. Trạng thái: trống, skeleton, lỗi, offline, đang đồng bộ, dữ liệu dài, màn nhỏ 360pt.
8. Nền tảng & nội dung: quy ước iOS (back, vuốt cạnh, sheet) và Android (nút Back hệ thống); UX writing tiếng Việt rõ, động từ cụ thể, thuật ngữ thống nhất; nhãn VoiceOver/TalkBack; màn xin quyền.
9. [SỬA] Bản sắc & không "kiểu AI": đúng token mục 5b, không vi phạm mục 5c ở 00-context.md; đặt cạnh landing page của web xem có cùng một thương hiệu không; màn nào trông như template sinh tự động.

Output: docs/mobile-design/07-review.md gồm:
- Điểm 1–10 cho từng nhóm và cho từng actor, kèm 1 câu lý do.
- Bảng vấn đề: ID | Mã screen | Nhóm | Mức độ (Critical / Major / Minor / Polish) | Mô tả | Vì sao quan trọng | Cách sửa cụ thể. Sắp theo mức độ.
- Top 5 thay đổi mang lại hiệu quả lớn nhất.
- Những gì đang làm tốt (để giữ nguyên).
- Thay đổi backend/API cần thiết mới phát hiện.

Khắt khe: "đúng" là chưa đủ — hỏi xem một design lead giỏi có bàn giao nguyên trạng không. Không tự sửa. DỪNG chờ tôi chọn mục cần sửa.
```

## Prompt phụ

Dùng khi cần vòng lặp sửa hoặc mở rộng sau khi đã có bộ thiết kế.

**Sửa theo review**

```text
Đọc docs/mobile-design/07-review.md. Sửa các mục: [liệt kê ID, VD: R-01, R-04, R-07] (hoặc: toàn bộ Critical và Major).
Với mỗi mục: sửa trong design system trước nếu là lỗi hệ thống, rồi áp dụng lên mọi screen bị ảnh hưởng; cập nhật các file 0x liên quan.
Ghi docs/mobile-design/changelog.md: ngày | ID | đã sửa gì | screen ảnh hưởng. Sau đó chạy lại đúng các nhóm kiểm tra của Prompt 7 cho những screen vừa sửa.
```

**Thêm hoặc đổi một screen**

```text
Đọc docs/mobile-design/00-context.md và 05-design-system.md.
Tôi cần [thêm / đổi] screen: [mô tả] cho actor [customer/driver/escort].
Làm đủ chuỗi: kiểm tra dữ liệu/API ở 01 → cập nhật bảng screen ở 02 và flow ở 03 → wireframe → UI từ design system (light + dark + đủ trạng thái) → tự review theo 9 nhóm của Prompt 7. Dừng sau bước wireframe cho tôi duyệt.
```

**Bàn giao sang code React Native (khi thiết kế đã chốt)**

```text
Đọc docs/mobile-design/ (00 → 07). Lập kế hoạch dựng app Expo + TypeScript: cấu trúc thư mục, navigation theo vai trò, chép tokens/theme.ts, thứ tự dựng component rồi screen, lớp API dùng lại type từ web, SQLite + hàng chờ đồng bộ, FCM, expo-secure-store, GPS nền. Chỉ lập kế hoạch, chưa code, chờ tôi duyệt.
```
