# HorseRoute

Hệ thống quản lý vận chuyển ngựa: khách đặt chuyến, chuyên viên duyệt giấy tờ, quản lý báo giá và duyệt kế hoạch, điều phối lập tuyến và phân công xe, tổ lái, tài xế và hộ tống chạy chuyến trên điện thoại, khách theo dõi và thanh toán.

| Thành phần | Công nghệ |
| --- | --- |
| `apps/api` | Node.js 22, Express 5, TypeORM, MySQL 8, Redis, socket.io, xác thực JWT |
| `apps/web` | React 18, Vite, Ant Design, MapLibre và Leaflet |
| `apps/mobile` | Expo SDK 58 (React Native) cho tài xế, hộ tống và khách, dùng npm riêng |
| `packages/shared` | Kiểu dữ liệu, trạng thái, công thức tính giá dùng chung |

Vai trò: khách hàng (`CUSTOMER`), quản trị (`ADMIN`), quản lý (`MANAGER`), chuyên viên (`SPECIALIST`), điều phối (`COORDINATOR`), tài xế và hộ tống (`DRIVER_ESCORT`).

## Cần cài

- Node.js 22 trở lên và pnpm 9: `corepack enable` (pnpm lấy theo `packageManager` trong `package.json`). Trên Windows lệnh này cần quyền quản trị; không có quyền thì cài bằng `npm install -g pnpm@9`.
- Docker Desktop để chạy MySQL và Redis. Đã có MySQL 8 và Redis sẵn thì không cần.

Lệnh dưới đây chạy ở thư mục gốc repository, được cả Git Bash, PowerShell và terminal Linux/macOS (PowerShell dùng `Copy-Item` thay `cp`).

## Chạy trên máy

```bash
corepack enable                            # hoặc: npm install -g pnpm@9
pnpm install
pnpm --filter @my-project/shared build    # API và web dùng bản build của gói chung

cp .env.example .env                       # cấu hình API; điền JWT_SECRET (ít nhất 32 ký tự)
cp apps/web/.env.example apps/web/.env     # cấu hình web; mặc định trỏ http://localhost:3000/api/v1

pnpm dev:infra                             # MySQL 8 (root/root, cổng 3306) và Redis (cổng 6379) bằng Docker
pnpm db:setup                              # tạo database DB_NAME và chạy mọi migration; chạy lại không làm gì
```

MySQL trong container cần khoảng 20 giây cho lần khởi động đầu. `pnpm db:setup` báo lỗi kết nối thì đợi thêm rồi chạy lại.

Tạo tài khoản nhân viên. Database mới chưa có ai, và web chỉ cho **khách** tự đăng ký:

```bash
pnpm db:create-user --email admin@local.test --role ADMIN --name "Quản trị" --password "Doi-mat-khau-1"
pnpm db:create-user --email manager@local.test --role MANAGER --name "Quản lý" --password "Doi-mat-khau-1"
pnpm db:create-user --email specialist@local.test --role SPECIALIST --name "Chuyên viên" --password "Doi-mat-khau-1"
pnpm db:create-user --email coordinator@local.test --role COORDINATOR --name "Điều phối" --password "Doi-mat-khau-1"
pnpm db:create-user --email driver@local.test --role DRIVER --name "Tài xế" --password "Doi-mat-khau-1"
pnpm db:create-user --email escort@local.test --role ESCORT --name "Hộ tống" --password "Doi-mat-khau-1"
```

