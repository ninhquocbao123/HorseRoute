# 09 — Test và sửa lỗi mobile cho customer, tài xế, hộ tống

Ngày 05/11/2026. App: `apps/mobile`. Đợt 1 nằm trong commit `a04dff6`, đợt 2 (mục 5) trong commit `1d556e7`. Cả hai đã có trên `long` và `dev`.

## 1. Kết luận

**Toàn bộ lỗi đã biết ở mục 5 đã được sửa, nhưng mobile chưa hoàn thiện hết.** Vẫn còn màn thiếu so với thiết kế (mục 7), phần chưa test (mục 8). Migration mới đã chạy trên DB chung; còn phải triển khai API trước bản mobile mới (mục 6).

Plan mở rộng cho Manager, Specialist, Coordinator, Admin ở [08-staff-roles-plan.md](08-staff-roles-plan.md) đã bỏ, không thực hiện.

## 2. Cách test

| Lớp | Cách làm | Kết quả đợt 2 |
| --- | --- | --- |
| Tĩnh | `npm run typecheck`, Prettier trên các file đã sửa; `pnpm lint` ở `apps/api` | Đạt |
| Unit mobile | `npm test` trong `apps/mobile` | 24/24 (đợt 1 là 16) |
| Unit API | `pnpm test` trong `apps/api` | 178/178 (trước đó 176) |
| API thật | `apps/mobile/scripts/e2e-api.mts`, dùng trực tiếp `driverAction`, `orderPayload`, `profilePayload` | 27/27 trên code cuối. Trước khi sửa: 7 ca G2, G3 lỗi đúng dự kiến |
| Giao diện | Bấm trên máy ảo `Pixel_9a`, Expo Go SDK 58, đối chiếu với DB | Xem mục 3, 4, 5 |

Toàn bộ chạy trên MySQL và Redis dùng một lần trong Docker (cổng 33077, 63790), không đụng DB chung của nhóm. Môi trường thử đã xóa sau khi xong.

Dựng lại môi trường: tạo container `mysql:8.0`, nạp riêng các lệnh `CREATE TABLE` của `apps/api/test/fixtures/schema.sql`, chạy `pnpm typeorm migration:run -t none`, đặt sẵn mọi biến `DB_*`, `REDIS_*`, `DOCUMENT_STORAGE_PROVIDER=local` trong shell rồi chạy API. Script từ chối chạy nếu không có `E2E_DB_PORT` khác 3306.

## 3. Năm lỗi đợt 1: kiểm chứng lại

| # | Lỗi | Kiểm chứng lại đợt 2 |
| --- | --- | --- |
| 1 | Sự cố, báo cáo có ảnh kẹt ở "Chờ gửi" | **Sửa chưa đủ, xem L3 mục 5.** Sau khi sửa tiếp: báo cáo có ảnh gửi offline rồi có mạng lại, và ca ép `pm trim-caches` sau khi chụp, server đều nhận đúng 1 bản ghi kèm 1 ảnh |
| 2 | Báo cáo sức khỏe mặc định bị từ chối, app vẫn báo đã gửi | Đạt. API từ chối khi thiếu ghi chú gửi khách. Trên máy ảo, `Báo bất thường` báo lỗi tại ô ghi chú |
| 3 | Yêu cầu mới bị mất, app báo "Đã gửi" với mã đơn cũ | Đạt ở lớp API: đơn đã gửi không còn tiếp tục từ nháp, yêu cầu mới tạo đúng đơn mới |
| 4 | Không lưu được hồ sơ ngựa nếu thiếu ngày sinh | Đạt trên API và máy ảo, cả tạo và sửa |
| 5 | Màn tài xế quay về nút cũ sau khi mốc đã gửi | Đạt trên máy ảo, cả khi ghi mốc lúc mất mạng rồi có lại |

## 4. Luồng đã kiểm tra

"Máy ảo" là đã bấm trên giao diện. "API" là mới kiểm tra bằng payload của mobile. Cột "Đợt" là lần kiểm tra gần nhất.

