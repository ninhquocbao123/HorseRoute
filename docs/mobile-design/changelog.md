# Changelog: sửa theo review 07 và chuyển sang code

Ngày 30/10/2026. Long yêu cầu sửa hết 52 mục trong [07-review.md](07-review.md) và bắt đầu viết app luôn, không chấm lại.

Các mục được sửa thẳng trong app `RouteHorse_mobile` (Expo, chạy trên Android Studio). Token và quy tắc cập nhật trong [05-design-system.md](05-design-system.md), mục 2, 3, 5 và 8, cùng [tokens/theme.ts](tokens/theme.ts). Các bản HTML prototype trong `ui/` **không** vẽ lại; từ nay app là nguồn đúng.

Đường dẫn bên dưới tính từ `RouteHorse_mobile/`.

## Critical

| Mục | Đã sửa | Ở đâu |
| --- | --- | --- |
| R-01 | Camera bị từ chối: PhotoPicker hiện câu giải thích, nút "Chọn ảnh từ thư viện" và "Mở Cài đặt" ngay trong ô ảnh. Báo cáo bắt buộc ảnh vẫn gửi được. | `src/ui/PhotoPicker.tsx` |
| R-02 | Giới tính chỉ còn Chưa rõ / Đực / Cái, có gợi ý "Ngựa thiến chọn Đực, ghi trong ghi chú". Số hộ chiếu không bắt buộc ở hồ sơ, bắt buộc khi đặt chuyến (ngựa thiếu số bị khóa ở bước chọn ngựa). Ngày sinh là chọn ngày. | `app/customer/horse/[id].tsx`, `app/customer/request/index.tsx` |

## Major

| Mục | Đã sửa | Ở đâu |
| --- | --- | --- |
| R-03 | Mọi phần tử bấm được của tài xế ≥ 56: header, chip, Hủy, Hoàn tác, nút bản đồ, ô giờ. Áp tự động qua `DensityProvider density="crew"`. | `src/theme/index.tsx`, `app/crew/_layout.tsx`, `src/ui/*` |
| R-04 | Hộ tống dùng cùng mật độ 56: chip ngựa, chip lọc, nút ±, Ghi nhanh. | như R-03, `src/features/escort/sheets.tsx` |
| R-05 | Cả app chỉ còn 4 cỡ chữ 24 / 17 / 15 / 12. Mọi chữ đi qua `Text` với biến thể trong `typography`. | `src/theme/tokens.ts`, `src/ui/Text.tsx` |
| R-06 | DRV-02: giờ dự kiến 24 đậm cùng dòng "Đúng giờ / Trễ x", khoảng cách 17. DRV-01: giờ khởi hành lên dòng đầu thẻ, 17 đậm; mã đơn thành dòng phụ. | `src/features/driver/DriverTrip.tsx`, `app/crew/(tabs)/index.tsx` |
| R-07 | Nhãn nút chính là động từ + tên ngắn ("Đã đến Svay Rieng"), tối đa 2 dòng, nút tự cao lên. "Báo sự cố" thành hàng riêng phía trên nút chính. | `src/lib/trip.ts`, `src/ui/Button.tsx`, `DriverTrip.tsx` |
| R-08 | Chip đang chọn có token riêng; dark dùng nền #e8f4f4, chữ #0b3b42. Viền ở cả hai trạng thái, chip không đổi kích thước. | `tokens.ts`, `src/ui/Chip.tsx` |
| R-09 | Tại điểm giao, DRV-02 hiện "Người nhận: tên · Gọi" từ `recipient`. Không có số thì "Gọi điều phối". | `DriverTrip.tsx`, `src/features/crew/components.tsx` |
| R-10 | Banner "Chỉ gửi vị trí khi mở app · Mở Cài đặt" (warning), "Định vị của máy đang tắt · Bật định vị" và "Chưa được dùng vị trí" (danger) trên DRV-02 và DRV-05. Trạng thái đọc lại mỗi 15 giây. | `src/lib/gps.ts`, `components.tsx` |
| R-11 | COM-07 có chữ riêng cho Android: bước 1 chọn "Khi dùng ứng dụng", bước 2 app mở Cài đặt để chọn "Luôn cho phép". | `app/crew/location.tsx`, `requestGps()` |
| R-12 | Cần bổ sung vì thiếu giấy: nút chính "Tải giấy tờ trên web" (mở đúng đơn), nút phụ "Gửi lại yêu cầu". Thiếu thông tin đơn: giữ "Sửa và gửi lại". | `app/customer/order/[id]/index.tsx` |
| R-13 | Sheet "Mở trang thanh toán" nói trước: web mở trong trình duyệt, nếu hỏi đăng nhập thì dùng đúng email này. Mã một lần (B3) vẫn là đề xuất backend. | `src/features/customer/shared.tsx` |
| R-14 | Thẻ ngựa của hộ tống có nút chữ "Báo bất thường" 56 viền đỏ thay "⋯". ESC-05 đổi nhãn tương tự. | `src/features/escort/EscortTrip.tsx`, `app/crew/trip/[id]/horse/[horseId].tsx` |
| R-15 | Khóa mức độ sự cố đổi thành RED / ORANGE / YELLOW đúng API. | `tokens.ts` (`incidentSeverity`) |
| R-16 | Bước 3 của yêu cầu có ô "Tên người nhận" và "SĐT người nhận" (không bắt buộc), gửi trong `booking.recipient`. Câu mẫu không còn số điện thoại. Backend đã đọc `booking_details.recipient` nên tài xế thấy ngay. | `app/customer/request/index.tsx` |
| R-17 | Logo thật cho icon app, splash và đăng nhập. Icon ngựa nét Lucide chỉ dùng ở tab bar và ô ảnh. | `assets/*`, `app/login.tsx`, `src/ui/Icon.tsx` |

