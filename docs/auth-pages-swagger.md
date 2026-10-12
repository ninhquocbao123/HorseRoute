# Đăng ký, các trang vai trò và Swagger

## Cơ chế hiện tại

Dự án dùng JWT + mật khẩu bcrypt trong MySQL. Không dùng Firebase để đăng nhập/đăng ký hoặc đổi mật khẩu. Các guard/module/helper Firebase không còn được tham chiếu đã được gỡ khỏi src; migration firebase_uid được giữ để không phá lịch sử schema.

- Đăng ký cần họ tên (2–100 ký tự), email (tối đa 100), số điện thoại (9–15 chữ số, có thể có dấu +), mật khẩu (ít nhất 8 ký tự, tối đa 72 byte UTF-8), địa chỉ nhà (5–255).
- Backend luôn tạo CUSTOMER, ACTIVE. Không nhận role từ trình duyệt. Có xử lý email trùng, kể cả hai yêu cầu đồng thời.
- Đăng ký thành công tự đăng nhập, chuyển vào dashboard Customer và có thể mở Đơn của tôi để dùng Flow 1.
- Tài khoản nhân sự được cấp riêng trong hệ thống; không có tùy chọn tự đăng ký Manager.
- Schema WDP v2 đã có phone/address; không cần migration mới cho 2 trường này. Flow 1 vẫn cần migration OrderDrafts đã tạo trước đó.

## FE pages

Các trang nằm trong apps/web/src/features/auth/pages/{Customer,Manager,Specialist,Coordinator,Driver}. Mỗi trang dùng components/DashboardLayout.tsx để tránh nhân bản menu, tài khoản và thông báo. HomePage chọn trang theo role MySQL; Driver dùng DRIVER_ESCORT.

Customer/Manager nối OrdersWorkspace và API Flow 1. Các khu vực Flow 2–4 vẫn hiển thị rõ chưa kết nối; thay đổi này không bổ sung nghiệp vụ Flow 2–4.

## Chạy và thử API

Tại thư mục gốc:

```powershell
pnpm --filter @my-project/shared build
pnpm dev:api
# Terminal khác
pnpm dev:web
```

Trong development, mở http://localhost:3000/docs (đổi cổng theo PORT). OpenAPI JSON tại /docs-json. Production giữ Swagger tắt.

1. Authentication → POST /api/v1/auth/register: điền đủ 5 trường hoặc login với tài khoản đã có.
2. Sao chép accessToken vào Authorize (chỉ dán token).
3. Flow 1 - Orders → tạo draft với horses: [], sửa thông tin đầy đủ, rồi submit.
4. Đăng nhập tài khoản Manager và Authorize token tương ứng để review.

## Kiểm tra đã thực hiện

- BE và FE build thành công; TypeScript kiểm tra cả noUnusedLocals/noUnusedParameters.
- 8 test workflow, 6 test auth, 1 test metadata entity đạt.
- Swagger kiểm tra các route /api/v1, 5 trường đăng ký bắt buộc, schema ngựa lồng nhau và bảo mật JWT đạt.
- 35 kiểm tra render trang theo role đạt.
- Chưa chạy đăng ký trực tiếp trên database wdp hoặc nghiệm thu giao diện bằng trình duyệt trong lần thay đổi này.

Tài liệu Swagger tham khảo: https://docs.nestjs.com/openapi/types-and-parameters