| Actor | Luồng | Mức kiểm tra | Đợt | Kết quả |
| --- | --- | --- | --- | --- |
| Chung | Đăng nhập, đăng xuất | Máy ảo | 2 | Đạt |
| Chung | Đăng nhập tài khoản khác khi còn mục chưa gửi | Máy ảo | 1 | Đạt |
| Chung | Đăng ký, đổi mật khẩu | API | 2 | Đạt |
| Khách hàng | Thêm, sửa hồ sơ ngựa, luồng back sau khi lưu | Máy ảo | 2 | Đạt sau khi sửa |
| Khách hàng | Tải ảnh ngựa, trùng số hộ chiếu | API | 2 | Đạt |
| Khách hàng | Đặt chuyến đủ 4 bước, người nhận thiếu SĐT, gửi đơn | Máy ảo | 2 | Đạt sau khi sửa |
| Khách hàng | Báo giá còn hạn và hết hạn | Máy ảo | 2 | Đạt sau khi sửa |
| Khách hàng | Sửa đơn cần bổ sung, tải giấy tờ | API | 1 | Đạt |
| Khách hàng | Theo dõi hành trình, sơ đồ tuyến, đọc báo cáo sức khỏe | Máy ảo | 1 | Đạt |
| Tài xế | Danh sách chuyến, lộ trình có điểm nghỉ, check-in, đến nơi | Máy ảo | 2 | Đạt sau khi sửa |
| Tài xế | Checklist, bắt đầu chuyến, giao ngựa, hoàn tác | Máy ảo | 1 | Đạt (giao ngựa đợt 2 mới qua API) |
| Tài xế | Ghi với giờ khác, giờ lùi sang hôm qua, mục bị từ chối rồi gửi lại | Máy ảo | 2 | Đạt sau khi sửa |
| Tài xế | Ghi mốc khi mất mạng rồi có lại | Máy ảo | 2 | Đạt |
| Tài xế | Chuyến nhiều chặng qua cửa khẩu, thông quan | API | 2 | Đạt |
| Tài xế | Loại con sự cố bằng mã thật, xem phản hồi của điều phối | API | 2 | Đạt |
| Tài xế | Báo sự cố có ảnh | Máy ảo | 1 | Đạt. Đợt 2 mới kiểm tra qua API |
| Hộ tống | Danh sách ngựa, ghi nhanh khi mất mạng | Máy ảo | 2 | Đạt |
| Hộ tống | Tab Sự cố, xem phản hồi của điều phối | Máy ảo | 2 | Đạt sau khi sửa |
| Hộ tống | `Báo bất thường` có ảnh: online, offline, ép dọn cache | Máy ảo | 2 | Đạt sau khi sửa |
| Hộ tống | Báo cáo sức khỏe, sự cố y tế khẩn | API | 2 | Đạt |
| Tổ lái | Gửi lại sự cố, báo cáo, chăm sóc: 1 bản ghi, kể cả gửi đồng thời | API | 2 | Đạt |
| Tổ lái | Ghi bù 3 giờ, 21 giờ từ hàng chờ được nhận; 25 giờ bị từ chối | API, máy ảo | 2 | Đạt |

## 5. Lỗi đã sửa ở đợt 2

Các lỗi mục 5 cũ:

