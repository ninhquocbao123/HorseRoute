# 00 — Bối cảnh & quy tắc thiết kế mobile HorseRoute

Nguồn sự thật cho mọi giai đoạn thiết kế mobile. Mọi giai đoạn sau đọc file này trước. Cập nhật lần cuối: 29/10/2026.

Vai trò khi làm việc: Senior Mobile Product Designer kiêm React Native engineer, am hiểu Apple HIG và Material Design 3.

## 1. Dự án

- Sản phẩm: nền tảng vận chuyển ngựa HorseRoute. Đã có web React + TypeScript (`apps/web`) và backend Express + MySQL (`apps/api`), có Socket realtime (`apps/api/src/shared/socket/socket.service.ts`).
- Mục tiêu: thiết kế mobile app MVP cho 3 actor (customer, driver, escort). Chưa code app.

## 2. Quyết định công nghệ (đã chốt, không đề xuất thay)

- Mobile: React Native + Expo development build, dùng chung Android/iOS, TypeScript.
- Backend: giữ Express + MySQL và API hiện có.
- Tái sử dụng: kiểu dữ liệu, trạng thái nghiệp vụ, logic, API. Viết lại giao diện mobile.
- Bổ sung: SQLite lưu offline, FCM cho push, token lưu bằng Keychain/Keystore (`expo-secure-store`).

## 3. Phạm vi MVP

| Actor | Trong phạm vi |
| --- | --- |
| Chủ ngựa (customer) | Hồ sơ ngựa; gửi yêu cầu vận chuyển đơn giản; xem đơn/báo giá; theo dõi vị trí; nhận thông báo. Thanh toán VNPay và giấy tờ: chỉ xem trạng thái, thao tác mở web. |
| Tài xế (driver) | Xem chuyến được giao; checklist; cập nhật mốc chặng; GPS nền; báo sự cố kèm ảnh. |
| Người hộ tống (escort) | Xem danh sách ngựa; ghi nhật ký chăm sóc/sức khỏe; chụp ảnh; báo bất thường. |

Ngoài phạm vi: chức năng admin, manager, specialist, coordinator/điều phối, và mọi thứ không liệt kê ở trên. Nếu thấy cần, ghi vào mục "Đề xuất sau MVP" của file giai đoạn đó, không thiết kế.

## 4. Bối cảnh sử dụng từng actor

- **Customer:** dùng lúc rảnh; cần cảm giác tin cậy, cao cấp, minh bạch về giá và vị trí ngựa.
- **Driver:** dùng khi đang lái hoặc dừng xe, ngoài trời, nắng gắt, có thể đeo găng, sóng yếu. Vùng chạm lớn (≥56pt cho hành động chính), tương phản cao, ít thao tác, không nhập liệu dài, hoạt động offline.
- **Escort:** thao tác một tay trong chuồng/thùng xe, tay kia giữ ngựa. Nhập nhanh bằng lựa chọn sẵn (chip, stepper), chụp ảnh 1 chạm, lưu nháp tự động, offline.

## 5. Quy tắc thiết kế bắt buộc

