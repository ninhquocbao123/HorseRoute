# Bản sao database chung chạy trên máy mình

Dùng khi không truy cập được database Aiven của nhóm. Mỗi người chạy một bản sao riêng trên máy mình, cùng dữ liệu xuất phát.

| Thành phần | Giá trị |
| --- | --- |
| Container | `wdp-local-db` (MySQL 8.0), volume `wdp-local-db-data` |
| Cổng | **3307** (đổi bằng biến `LOCAL_DB_PORT`) |
| Database | `wdp`, user `root`, mật khẩu `wdp-local` (chỉ dùng trên máy mình) |
| Dữ liệu gốc | `backups/wdp_before_trip_fleet_20261028.sql`: dump database `wdp` trên Aiven lúc 23:43 ngày 28/10/2026 |

## Dựng lần đầu

Cần Docker Desktop đang chạy. Ở thư mục gốc repository:

```bash
pnpm install
pnpm db:local
```

Lệnh này khởi động MySQL, nạp bản dump (lần đầu khoảng 30 giây đến 1 phút), rồi chạy các migration mới hơn ngày 28/10 để khớp code hiện tại. Chạy lại bất cứ lúc nào cũng được: dữ liệu đã có được giữ nguyên, chỉ thêm migration còn thiếu.

## Trỏ API vào bản sao

Sửa `.env` ở thư mục gốc (ghi lại giá trị Aiven cũ để đổi về sau):

```
DB_HOST=127.0.0.1
DB_PORT=3307
DB_NAME=wdp
DB_USER=root
DB_PASSWORD=wdp-local
DB_SSL=false
```

Rồi `pnpm dev:api` như thường. Tài khoản và mật khẩu giống trên Aiven tại thời điểm 28/10.

## Cần biết

- Mọi thay đổi ghi lên Aiven sau 23:43 ngày 28/10/2026 không có trong bản sao.
- Mỗi người một bản riêng: dữ liệu bạn tạo, người khác không thấy. Muốn mọi người có cùng dữ liệu mới thì một người xuất dump (`docker exec wdp-local-db mysqldump -uroot -pwdp-local --single-transaction wdp > backups/<tên>.sql`), đưa lên repo, rồi đổi đường dẫn trong `docker/local-db/docker-compose.yml`.
- Pull code có migration mới: chạy lại `pnpm db:local`.
- Làm lại từ đầu (xóa dữ liệu trên máy mình): `pnpm db:local:reset`.
- Dừng: `docker stop wdp-local-db`. Xóa hẳn: `docker compose -f docker/local-db/docker-compose.yml down -v`.
- Test tích hợp và E2E vẫn dùng database tạm riêng (`TEST_DB_*`), không đụng bản sao này.
