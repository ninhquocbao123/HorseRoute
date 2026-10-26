# Môi trường demo cục bộ (làm giao diện tài xế)

Mục tiêu: chạy API + web trên máy với một MySQL Docker riêng đã có dữ liệu mẫu, **không đụng Aiven** và **không sửa `.env`**. Mọi thứ dùng cổng khác để không va chạm với `docker-compose.dev.yml` (3306) hay API/web dev (3000/5173).

| Thành phần | Giá trị |
|---|---|
| MySQL demo | container `wdp-demo-mysql`, cổng **33062**, volume `wdp-demo-mysql-data`, user `root`, mật khẩu `demo` |
| Database | `wdp_flow4_demo` (seed tự tạo lại mỗi lần chạy) |
| API demo | http://localhost:**3010** (`apps/api/.env.demo`, đã gitignore) |
| Web demo | http://localhost:**5180** (trỏ API demo bằng biến môi trường, không đổi `apps/web/.env`) |

## 1. Tạo DB demo (một lần)

```bash
docker run -d --name wdp-demo-mysql -e MYSQL_ROOT_PASSWORD=demo -p 33062:3306 -v wdp-demo-mysql-data:/var/lib/mysql mysql:8.0
# chờ ~20 giây cho MySQL khởi động, rồi nạp schema + toàn bộ migration + dữ liệu mẫu:
cd apps/api
DEMO_DB_PORT=33062 DEMO_DB_PASSWORD=demo node scripts/seed-flow4-demo.cjs
```

Seed (`apps/api/scripts/seed-flow4-demo.cjs`) từ chối mọi host khác ngoài máy này và chỉ đụng database `wdp_flow4_demo` (mặc định; đặt `DEMO_DB_NAME=wdp_flow4_demo_x` để seed một DB riêng mà không ghi đè DB đang dùng — tên phải bắt đầu bằng `wdp_flow4_demo`). Nó nạp `test/fixtures/schema.sql` rồi chạy **tất cả** migration trong `src/database/migrations` (trừ Init) theo thứ tự timestamp, nên DB luôn khớp code hiện tại. Chạy lại seed bất cứ lúc nào để làm mới dữ liệu (đặc biệt tín hiệu GPS, xem mục 4).

## 2. Chạy

```bash
cp apps/api/.env.demo.example apps/api/.env.demo   # lần đầu; điền DB_PASSWORD=demo và JWT_SECRET (≥ 32 ký tự)
pnpm dev:api:demo     # API cổng 3010; script nạp apps/api/.env.demo và GHI ĐÈ biến môi trường, từ chối nếu DB_HOST không phải máy này
pnpm dev:web:demo     # web cổng 5180, VITE_API_URL=http://localhost:3010/api/v1
```

Token Mapbox của web (`VITE_MAPBOX_TOKEN`) vẫn lấy từ `apps/web/.env` nếu có. API demo không cần token: các tuyến đường bộ của chuyến demo đã nằm sẵn trong cache `location_routes`.

## 3. Tài khoản demo

Đăng nhập nhân viên tại http://localhost:5180/staff/login. Mật khẩu của **tất cả** tài khoản: `Demo@12345` (chỉ dùng cho DB demo này).

| Email | Vai trò |
|---|---|
| `driver@example.com` | Tài xế (DRIVER) của chuyến demo |
| `escort@example.com` | Hộ tống (ESCORT) cùng chuyến |
| `driver2@example.com` | Tài xế khác (kiểm tra cô lập quyền) |
| `coordinator@example.com`, `coordinator2@example.com` | Điều phối |
| `manager@example.com`, `specialist@example.com`, `admin@example.com` | Quản lý, chuyên viên, quản trị |
| `customer@example.com`, `customer2@example.com` | Khách hàng (đăng nhập ở `/login`) |

## 4. Dữ liệu mẫu cho tài xế / hộ tống

- **Đang chạy** `WDP-DEMO-F4-A` (chuyến #200, 3 ngựa): chặng 1 Long An → cửa khẩu Mộc Bài đã xong, chặng 2 Mộc Bài → Phnom Penh đang chạy bằng đường bộ, chặng 3 → Cảng Sihanoukville chưa đi. Có 14 điểm GPS, 2 cảnh báo điều phối (kẹt xe, thời tiết), 1 ghi chú hộ tống, 1 sự cố mức vàng. Hai tài khoản tài xế và hộ tống cùng thấy chuyến này.
- **Sắp tới** `WDP-DEMO-F4-NEXT` (chuyến #205, READY): cùng tài xế, nên màn chuyến hiện dòng "Còn 1 chuyến sắp tới".
- **Lịch sử** `WDP-DEMO-F4-H1…H4`: 4 chuyến đã giao (5, 12, 20, 35 ngày trước, 1–3 ngựa, hai loại xe, một chuyến có sự cố đã đóng).
- `WDP-DEMO-F4-B` (tài xế khác, READY) và `WDP-DEMO-F4-C` (kế hoạch chờ duyệt) để thử cô lập quyền.

**Tín hiệu GPS chỉ "LIVE" trong 2 phút** sau khi seed (điểm cuối cách đây ~1 phút). Muốn thẻ Tốc độ và vị trí xe luôn tươi, chạy trình mô phỏng (xe chạy dọc chặng 2):

```bash
node apps/api/scripts/simulate-gps.cjs --api http://localhost:3010/api/v1 --trip 200 --email driver@example.com --password Demo@12345
```

hoặc chạy lại seed rồi mở trang ngay.

## 5. Dọn dẹp

```bash
# dừng API/web: Ctrl+C ở hai cửa sổ chạy pnpm dev:api:demo / dev:web:demo
docker rm -f wdp-demo-mysql            # xóa container
docker volume rm wdp-demo-mysql-data   # xóa dữ liệu (giải phóng dung lượng)
rm apps/api/.env.demo                  # xóa cấu hình demo (file này không nằm trong git)
```

Image `mysql:8.0` (~1,1 GB) có thể đang được dự án dùng chung; chỉ xóa bằng `docker image rm mysql:8.0` khi không còn container nào cần.