- **Ngôn ngữ & font:** UI tiếng Việt, dấu đầy đủ. Font duy nhất: **Be Vietnam Pro** (giống web).
- **Lưới:** 8pt (bước nhỏ 4pt). Lề ngang 16pt xuyên suốt. Tôn trọng Safe Area.
- **Typography:** 1 font, ≤4 cỡ chữ mỗi màn, body ≥16pt; phân cấp bằng độ đậm và màu. Hỗ trợ phóng to chữ hệ thống.
- **Màu:** 60-30-10, đúng MỘT màu nhấn cho hành động; thang xám có hệ thống; màu ngữ nghĩa (thành công/cảnh báo/lỗi/thông tin); tương phản chữ ≥4.5:1; không truyền nghĩa chỉ bằng màu. Có light và dark mode. Giá trị cụ thể ở mục 5b.
- **Hành động:** mỗi màn MỘT hành động chính; nút Primary / Secondary / Tertiary rõ cấp.
- **Vùng chạm:** ≥44×44pt (driver ≥56pt), cách nhau ≥8pt. Hành động chính ở nửa dưới (thumb zone), nút chính cố định đáy khi cần.
- **Điều hướng:** tab bar 3–5 tab, icon + nhãn; mỗi actor một bộ tab; back góc trái, vuốt cạnh để quay lại; bottom sheet cho tác vụ tạm thời.
- **Icon:** một bộ duy nhất **Lucide**, cùng nét, khung 24pt; outline = thường, filled = đang chọn.
- **Bo góc:** theo hệ 8 / 12–16 / 20–24, bo góc đồng tâm; bóng mềm, opacity thấp (ưu tiên đường kẻ, xem 5c).
- **Trạng thái:** mỗi màn đủ: bình thường, trống, đang tải (skeleton), lỗi, offline/đang chờ đồng bộ, dữ liệu dài/bất thường.
- **Chuyển động:** 150–300ms, spring/ease-out; phản hồi chạm tức thì; haptic cho hành động quan trọng; tôn trọng Reduce Motion.
- **UX writing:** nút là động từ cụ thể ("Xác nhận đã lấy ngựa", không phải "OK"); lỗi nói rõ cách khắc phục; thuật ngữ thống nhất với web (xem 5d).
- **Xin quyền:** vị trí nền, camera, thông báo xin đúng lúc cần, có màn giải thích trước.
- **Trợ năng:** mọi icon/nút có nhãn cho VoiceOver/TalkBack.

## 5b. Bản sắc thương hiệu (đã chốt, lấy từ web hiện tại)

Nguồn: `apps/web/src/features/home/landing-page.css` (`:root`), `apps/web/src/features/tracking/driver/driver-shell.css` (`--drs-*`), `apps/web/src/features/customer/customer.css`.

Không dùng bộ xanh rừng `#193e32` trong `apps/web/src/styles/theme-tokens.ts`: đó là token cũ, chỉ còn tô Ant Design mặc định và trang đăng nhập cũ.

| Token | Light | Dark | Nguồn web |
| --- | --- | --- | --- |
| brand | `#0b3b42` | `#0c2326` | `--navy`, `--drs-navy` |
| brand2 | `#14606a` | (Prompt 5 dựng) | `--navy2` |
| accent (nút chính, duy nhất) | `#f4b942` | `#f4b942` | `--gold`, `.btn` |
| onAccent | `#2b1a00` | `#2b1a00` | chữ của `.btn` |
| accentText (chữ/link vàng) | `#a86a00` | (Prompt 5 dựng) | `--gold-d` |
| bg | `#f6faf9` | `#061416` | `--bg` |
| surface | `#ffffff` | `#0c2326` | `--card` |
| surfaceMuted | `#e7f1f1` | `#08191b` | `--soft` |
| textPrimary | `#0d2a2e` | `#e8f4f4` | `--ink` |
| textSecondary | `#546d71` | `#96b4b7` | `--muted` |
| border | `#d8e6e6` | `#1a3a3e` | `--line` |
| success / danger / warning | `#166534` / `#dc2626` / `#ca8a04` | (Prompt 5 dựng) | `--drs-green`, `--drs-red`, `--drs-yellow` |

Tương phản đã đo (WCAG):

- `#2b1a00` trên `#f4b942`: 9.5:1. Trắng trên `#0b3b42`: 12.2:1. Trắng trên `#14606a`: 7.2:1.
- `#546d71` trên `#f6faf9`: 5.3:1. `#96b4b7` trên `#061416`: 8.5:1.
- `#f4b942` làm chữ trên nền trắng: 1.8:1, **cấm**. `#a86a00` trên trắng: 4.4:1, chỉ dùng cho chữ ≥18pt đậm, hoặc Prompt 5 làm đậm thêm.

