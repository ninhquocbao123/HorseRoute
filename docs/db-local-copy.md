# Database chạy trên máy mình

Database chung của nhóm nay là service Aiven mới (cấu trúc 10/11/2026, dữ liệu thật tới 28/10/2026 đã nạp ngày 11/11/2026). Tài liệu này dành cho khi cần một database riêng trên máy mình: thử nghiệm, làm việc không có mạng, hoặc dự phòng khi Aiven lỗi.

| Thành phần | Giá trị |
| --- | --- |
| Container | `wdp-local-db` (MySQL 8.0), volume `wdp-local-db-data` |
| Cổng | **3307** (đổi bằng biến `LOCAL_DB_PORT`) |
| Database | `wdp`, user `root`, mật khẩu `wdp-local` (chỉ dùng trên máy mình) |
| Cấu trúc | `docker/local-db/01-schema-20261110.sql`: cấu trúc database `wdp` trên Aiven lúc 15:39 ngày 10/11/2026 |
| Dữ liệu nền | `docker/local-db/02-reference-data.sql`: danh sách migration, 3 loại giấy tờ bắt buộc, tham số hệ thống, bảng giá mặc định |

## Dựng

Cần Docker Desktop đang chạy. Ở thư mục gốc repository:

```bash
pnpm install
pnpm db:local
```

Lệnh khởi động MySQL, nạp cấu trúc và dữ liệu nền nếu là lần đầu, rồi chạy migration mới hơn nếu có. Chạy lại bất cứ lúc nào: dữ liệu đã có được giữ nguyên. Database này **không có tài khoản**; tạo bằng `pnpm db:create-user` (xem README) sau khi trỏ `.env` vào nó.

## Dữ liệu thật của nhóm

Không nằm trong repo vì có email và mật khẩu đã băm của thành viên. File `wdp-du-lieu-that-20261028.sql` (21 tài khoản thật, 7 đơn, ngựa, giấy tờ, báo giá, danh mục địa điểm) được gửi riêng trong nhóm. Nạp được vào database có cấu trúc trên, kể cả bản sao này: file tự xóa dữ liệu cũ của đúng các bảng nó nạp rồi mới nạp, nên **đừng nạp vào database đang có dữ liệu cần giữ**.

```bash
docker exec -i wdp-local-db mysql -uroot -pwdp-local --default-character-set=utf8mb4 wdp < wdp-du-lieu-that-20261028.sql
```

## Trỏ API vào database trên máy

Sửa `.env` ở thư mục gốc (ghi lại giá trị Aiven để đổi về sau):

```
DB_HOST=127.0.0.1
DB_PORT=3307
DB_NAME=wdp
DB_USER=root
DB_PASSWORD=wdp-local
DB_SSL=false
```

## Khác

- Làm lại từ đầu (xóa dữ liệu trên máy mình): `pnpm db:local:reset`.
- Dừng: `docker stop wdp-local-db`. Xóa hẳn: `docker compose -f docker/local-db/docker-compose.yml down -v`.
- Trên Aiven, bảng `vehicles` có ràng buộc sức chứa theo loại xe (`ck_vehicles_type_capacity`) được thêm tay, không có migration. Cấu trúc ở đây giữ đúng như Aiven.
- Test tích hợp và E2E dùng database tạm riêng (`TEST_DB_*`), không đụng database này.