| # | Lỗi | Cách sửa | Kiểm chứng |
| --- | --- | --- | --- |
| G2 | Gửi lại sự cố, báo cáo, chăm sóc tạo bản ghi trùng | Migration `1800000092000-ClientRequestIds`: cột `client_request_id` và khóa duy nhất theo người tạo. Hàng chờ gửi mã mục. Gửi lại thì trả bản đã có, không thông báo lại | API, gồm 3 yêu cầu đồng thời. Máy ảo: mã mục đến DB. Migration chạy được cả chiều lùi |
| G3 | Mất mạng quá 2 giờ thì mốc và ghi chăm sóc bị từ chối | Phương án A đã chốt: có `queuedAt` thì cửa sổ là 24 giờ; không có thì vẫn theo `LEG_BACK`, web không đổi | API; máy ảo: check-in lùi 21 giờ được nhận |
| 3 | Mở chuyến đã giao có thể tắt GPS của chuyến đang chạy | `stopTripTracking(tripId)` chỉ tắt đúng chuyến đang gửi | Chỉ unit test, xem mục 8 |
| 4 | Người nhận có tên, không SĐT thì không gửi được đơn | Báo ngay ở bước Người nhận. Ô SĐT ghi rõ bắt buộc khi đã có tên. API giữ nguyên quy tắc vì tài xế cần số này | Máy ảo |
| 5 | Sau khi lưu hồ sơ ngựa, back quay lại form; màn thêm mới mang tiêu đề "Chỉnh sửa hồ sơ" | Thêm mới thì thay form bằng hồ sơ vừa tạo, sửa thì quay về hồ sơ. Tiêu đề "Thêm hồ sơ ngựa" | Máy ảo |
| 6 | Màn chuyến tài xế không hiện điểm nghỉ | `tripTimeline` thêm điểm nghỉ theo kế hoạch tuyến, kèm giờ đến | Máy ảo |
| 7 | Hộ tống không có tab Sự cố | Thêm tab, bộ tab hộ tống thành 5 | Máy ảo |
| 8 | Báo giá hết hạn vẫn còn nút thanh toán | Ẩn nút khi đã hết hạn mà chưa đủ tiền cọc, khớp quy tắc API; đã cọc đủ thì vẫn trả tiếp được | Máy ảo |
| 9 | Ghi giờ lùi qua nửa đêm bị đổi thành giờ hiện tại | `pastClock`: lấy lần gần nhất đồng hồ chỉ giờ đó, có dòng nhắc "Giờ này là của hôm qua" | Máy ảo lúc 21:xx chọn 23:50 thành hôm qua; unit test ca 00:30 |

Lỗi mới phát hiện khi bấm thử, đã sửa:

| # | Lỗi | Nguyên nhân | Cách sửa | Kiểm chứng |
| --- | --- | --- | --- | --- |
| L1 | Hộp chọn giờ, ngày trên Android tự về giá trị cũ khi đang chọn | `onChange` viết inline làm thư viện mở lại hộp mỗi khi màn phía sau tải lại | Giữ callback và giá trị ổn định trong lúc hộp mở | Chọn 23 giờ, để yên 45 giây vẫn giữ. Trước khi sửa tự về 21 sau 11 giây |
| L2 | Form `Báo bất thường` mất dấu hiệu và ảnh sau khi quay về từ camera, hoặc sau nhịp tải lại. `Ghi nhanh` mất lựa chọn ngựa và giờ | Effect khởi tạo form phụ thuộc `trip.horses`, đổi tham chiếu mỗi lần tải lại | Chỉ khởi tạo lúc mở form | Có ảnh, chờ 35 giây vẫn giữ |
| L3 | Ảnh mất trước khi gửi trên máy ít dung lượng, mục bị từ chối "Ảnh đính kèm không còn trên máy" | Lỗi 1 chỉ chép ảnh lúc vào hàng chờ, cache có thể bị dọn trong lúc đang điền form | Chép sang `picked-photos` ngay khi chụp hoặc chọn; ảnh của form bỏ dở tự dọn sau 7 ngày | Offline chờ 35 giây; ép `pm trim-caches` rồi gửi |
| L4 | Chặng cuối đang dừng vẫn hiện "Kế hoạch rời, Trễ x" | Lấy giờ xuất phát của chính chặng đang dừng | Lấy giờ của chặng kế tiếp; chặng cuối không hiện | Máy ảo, unit test |
| L5 | Lộ trình hiện lặp "Dự kiến 08:00 · Dự kiến" | `Timeline` tự thêm hậu tố | Bỏ hậu tố | Máy ảo |
| L6 | Gửi lại mốc sau khi mất phản hồi bị báo "Bị từ chối" dù máy chủ đã ghi | Lần gửi lại nhận 409 | Lần trước mất phản hồi mà lần này 409 thì coi như đã đến nơi | API xác nhận 409, unit test logic; chưa tái hiện mất phản hồi trên máy |