`DRIVER` và `ESCORT` đều là vai `DRIVER_ESCORT`, lệnh tạo kèm hồ sơ tổ lái đúng loại để điều phối chọn được. Web chưa có màn thêm xe (N2 trong báo cáo đánh giá). Tạm thời thêm xe trong Swagger (http://localhost:3000/docs sau khi chạy API): gọi `POST /api/v1/auth/login` bằng tài khoản điều phối, bấm Authorize và dán `accessToken`, rồi gọi `POST /api/v1/vehicles` với ví dụ `{"plateOrCode": "51C-001.01", "vehicleType": "MEDIUM", "capacityStalls": 4}` (`LIGHT` 2 chỗ, `MEDIUM` 4–6 chỗ, `HEAVY` 9 chỗ).

Chạy API và web, mỗi lệnh một cửa sổ terminal:

```bash
pnpm dev:api    # http://localhost:3000/api/v1, Swagger ở http://localhost:3000/docs
pnpm dev:web    # http://localhost:5173
```

- Khách: đăng ký và đăng nhập ở http://localhost:5173/login.
- Nhân viên: đăng nhập ở http://localhost:5173/staff/login.
- Kiểm tra API: http://localhost:3000/api/v1/health.

Sửa `packages/shared` thì chạy lại `pnpm --filter @my-project/shared build` (API đang chạy sẽ tự nạp lại).

### Bản sao database chung của nhóm

Cần database riêng trên máy mình (thử nghiệm, dự phòng khi Aiven lỗi): `pnpm db:local` dựng MySQL cổng 3307 với cấu trúc và dữ liệu nền giống database chung. Xem [docs/db-local-copy.md](docs/db-local-copy.md).

### Dữ liệu demo có sẵn

Muốn có ngay đơn, chuyến đang chạy, lịch sử, GPS và tài khoản đủ vai trò, dùng môi trường demo riêng (MySQL cổng 33062, API 3010, web 5180), không đụng database ở trên: xem [docs/demo-local.md](docs/demo-local.md).

### Ứng dụng mobile

Xem [apps/mobile/README.md](apps/mobile/README.md). App dùng npm trong `apps/mobile` và gọi cùng API ở trên (máy ảo Android dùng `http://10.0.2.2:3000/api/v1`).

## Cấu hình

| File | Dùng cho |
| --- | --- |
| [`.env.example`](.env.example) → `.env` | API, `pnpm db:setup`, `pnpm db:create-user`, `docker-compose.yml` |
| [`apps/web/.env.example`](apps/web/.env.example) → `apps/web/.env` | Web (biến `VITE_*`, nhúng vào bản build) |
| [`apps/mobile/.env.example`](apps/mobile/.env.example) | Mobile, chỉ khi dùng API đã triển khai hoặc cổng khác |
| [`apps/api/.env.demo.example`](apps/api/.env.demo.example) | API demo, xem `docs/demo-local.md` |

API đọc `apps/api/.env` trước rồi tới `.env` ở gốc; biến đặt sẵn trong shell luôn được ưu tiên. Thiếu biến bắt buộc thì API dừng với lỗi `INVALID_ENV` kèm tên biến, xem [apps/api/README.md](apps/api/README.md).

Email (xác minh khi đăng ký, quên mật khẩu) gửi qua Gmail SMTP với mật khẩu ứng dụng: điền `SMTP_USER`, `SMTP_PASSWORD` theo hướng dẫn trong `.env.example`. Chưa điền thì đăng ký kích hoạt ngay và mã quên mật khẩu chỉ ghi vào log của API.

Bản đồ và tìm địa chỉ mặc định dùng OpenFreeMap, OSRM và Photon công khai, không cần token, chỉ cần có mạng. Thanh toán VNPay Sandbox cần khóa riêng ([apps/api/VNPAY-SANDBOX.md](apps/api/VNPAY-SANDBOX.md)); chưa có khóa thì dùng thanh toán mô phỏng.

`pnpm db:setup` và `pnpm db:create-user` chỉ chạy với MySQL trên máy này (`127.0.0.1`, `localhost`). Muốn áp dụng lên database ở xa thì thêm `--allow-remote`, và chỉ làm khi cả nhóm đã đồng ý.

## Lệnh thường dùng

| Lệnh | Việc |
| --- | --- |
| `pnpm build` | Build gói chung, API (`apps/api/dist`) và web (`apps/web/dist`) |
| `pnpm lint` | Kiểm tra kiểu TypeScript mọi gói |
| `pnpm db:setup` | Tạo database và chạy migration còn thiếu |
| `pnpm db:create-user` | Tạo tài khoản nhân viên |
| `pnpm --filter api migration:generate src/database/migrations/TenMigration` | Sinh migration từ thay đổi entity |

## Kiểm thử

```bash
pnpm --filter api test     # test đơn vị API, không cần database
pnpm --filter web test     # test logic web, không cần trình duyệt
```

Test tích hợp MySQL và test trình duyệt tự tạo database tạm tên ngẫu nhiên rồi xóa. Luôn đặt `TEST_DB_*` trỏ tới MySQL trên máy mình: thiếu thì test lấy `DB_*` trong `.env`.

```bash
export TEST_DB_HOST=127.0.0.1 TEST_DB_PORT=3306 TEST_DB_USER=root TEST_DB_PASSWORD=root TEST_DB_SSL=false
node apps/api/test/flow1.mysql.cjs                 # một file; CI chạy cả 16 file apps/api/test/*.mysql.cjs
pnpm --filter web exec playwright install chromium # một lần
pnpm --filter web test:browser                     # trình duyệt với API giả
pnpm --filter web test:e2e                         # luồng trọn từ khách đăng ký tới giao ngựa trên API và MySQL thật
```

PowerShell: đặt biến bằng `$env:TEST_DB_HOST='127.0.0.1'` (tương tự cho các biến còn lại). Đã có Edge hoặc Chrome thì có thể bỏ bước cài Chromium và đặt `PLAYWRIGHT_CHANNEL=msedge` (hoặc `chrome`). Test mobile: xem `apps/mobile/README.md`.

CI (`.github/workflows/ci.yml`) chạy build, test đơn vị, `pnpm db:setup` hai lần trên database trống, 16 file test tích hợp, test trình duyệt và test E2E.

## Chạy bằng Docker

`docker-compose.yml` dựng API, web (nginx, cổng 80, chuyển `/api/` vào API), MySQL và Redis, đọc `.env` ở gốc. Đặt `DB_ROOT_PASSWORD`, `DB_USER=root`, `DB_PASSWORD` bằng `DB_ROOT_PASSWORD`, `NODE_ENV=production` và `CORS_ORIGIN` là địa chỉ web, rồi:

```bash
docker compose up -d --build
```

Hạn chế hiện tại: image API không tự chạy migration và MySQL trong compose không mở cổng ra máy, nên database phải được dựng bằng `pnpm db:setup` trước khi API dùng được. Việc này nằm ở giai đoạn C của [kế hoạch xử lý lỗi](docs/ke-hoach-xu-ly-loi-10-11-2026.md).

## Tài liệu

- [docs/demo-local.md](docs/demo-local.md): môi trường demo và tài khoản mẫu.
- [apps/api/README.md](apps/api/README.md): log khởi động, mã lỗi, request ID.
- [docs/danh-gia-hoi-dong-10-11-2026.md](docs/danh-gia-hoi-dong-10-11-2026.md): đánh giá dự án và kết quả kiểm thử.
- [docs/ke-hoach-xu-ly-loi-10-11-2026.md](docs/ke-hoach-xu-ly-loi-10-11-2026.md): kế hoạch xử lý lỗi và tiến độ.
- `docs/mobile-design/`: thiết kế và tiến độ mobile.