Phân bổ 60-30-10: 60% nền sáng (bg/surface), 30% teal (header, tab đang chọn, thẻ nổi bật), 10% vàng (một nút chính mỗi màn).

Logo: `apps/web/public/brand/horse-transport-logo.png` (web dùng qua `apps/web/src/components/BrandLogo.tsx`). Bo góc như web: 12 cho control/nút, 16–20 cho card.

## 5c. Chống phong cách "AI" (bắt buộc)

- Không gradient tím/xanh dương, không mesh, glassmorphism, glow. Gradient duy nhất được phép: teal `#0b3b42 → #14606a`, chỉ ở thẻ chuyến đang chạy của customer.
- Không emoji trong UI, không icon sparkle/robot.
- Không màu ngoài token. Màu tím `#5b4bb0` của trạng thái "nghỉ" trong `apps/web/src/features/tracking/escort/escort.css` thay bằng teal nhạt + icon.
- Không bố cục template: không lưới 3 thẻ tính năng giống nhau, không tiêu đề quảng cáo kiểu "Trải nghiệm thông minh", không lời chào kèm emoji.
- Nội dung là trung tâm: chữ lớn nhất trên màn là thông tin người dùng cần nhất (VD driver: điểm đến tiếp theo + giờ).
- Mật độ như app vận hành thật: list gọn, số liệu rõ, ít card lồng card; phân tách bằng đường kẻ `border` và khoảng trắng; bóng gần như không có.
- Ảnh ngựa: ảnh thật trong `apps/web/src/assets/` hoặc placeholder trung tính; không minh họa 3D.

## 5d. Nguồn tham khảo có sẵn trong web

Web đã có UI dạng mobile cho driver và escort; kế thừa flow và thuật ngữ thay vì nghĩ lại.

- **Driver:** `apps/web/src/features/tracking/driver/`: `DriverShell.tsx`, `trip-phase.ts`, `driver-ui.ts` (nhãn checklist, loại điểm dừng, loại sự cố), `PreDepartureChecklist.tsx`, `SeverityPicker.tsx`, `DamageTargetChips.tsx`, `IncidentReportPage.tsx`, `useGpsSharing.ts`, `StopTimeline.tsx`.
- **Escort:** `apps/web/src/features/tracking/escort/`: `QuickLogCard.tsx`, `care-ui.ts` (nhãn và thông báo lỗi nhật ký chăm sóc), `HorseCareCard.tsx`, `CareHistoryList.tsx`.
- **Customer:** `apps/web/src/features/customer/` (`CustomerWorkspace.tsx`, `CustomerJourney.tsx`, `HorseProfiles.tsx`, `CustomerOrders.tsx`) và `apps/web/src/features/tracking/customer/`.
- Ví dụ thuật ngữ đang dùng (`driver-ui.ts`): "Sẵn sàng khởi hành", "Đang di chuyển", "Đang dừng", "Đã đến điểm dừng", "Xác nhận đã giao", "Đã giao xong", "Bàn giao", "Trạm kiểm dịch", "Cửa khẩu", "Hỏng xe", "Tắc đường". Bảng thuật ngữ đầy đủ lập ở giai đoạn 01.

## 6. Quy ước làm việc

- Mọi output ghi vào `docs/mobile-design/`, đánh số theo giai đoạn (`01-`, `02-`, ...). Không sửa code web/backend.
- Đường xuất trực quan: **chỉ HTML** (Figma MCP không kết nối được). Nếu sau này cần Figma, dựng plugin từ bản HTML đã chốt.
- Không đoán dữ liệu: mọi trường dữ liệu phải truy được về file code thật (đường dẫn + tên). Thiếu thì ghi vào mục "Khoảng trống dữ liệu".
- Kết thúc mỗi giai đoạn: tóm tắt 5 dòng + danh sách câu hỏi cần quyết, rồi DỪNG chờ duyệt.
- Bộ prompt đang dùng: `docs/mobile-design/prompts.md`.
