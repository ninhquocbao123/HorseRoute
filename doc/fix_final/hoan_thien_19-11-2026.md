# Hoàn thiện 7 mục, 19/11/2026

Nhánh `feat/hoan-thien-19-11-2026` (tạo từ `long` `7608b13`), worktree `.claude/worktrees/beautiful-davinci-56b8f2`. **Chưa push.** Phiên dừng giữa chừng theo yêu cầu người dùng; file này ghi đúng tình trạng lúc dừng.

Môi trường thử: MySQL riêng `hr-test-mysql-1911` (cổng 33077, DB `wdp_flow4_demo`), API cổng 3100 với `apps/api/.env.demo` (gitignore, `MAIL_DISABLED=true`, lưu tệp local), web cổng 5190. Không ghi gì lên DB chung Aiven.

## Tổng quan

| Mục | Trạng thái | Commit |
| --- | --- | --- |
| 1. Tài khoản tài xế, lơ xe | Xong, đã thử | `1f5fac0` |
| 5. Toast thông báo web | Xong, đã thử trên trình duyệt | `99bcb6b` |
| 4. Popup thông báo mobile | Code xong, typecheck và test đạt; **chưa thử trên máy ảo**; push FCM chưa làm (chờ đồng ý) | `1f36afe` |
| 2. Giấy tờ ngựa trên mobile | Code xong, typecheck và test đạt; **chưa thử trên máy ảo**, chưa thử luồng nộp lại đầu cuối | `ad0739a` |
| 3. Xem ảnh phóng to | Chưa làm | |
| 6. Nút Check-in cố định | Chưa làm | |
| 7. Timeline mobile giống web | Chưa làm (cập nhật tự động đã có một phần nhờ socket ở mục 4) | |

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

## Còn vướng

- **Push FCM chưa có trong dự án.** Theo yêu cầu, cần người dùng đồng ý trước khi tích hợp. Vì vậy chưa có thông báo khi app chạy nền hoặc đã tắt, và chưa test được deep link từ push.
- Máy ảo: lệnh `adb screencap` treo, người dùng tự bật lại máy ảo nên chưa thử mục 2, 4 trên app.
- Seed chưa có giấy tờ (`documents`) cho đơn nào, nên muốn thử "yêu cầu bổ sung" phải tạo đơn mới có ngựa, hoặc bổ sung seed.
- Mục 3, 6, 7 và phần kiểm tra cuối chưa làm.