Còn một điểm nhỏ chưa sửa: thẻ "Đặt cọc cho …" ở trang chủ khách hàng vẫn hiện với báo giá đã hết hạn, vì API danh sách đơn không trả hạn báo giá. Chạm vào thì màn báo giá báo đã hết hạn và không có nút thanh toán.

Một hiện tượng chưa rõ nguyên nhân: khi ép `pm trim-caches` chỉ vài giây sau khi bấm Done ở camera, form `Báo bất thường` hiện `Ảnh · 0/3`, ảnh không vào form. Gặp 1 lần; lần thử lại đợi ảnh vào form rồi mới ép dọn cache thì đạt. Người dùng chụp lại được và form báo thiếu ảnh nên không gửi nhầm. Chưa điều tra thêm.

## 6. Việc bắt buộc khi triển khai

1. Migration `1800000092000-ClientRequestIds` **đã chạy trên DB chung `wdp` ngày 05/11/2026**. API mới ghi cột `client_request_id`, nên mọi DB khác (máy cá nhân, môi trường mới) phải chạy migration này trước khi chạy API mới; nếu thiếu thì mọi lần tạo sự cố, nhật ký ngựa và ghi chăm sóc đều lỗi, kể cả từ web. Code cũ vẫn chạy được với DB đã migrate vì cột cho phép NULL.
2. Triển khai API trước bản mobile mới. API cũ từ chối `clientRequestId` và `queuedAt` vì trường lạ.
3. `queuedAt` do máy gửi lên nên tài xế có thể dùng API trực tiếp để ghi bù tới 24 giờ. Đây là hệ quả của phương án A đã chốt. Giờ vẫn phải đúng thứ tự mốc, và mọi thao tác đều ghi audit.

## 7. Còn thiếu so với thiết kế

- **Màn hình:** CUS-07 Nhật ký chăm sóc, COM-04 Quên mật khẩu, DRV-12 Cảnh báo từ điều phối (hiện chỉ nhận qua Thông báo), ESC-08 Danh sách nháp, đính chính báo cáo ở ESC-06.
- **Push và realtime:** chưa có FCM và socket, app làm mới mỗi 30 giây. Các luồng bắt đầu từ push chưa tồn tại.

## 8. Chưa test

- GPS nền, gồm cả bản sửa lỗi tắt nhầm GPS: Expo Go không chạy được, cần bản dev build.
- iOS và máy Android thật. Các bản sửa L1, hộp giờ, chỉ kiểm tra trên Android.
- Thanh toán VNPay trên web.
- Luồng liên role đầy đủ qua giao diện Manager, Specialist, Coordinator (đợt 2 tạo dữ liệu bằng SQL).
- Bấm trên máy ảo: xóa nháp rồi tạo yêu cầu mới; `Sửa giờ rồi gửi lại` trong hàng chờ; tài xế báo sự cố có ảnh sau các bản sửa đợt 2.
- Mất phản hồi thật ở giữa lần gửi trên máy (L6, G2): API và logic đã kiểm tra riêng.

## 9. Việc liên quan ngoài mobile

- `apps/api/test/flow4-tracking.mysql.cjs` đã lỗi thời so với schema (cột `plate_or_code`), không chạy được.
- Container Docker `horseroute-api-1` đang khởi động lại liên tục; chưa xem nguyên nhân.
- `pnpm-lock.yaml` đã có `apps/mobile` (commit `14d880a`) nhưng vẫn lệch với `apps/mobile/package.json`, nên `pnpm install --frozen-lockfile` ở gốc repo vẫn thất bại (`ERR_PNPM_OUTDATED_LOCKFILE`, thử lại ngày 05/11/2026 trên `91a1627`). Cách cài hiện tại: `npm ci` trong `apps/mobile`, `pnpm install --no-frozen-lockfile --filter '!@horseroute/mobile'` ở gốc rồi khôi phục `pnpm-lock.yaml`.

## 10. Đề xuất thứ tự tiếp theo

1. Triển khai API từ `dev` (code đã push, migration trên DB chung đã xong).
2. Làm bản dev build để kiểm chứng GPS nền.
3. Các màn còn thiếu và push.
4. Chạy trọn luồng liên role trên máy Android thật.
