# HorseRoute Mobile — Expo SDK 58

Ứng dụng dùng API thật của apps/api. Không có dữ liệu demo trong runtime.

## 1. Backend (terminal tại thư mục gốc repository)

Mở Docker Desktop và chờ engine sẵn sàng. Nếu MySQL đã có sẵn, chỉ khởi động Redis:

```powershell
docker compose -f docker-compose.dev.yml up -d redis
pnpm dev:api
```

API cần cả MySQL và Redis theo cấu hình môi trường hiện có. Không chạy seed demo. Kiểm tra http://localhost:3000/api/v1/health trước khi đăng nhập mobile.

## 2. Máy ảo Android

Mở Pixel_9a trong Android Studio → Device Manager. Trong apps/mobile:

```powershell
npm ci
npm run start:emulator
```

Lệnh mở Expo Go SDK 58 qua localhost và dùng API http://10.0.2.2:3000/api/v1. Không phụ thuộc địa chỉ Wi-Fi. Nếu cổng đang dùng, thêm `-- --port 8085`. Khi CLI hỏi cài Expo Go phù hợp, chọn Yes.

## 3. Điện thoại Android / Expo Go

Máy tính và điện thoại phải cùng mạng LAN; máy tính có thể kết nối vào điểm phát Wi-Fi của điện thoại. Trong apps/mobile:

```powershell
npm run start:phone
```

Quét QR mới trong Expo Go SDK 58; không dùng QR của development build. Script ưu tiên IP Wi-Fi, bỏ qua adapter WSL/Docker. App tự lấy địa chỉ API từ host của Metro, không lưu cứng IP Wi-Fi. Sau đổi mạng, dừng terminal và chạy lại. Có thể nhập URL exp://<IP-hiện-trên-terminal>:<cổng> trong Expo Go.

Có nhiều card mạng: có thể đặt REACT_NATIVE_PACKAGER_HOSTNAME trước khi chạy. API mặc định cổng 3000, website cổng 5173. Nếu dùng API đã triển khai hoặc cổng khác, đặt EXPO_PUBLIC_API_URL và EXPO_PUBLIC_WEB_URL trong .env.local rồi khởi động lại. Expo tunnel chỉ chuyển tiếp Metro, không tự chuyển tiếp backend; dùng API HTTPS riêng nếu điện thoại không cùng mạng.

Nếu app mở nhưng không đăng nhập được, trên trình duyệt điện thoại mở http://<IP-máy-tính>:3000/api/v1/health. Nếu không truy cập được: kiểm tra backend, mạng có chặn các thiết bị cùng Wi-Fi không, và quyền firewall cho Node/cổng 3000 và cổng Metro trên mạng tin cậy. Không tắt toàn bộ firewall.

## Android Studio / development build riêng

`npm run android` build/cài vn.horseroute.mobile; sau đó `npm run start:dev`. Cần SDK Android 37 và JDK tương thích Gradle. Thay đổi app.json thì chạy `npm run prebuild`. Native SDK 58 đã được tạo lại; chưa xác minh build APK. Expo Go không cần build APK riêng.

## Chức năng và giới hạn

Đăng nhập và SecureStore, đơn/hồ sơ/yêu cầu vận chuyển, theo dõi và báo giá, chuyến được phân công, mốc/điểm nghỉ, báo cáo sức khỏe và ảnh, chăm sóc, sự cố, thông báo. Nháp/checklist lưu theo tài khoản. Nghiệp vụ cần mạng; mất phản hồi thì kiểm tra máy chủ trước khi gửi lại. Thanh toán/giấy tờ mở web và cần đăng nhập riêng.

Chưa có GPS nền, FCM, hàng đợi đồng bộ offline hay bản đồ dẫn đường. Chưa bao phủ mọi màn trong tài liệu thiết kế.

## Kiểm tra

```powershell
npm run typecheck
npm test
npm run export:android
```

Đã kiểm tra màn đăng nhập trên Pixel_9a / Expo Go 58.0.5. Điện thoại thật và thao tác đăng nhập với tài khoản thật cần xác nhận trên thiết bị. Expo Doctor có cảnh báo do lockfile pnpm của repo cha + npm của mobile và thư mục android được tạo bằng prebuild; không xóa lockfile repo cha.
