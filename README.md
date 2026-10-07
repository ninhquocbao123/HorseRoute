# My Project — NestJS + React + MySQL + Redis + Firebase + Docker

Monorepo (pnpm workspaces): `apps/api` (NestJS), `apps/web` (React + Vite), `packages/shared`.

## Chạy dev
```bash
corepack enable
cp .env.example .env          # điền thông tin Firebase
pnpm install
pnpm --filter @my-project/shared build
pnpm dev:infra                # MySQL + Redis
pnpm migration:run
pnpm dev:api                  # http://localhost:3000/api/v1  (Swagger: /docs)
pnpm dev:web                  # http://localhost:5173
```
> FE đọc biến `VITE_*` từ `apps/web/.env` → chạy `cp .env apps/web/.env` (hoặc tạo riêng file đó).

## Chạy bằng Docker (production-like)
Đặt `DB_HOST=mysql`, `REDIS_HOST=redis` đã được compose tự override.
```bash
docker compose up -d --build
```
Lần đầu cần chạy migration: mở port MySQL tạm thời hoặc chạy `pnpm migration:run` với `DB_HOST` trỏ tới DB.

## Endpoint
- `GET  /api/v1/health` (public)
- `POST /api/v1/auth/sync` — đồng bộ user Firebase → MySQL
- `GET  /api/v1/users/me`
- `GET  /api/v1/users` — chỉ role `admin` (custom claim `role` trong Firebase)
