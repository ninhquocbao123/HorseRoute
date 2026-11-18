# Tài khoản demo HorseRoute

Cập nhật 19/11/2026. Các tài khoản do `apps/api/scripts/seed-flow4-demo.cjs` tạo trong database MySQL **cục bộ** `wdp_flow4_demo` (script từ chối mọi host khác máy này). Database chung Aiven `wdp` không có các tài khoản này cho tới khi nhóm đồng ý nạp.

**Mật khẩu chung của mọi tài khoản: `HorseRoute@2026`.**

| Họ tên | Email | Vai trò | Mật khẩu | Đăng nhập ở |
| --- | --- | --- | --- | --- |
| Trần Quốc Bảo | `tranquocbao.admin@gmail.com` | Quản trị (ADMIN) | `HorseRoute@2026` | Web /staff/login |
| Lê Thị Minh Châu | `lethiminhchau.manager@gmail.com` | Quản lý (MANAGER) | `HorseRoute@2026` | Web /staff/login |
| Nguyễn Thanh Hà | `nguyenthanhha.specialist@gmail.com` | Thẩm định viên (SPECIALIST) | `HorseRoute@2026` | Web /staff/login |
| Đặng Thu Trang | `dangthutrang.coordinator@gmail.com` | Điều phối (COORDINATOR) | `HorseRoute@2026` | Web /staff/login |
| Huỳnh Quốc Việt | `huynhquocviet.coordinator@gmail.com` | Điều phối (COORDINATOR) | `HorseRoute@2026` | Web /staff/login |
| Nguyễn Văn Hùng | `nguyenvanhung.driver@gmail.com` | Tài xế (DRIVER_ESCORT, DRIVER) | `HorseRoute@2026` | App, web /staff/login |
| Trần Minh Tuấn | `tranminhtuan.driver@gmail.com` | Tài xế (DRIVER_ESCORT, DRIVER) | `HorseRoute@2026` | App, web /staff/login |
| Lê Quang Vinh | `lequangvinh.driver@gmail.com` | Tài xế (DRIVER_ESCORT, DRIVER) | `HorseRoute@2026` | App, web /staff/login |
| Phạm Thị Lan | `phamthilan.escort@gmail.com` | Lơ xe, hộ tống (DRIVER_ESCORT, ESCORT) | `HorseRoute@2026` | App, web /staff/login |
| Đỗ Anh Tuấn | `doanhtuan.escort@gmail.com` | Lơ xe, hộ tống (DRIVER_ESCORT, ESCORT) | `HorseRoute@2026` | App, web /staff/login |
| Ngô Thu Hương | `ngothuhuong.escort@gmail.com` | Lơ xe, hộ tống (DRIVER_ESCORT, ESCORT) | `HorseRoute@2026` | App, web /staff/login |
| Võ Hoàng Long | `vohoanglong.customer@gmail.com` | Khách hàng (CUSTOMER, câu lạc bộ) | `HorseRoute@2026` | App, web /login |
| Bùi Thị Ngọc Ánh | `buithingocanh.customer@gmail.com` | Khách hàng (CUSTOMER, cá nhân) | `HorseRoute@2026` | App, web /login |

## Thông tin kèm theo

- Mọi tài khoản ở trạng thái `ACTIVE` (coi như đã xác minh email), có số điện thoại, địa chỉ và ảnh đại diện.
- Tài xế có bằng lái (cột mới `crew_profiles.license_*`, migration `1800000096000-CrewLicenses`):
  - Nguyễn Văn Hùng: hạng FC, số `790187006512`, hết hạn 15/06/2031.
  - Trần Minh Tuấn: hạng C, số `740192004387`, hết hạn 30/11/2029.
  - Lê Quang Vinh: hạng D, số `010185009921`, hết hạn 08/03/2030.
- Xe trong seed: `51C-123.45`, `51D-678.90`, `51E-246.80`, `51F-135.79`, `51G-864.20`, `29C-246.13`.
- "Lơ xe" trong hệ thống là tổ lái loại `ESCORT`, giao diện ghi "Hộ tống".
- Chuyến đang chạy `WDP-DEMO-F4-A` (chuyến #200): tài xế Nguyễn Văn Hùng, hộ tống Phạm Thị Lan, khách Võ Hoàng Long.

## Không gửi email tới các địa chỉ này

Email dạng tên + `@gmail.com` có thể trùng hộp thư thật của người khác. API **không bao giờ** gửi thư (xác minh, quên mật khẩu, chào mừng) tới các địa chỉ trong `apps/api/src/shared/mail/seed-accounts.ts`, ở mọi môi trường. Thư bị chặn chỉ ghi log `mail_suppressed`; khi không phải production, log có cả nội dung (mã đặt lại mật khẩu) để thử trên máy. Đặt `MAIL_DISABLED=true` để tắt gửi mọi thư.

## Dựng lại database

```powershell
docker run -d --name hr-demo-mysql -e MYSQL_ROOT_PASSWORD=<mật khẩu> -p 33077:3306 mysql:8.0
```

```powershell
cd apps/api; $env:DEMO_DB_PORT='33077'; $env:DEMO_DB_PASSWORD='<mật khẩu>'; node scripts/seed-flow4-demo.cjs
```

Chi tiết chạy API, web trỏ vào database này: [docs/demo-local.md](../docs/demo-local.md).