## Minor

| Mục | Đã sửa | Ở đâu |
| --- | --- | --- |
| R-18 | Hộp xác nhận: "Ở lại" trên, "Đăng xuất" đỏ dưới. Không dùng vàng cho hành động phá hủy. | `src/ui/Sheet.tsx` (`ConfirmDialog`), `AccountScreen.tsx` |
| R-19 | Nút vàng của wizard luôn là "Tiếp tục"; ô không bắt buộc ghi "(không bắt buộc)" ở nhãn. | `request/index.tsx` |
| R-20 | Nhãn báo cáo mới dùng tone theo tình trạng. Số đếm chuông và nhãn "Mới" dùng teal. | `tokens.ts` (`countBg`), `app/customer/(tabs)/index.tsx`, `src/ui/TabBar.tsx` |
| R-21 | CUS-05: báo cáo là dòng phụ trong lộ trình, ngăn bằng đường kẻ. DRV-09: phản hồi điều phối là đoạn có vạch trái. | `app/customer/order/[id]/track.tsx`, `src/features/driver/IncidentsTab.tsx` |
| R-22 | Placeholder và lý do khóa dùng textSecondary. | `tokens.ts` (`placeholder`), `request/index.tsx` |
| R-23 | Số bước trên nền đậm dùng onBrand. | `app/customer/request/sent.tsx` |
| R-24 | Chữ phụ trên gradient dùng #d3e5e7 cỡ 15. | `tokens.ts` (`onBrandMuted`), trang chủ khách |
| R-25 | Dark: thẻ #102b2f, đường kẻ #2a5055. | `tokens.ts` |
| R-26 | "Lâu chưa uống" thống nhất một kiểu: badge cam có icon. | `EscortTrip.tsx`, 05 mục 5.14 |
| R-27 | Chip lọc 44 với khách, 56 với tài xế và hộ tống. | `Chip.tsx`, 05 mục 5.7 |
| R-28 | `inputHeight` 56. | `tokens.ts`, `src/ui/Form.tsx` |
| R-29 | Mã sự cố hiển thị `#id`, không còn "SC-0457". | `src/lib/format.ts` (`incidentCode`) |
| R-30 | Một quy tắc tên ngắn dùng chung cho nút, timeline, bản đồ, tiêu đề. Trường `short_name` (B4) vẫn là đề xuất. | `format.ts` (`shortStopName`) |
| R-31 | Bỏ câu "Điều phối đã được báo"; khi trễ chỉ hiện "Trễ so với kế hoạch x". | `track.tsx` |
| R-32 | DRV-13 có dòng Người nhận. | `app/crew/trip/[id]/done.tsx` |
| R-33 | Hàng chờ gửi có mục "Bị từ chối" kèm "Sửa giờ và gửi lại" và "Bỏ mục này". | `app/crew/queue.tsx`, `src/lib/queue.ts` |
| R-34 | CUS-05 có bản đồ tĩnh 160 vẽ tuyến và vị trí ước tính, chạm mở bản đồ toàn màn. | `track.tsx`, `app/customer/order/[id]/map.tsx` |
| R-35 | Đăng ký khách hàng làm ngay trong app (`POST /auth/register`). | `app/register.tsx` |
| R-36 | DRV-03: "Xong, sẵn sàng khởi hành" (vàng, 64) trên, "Đánh dấu tất cả" (tertiary) dưới. | `app/crew/trip/[id]/checks.tsx` |
| R-37 | Báo sự cố: ảnh ngay dưới loại và mức độ, vị trí tự lấy ngay dưới ảnh. | `app/crew/trip/[id]/incident.tsx` |
| R-38 | ESC-04 tự lưu nháp trên máy, bỏ nút "Lưu nháp". Số đo ngoài khoảng thường gặp có viền và chữ cam, cùng ngưỡng với CUS-06. | `app/crew/trip/[id]/report.tsx`, `tokens.ts` (`vitalsNormal`) |
| R-39 | "Chọn tất cả / Bỏ chọn" là nút chữ cạnh nhãn nhóm. | `src/features/escort/sheets.tsx` |
| R-40 | Sheet: quay lại ở trái, đóng ở phải. | `Sheet.tsx` |
| R-41 | Chọn ngựa: ngựa chọn được lên đầu; ngựa khóa gom cuối dưới "Chưa chọn được", icon khóa thay ô tick, lý do màu textSecondary. | `request/index.tsx` |
| R-42 | Back của Android: đóng sheet và dialog; form có dữ liệu thì hỏi trước khi rời; wizard lùi một bước. Dialog bo 16. Bảng hành vi trong 06-ui.md. | `Sheet.tsx` (`useLeaveGuard`), `request/index.tsx` |
| R-43 | Nhãn trợ năng cho StopTimeline, vạch mức độ, Stepper (adjustable), bản đồ, thanh Hoàn tác ("Hoàn tác, còn 4 giây"). Hoàn tác kéo dài 12 giây khi bật trình đọc màn hình. | `components.tsx`, `primitives.tsx`, `Form.tsx`, `TripMapView.tsx`, `Notice.tsx` |
| R-44 | Thống nhất "Hủy"; mức ăn "Không ăn" (khác tình trạng "Bỏ ăn"); lọc "Đã giao", "Từ chối, đã hủy". | `tokens.ts` (`appetiteLabel`), `app/customer/(tabs)/orders.tsx` |

