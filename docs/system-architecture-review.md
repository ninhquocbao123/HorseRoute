# Kiến trúc hệ thống — đối chiếu ngày 30/10/2026

Phạm vi: mã nguồn và cấu hình trong repository; không xác nhận tình trạng dịch vụ đang triển khai. Expo / React Native được giữ theo xác nhận của chủ dự án, đang phát triển bên ngoài phần mã nguồn đã kiểm tra.

## Các thay đổi so với sơ đồ cũ

| Thành phần cũ | Thành phần phù hợp dự án |
| --- | --- |
| Next.js | React 18 + Vite |
| Expo / React Native | Giữ, ghi đang phát triển; dự kiến dùng chung API |
| Traefik | Nginx, phục vụ SPA và chuyển tiếp /api |
| NestJS REST API | Express 5 + TypeScript |
| PostgreSQL | MySQL 8 + TypeORM |
| Google Authentication | Email / password, bcrypt + JWT trong API |
| Google Maps | Mapbox; Leaflet dùng OpenStreetMap tiles mặc định |
| SePay | VNPay Sandbox, có luồng IPN xác nhận kết quả |
| Image & file storage | Tài liệu private local hoặc Supabase Storage theo cấu hình |
| NestJS Worker + BullMQ | Tác vụ định kỳ trong cùng tiến trình API |
| Redis cache & queue | Redis đã được khởi tạo/kết nối; chưa thấy dùng cho cache hay queue nghiệp vụ |
| Firebase / Mux / Resend / Vercel | Bỏ khỏi kiến trúc hiện tại vì chưa có căn cứ triển khai trong phần mã nguồn kiểm tra |

## Ranh giới triển khai cần thể hiện đúng

- Docker Compose có bốn service: web, api, mysql, redis. Web chứa Nginx và bản build React. Socket.IO và các timer nằm trong tiến trình API, không phải worker độc lập.
- Nginx hiện chỉ chuyển tiếp /api; thiếu /socket.io và cấu hình upgrade. Kết nối realtime đã có trong ứng dụng nhưng chưa hoàn chỉnh qua cổng Nginx hiện tại.
- Compose công khai cổng HTTP 80, chưa cấu hình TLS. Không nên ghi HTTPS/WSS đã triển khai nếu chưa bổ sung nơi kết thúc TLS.
- Upload mặc định dùng local; Supabase là lựa chọn cấu hình, không phải luôn đồng thời ghi cả hai. Compose chưa mount volume cho tài liệu local.
- VNPay hiện là sandbox; các phương thức mô phỏng trong UI không chứng minh đã tích hợp cổng MoMo thực tế.
- Thông báo lưu qua repository/MySQL; không có căn cứ ghi Firebase push.

## Căn cứ mã nguồn

- `apps/web/package.json`, `apps/api/package.json`: công nghệ và thư viện.
- `docker-compose.yml`, `docker/web.Dockerfile`, `docker/nginx/default.conf`: container và reverse proxy.
- `apps/api/src/index.ts`: khởi động HTTP, Socket.IO, Redis và hai tác vụ định kỳ.
- `apps/api/src/features/auth/auth.service.ts`: bcrypt và JWT.
- `apps/api/src/features/trips/trip-map-provider.ts`: Mapbox geocoding/directions.
- `apps/web/src/modules/coordinator/maps/RouteMap.tsx`: OpenStreetMap tiles.
- `apps/api/src/features/payments/vnpay.ts`, `apps/api/src/routes/index.ts`: VNPay Sandbox và IPN.
- `apps/api/src/features/documents/file-storage.ts`: local/Supabase storage.
- `apps/web/src/lib/socket.ts`: kết nối Socket.IO phía web.

## Dùng trên Eraser

Nội dung `system-architecture.eraser.txt` là mã sơ đồ Architecture Diagram để dán vào trình soạn thảo diagram-as-code của Eraser. Cú pháp tham chiếu: https://docs.eraser.io/architecture-diagram-syntax . Chưa kiểm chứng render trên Eraser và chưa cập nhật workspace online do giới hạn điều khiển Cốc Cốc.
