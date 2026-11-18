# Hoàn thiện 7 mục, 19/11/2026

Nhánh `feat/hoan-thien-19-11-2026` (tạo từ `long` `7608b13`), worktree `.claude/worktrees/beautiful-davinci-56b8f2`. **Chưa push.** Cập nhật lần cuối sau khi làm xong mục 3, 6, 7.

Môi trường thử: MySQL riêng `hr-test-mysql-1911` (cổng 33077, DB `wdp_flow4_demo`), API cổng 3100 với `apps/api/.env.demo` (gitignore, `MAIL_DISABLED=true`, lưu tệp local), web cổng 5190. Không ghi gì lên DB chung Aiven.

## Tổng quan

| Mục | Trạng thái | Commit |
| --- | --- | --- |
| 1. Tài khoản tài xế, lơ xe | Xong, đã thử | `1f5fac0` |
| 5. Toast thông báo web | Xong, đã thử trên trình duyệt | `99bcb6b` |
| 4. Popup thông báo mobile | Code xong, typecheck và test đạt; **chưa thử trên máy ảo**; push FCM chưa làm (chờ đồng ý) | `1f36afe` |
| 2. Giấy tờ ngựa trên mobile | Code xong, typecheck và test đạt; **chưa thử trên máy ảo**, chưa thử luồng nộp lại đầu cuối | `ad0739a` |
| 3. Xem ảnh phóng to | Xong; bản web đã thử trên trình duyệt, bản mobile chưa thử trên máy ảo | `b2a9bef` |
| 6. Nút Check-in cố định | Xong; web đã thử ở 360px với tên rất dài; mobile chưa thử trên máy ảo | `a5474f6` |
| 7. Timeline mobile giống web | Code xong, test logic đạt; chưa thử trên máy ảo | `204b9e0` |

## Mục 1

- `apps/api/src/shared/mail/seed-accounts.ts` (mới): 13 tài khoản seed (3 tài xế có bằng lái, 3 hộ tống/lơ xe), cùng danh sách email của `database/wdp_seed_v2.sql`.
- `apps/api/src/shared/mail/mailer.ts`: `guardSeedRecipients` không bao giờ gửi thư tới tài khoản seed, `MAIL_DISABLED=true` tắt mọi thư; thư bị chặn chỉ ghi log `mail_suppressed`.
- `apps/api/scripts/seed-flow4-demo.cjs`: dùng danh sách trên, mật khẩu chung `HorseRoute@2026`, ACTIVE, ảnh đại diện PNG, bằng lái; bỏ `example.com`, "Demo" ở tên và địa chỉ.
- Migration `1800000096000-CrewLicenses` (cột `crew_profiles.license_*`), `GET /users/me/crew`, app hiện bằng lái ở Tài khoản. **Chưa chạy trên DB chung**; API vẫn chạy được khi chưa có cột.
- `database/wdp_seed_v2.sql`, `docs/demo-local.md`, `.env.example`, `apps/api/scripts/simulate-gps.cjs`, `doc/tai_khoan_demo.md`.
- Thử: seed chạy trên MySQL riêng (31 migration), đăng nhập tài xế, `/users/me/crew` trả bằng lái, "Quên mật khẩu" của khách seed bị chặn. Test API 224/224 (thêm `test/mailer-seed.test.cjs`).

## Mục 5

- API `features/notifications/notification-relay.ts`: phát `notification:new` cho mọi thông báo IN_APP mới (trước chỉ sự kiện chuyến), không phát lại thông báo cũ. Báo sự cố thì khách và tổ lái còn lại cũng được báo.
- Web `features/notifications/NotificationToaster.tsx`, `notice-meta.ts`, `notification-toaster.css`; mount ở `App.tsx`. Chuông các vai trò tải lại qua `publishNoticeChange`. Bỏ popup góc dưới của điều phối và thẻ cảnh báo của tài xế để không trùng.
- Thử trên trình duyệt (khách): toast xanh góc trên phải, toast sự cố đỏ giữ tới khi tắt, xếp dọc, bấm thẻ mở đơn và đánh dấu đã đọc, tải lại không hiện thông báo cũ. Chưa thử riêng các vai trò khác.

## Mục 4, mục 2