## Polish

| Mục | Đã sửa | Ở đâu |
| --- | --- | --- |
| R-45 | Khoảng cách giữa "Báo sự cố" và nút chính là 16. | `src/ui/Screen.tsx` (footer gap) |
| R-46 | Chạm vào giờ mở bộ chọn giờ của máy (lùi tối đa 2 giờ), không còn ±5 phút. | `Form.tsx` (`DateTimeField`) |
| R-47 | Bỏ nhãn "Kế tiếp" trong timeline; điểm hiện tại là vòng vàng. | `components.tsx` |
| R-48 | Số và đơn vị nối bằng khoảng trắng không ngắt. | `format.ts` (`withUnit`) |
| R-49 | Dữ liệu mẫu không còn: app đọc dữ liệu thật từ API. | toàn app |
| R-50 | Màn kết quả mở đầu bằng thông tin thật canh trái ("Đã giao 2 ngựa lúc 10:40"). Màn xin quyền dùng câu ngắn có icon nội dung. | `done.tsx`, `incident-sent.tsx`, `request/sent.tsx`, `location.tsx` |
| R-51 | Ô ảnh giữ chỗ là icon ngựa trên nền phẳng. | `src/ui/States.tsx` (`HorsePlaceholder`) |
| R-52 | Ghi chú DRV-05, DRV-09 đã là P0 (06-ui.md). Màu bản đồ thành nhóm token `map`. | `tokens.ts`, `TripMapView.tsx` |

## Vẫn cần backend (không sửa web hay backend theo yêu cầu)

Theo mục 5 của 07-review.md. App chạy được với API hiện tại; các đề xuất dưới đây chỉ làm trải nghiệm tốt hơn.

- B3 mã đăng nhập một lần cho web: hiện app nói trước cho khách cách đăng nhập web.
- B4 `short_name` cho điểm dừng: hiện dùng quy tắc rút gọn trong app.
- B5 mã sự cố: hiện dùng `#id`.
- B8 khoảng bình thường của số đo trong `packages/shared`: hiện để ở `vitalsNormal` của app.
- B9 tổng chăm sóc theo ngày: app tự cộng các bản ghi hôm nay theo giờ máy.
- B10 trạng thái định vị của máy tài xế: chưa có, banner chỉ hiện trên máy tài xế.
- Thông báo đẩy (FCM) cần dự án Firebase; hiện app nhận realtime qua socket khi đang mở và làm mới định kỳ.

## Đối chiếu với luồng 03-user-flows (02/11/2026)

Các chỗ code lệch so với luồng đã chốt, đã sửa:

| Luồng | Sửa | File |
| --- | --- | --- |
| F-D3 | Đến/rời điểm dừng ghi ngay 1 chạm, có Hoàn tác 5 giây (quyết định 29/10). Xuất phát, thông quan, giao ngựa vẫn qua hộp xác nhận. Nút "Ghi với giờ khác" để sửa giờ khi quên ghi. | `DriverTrip.tsx` |
| F-D2 | Checklist còn mục chưa tick vẫn cho đi tiếp sau hộp "Còn N mục chưa kiểm tra". | `checks.tsx`, `checks.ts` |
| F-D2 | Bấm Xuất phát khi chưa có vị trí "Luôn cho phép": mở COM-07 trước, quay lại thì mở hộp xác nhận. | `DriverTrip.tsx` |
| F-C3 | Mở app khi mất sóng không còn bị đăng xuất: giữ phiên, dùng hồ sơ đã lưu; dữ liệu đã tải lưu trên máy 24 giờ. | `auth.tsx`, `app/_layout.tsx` |
| F-C2 | Phiên hết hạn: hàng chờ giữ nguyên, gửi tiếp khi đăng nhập lại. Đăng nhập tài khoản khác khi còn mục chưa gửi: hỏi đăng nhập lại tài khoản trước hay bỏ các mục. | `queue.ts`, `auth.tsx`, `login.tsx` |
| F-K1 | Hồ sơ ngựa có ảnh (JPG/PNG ≤ 5 MB). Ảnh lỗi thì hồ sơ vẫn lưu, nút đổi thành "Tải lại ảnh". Danh sách ngựa hiện ảnh. | `horse/[id].tsx`, `horses.tsx` |
| F-K2 | Đơn nháp lưu lên máy chủ sau mỗi bước, thoát giữa chừng làm tiếp từ Đơn hàng. Lỗi trường từ máy chủ đưa về đúng bước có ô lỗi. | `request/index.tsx` |

## Theo yêu cầu của Long (05/11/2026)

| Mã | Thay đổi | Tệp |
| --- | --- | --- |
| U-01 | Thanh điều hướng dạng viên thuốc nổi. Tab đang chọn: icon tô đặc và chữ đậm màu `tabActive` (sáng: teal `#14606a`; tối: vàng `#f4b942`), thêm nền `surfaceMuted` rất nhạt. Không dùng vàng ở chế độ sáng vì chữ vàng trên nền trắng chỉ đạt 1.8:1. Icon có chi tiết bên trong được vẽ lại bằng màu nền để không mất nét. | `src/App.tsx`, `src/theme.ts` |
| U-02 | COM-10: khung hồ sơ có ảnh đại diện tròn, tên và vai trò nằm bên phải; email, SĐT, nơi ở ở dưới. Chạm ảnh để chụp hoặc chọn từ thư viện; ảnh cắt vuông giữa, 512 px, lưu qua `/users/me/avatar`. | `src/App.tsx`, `src/live-ui.tsx` |
| U-03 | Đăng xuất dùng nút `danger`: chữ và viền đỏ, nền không đổi. | `src/App.tsx` |
| U-04 | Giao diện: nhãn bên trái, nút gạt sáng/tối dùng chung với trang đăng nhập sát bên phải. Bỏ lựa chọn "Theo máy"; ai chưa từng chọn vẫn theo máy đến lần gạt đầu tiên. | `src/App.tsx`, `src/screens/LoginScreen.tsx` |
| U-05 | Thông báo: nút nhỏ "Đọc tất cả" ở góc phải, ngang hàng tiêu đề, chỉ hiện khi còn thông báo chưa đọc. Thêm API `POST /notifications/read-all`. | `src/App.tsx`, `apps/api/src/features/notifications` |