- Mobile: `realtime.ts`, `notice-banner.tsx`, `notice-route.ts`, `doc-upload.tsx`, `screens/DocResubmitScreen.tsx`, sửa `App.tsx`, `screens/CustomerScreens.tsx`. Thêm thư viện `socket.io-client`, `expo-document-picker` (đã cập nhật cả `package-lock.json` và `pnpm-lock.yaml`).
- API documents: nộp lại thì đánh dấu thông báo yêu cầu bổ sung cũ đã đọc, báo quản lý (`DOCUMENT_RESUBMITTED`); `/notifications` trả `document_status`.
- Test mobile 77/77, API 225/225, `tsc` sạch ở api, web, mobile.

## Mục 3

- Mobile `src/image-viewer.tsx` (tự viết, không thêm thư viện vì dự án chưa có gesture-handler/reanimated): chụm phóng tới 4x, chạm đúp 2,5x, kéo khi phóng, vuốt ngang chuyển ảnh, vuốt xuống hoặc X để đóng, "2/5", giờ chụp, mốc/địa điểm, vòng tải, ô thay thế khi lỗi. Dùng ở "Ảnh trong chuyến" (`CareGalleryCard`) và timeline mục 7.
- Web `features/tracking/PhotoLightbox.tsx` thay Modal cũ của `CareGallery`: lăn chuột, chụm, nhấp đúp, kéo, phím ←/→, nút hai bên, vuốt, Esc. Thử trên trình duyệt: mở, chuyển ảnh, phóng, đóng.

## Mục 6

- Web `DriverWorkspace.tsx`, `RouteMapCard.tsx`, `DriverRouteMap.tsx`, `driver.css`, `trackmap.css`, `driver-ui.ts`: nút "Check-in" rộng cố định, màn ≤ 768px thành thanh cố định cuối màn; loading, khóa khi đang gửi, tắt khi đã check-in hoặc khi GPS cho thấy còn xa hơn 2 km (không có GPS thì không chặn); thẻ "Điểm đến tiếp theo" nổi trên bản đồ, tên tối đa 2 dòng; marker điểm kế vàng, to, nhấp nháy nhẹ.
- Mobile `TripScreens.tsx`, `CrewWork.tsx`, `map/*`: nút chân màn "Check-in", khóa chống bấm hai lần; thẻ điểm đến nổi trên bản đồ màn Tuyến và vị trí, marker nổi bật. Màn chuyến chính của app không có bản đồ nên thẻ chuyến vẫn ghi điểm kế (tối đa 2 dòng). App chưa khóa theo khoảng cách GPS.
- Thử trên web 360px, tên điểm dài 90 ký tự: thẻ cắt 2 dòng "…", nút không đổi cỡ, check-in thật trên DB thử, thẻ chuyển sang điểm kế.

## Mục 7

- Mobile `src/journey.ts`, `screens/JourneyTimeline.tsx`, `screens/CustomerScreens.tsx`: cùng câu chữ, thứ tự với web, mới nhất trên cùng và nổi bật, mốc cũ xám, điểm sắp tới nét đứt; ảnh gắn vào mốc, bấm mở trình xem; báo cáo sức khỏe thành khối riêng. Tự cập nhật nhờ socket mục 4 (check-in gửi ORDER_LEG_PROGRESS cho khách).

## Kiểm tra cuối

- `tsc` sạch ở api, web, mobile; test API 225/225, web đạt, mobile 81/81; `vite build` và `expo export --platform android` build được.
- Chưa chạy được luồng đầu cuối trên app (máy ảo không dùng được trong phiên). Các bước web đã chạy thật trên DB thử: khách nhận toast xanh và đỏ, bấm mở đơn; tài xế check-in ở 360px; lightbox ảnh.

## Còn vướng

- **Push FCM chưa có trong dự án.** Theo yêu cầu, cần người dùng đồng ý trước khi tích hợp. Vì vậy chưa có thông báo khi app chạy nền hoặc đã tắt, và chưa test được deep link từ push.
- Máy ảo: lệnh `adb screencap` treo, người dùng tự bật lại máy ảo nên chưa thử mục 2, 4 trên app.
- Seed chưa có giấy tờ (`documents`) cho đơn nào, nên muốn thử "yêu cầu bổ sung" phải tạo đơn mới có ngựa, hoặc bổ sung seed.
- Cần thử trên máy ảo hoặc máy thật: popup mục 4, giấy tờ và nộp lại mục 2, trình xem ảnh mục 3, nút và thẻ mục 6, timeline mục 7.
