# 11 — Kế hoạch thiết kế lại luồng tạo đơn trên mobile theo web

Ngày 06/11/2026. Trạng thái: **đã làm xong, Long duyệt theo đề xuất ở mục 8.** Kết quả ở mục 10.

Mục tiêu: khách tạo đơn trên mobile phải nhập đủ thông tin như web và ra cùng một dữ liệu, nhưng giao diện làm riêng cho điện thoại, không thu nhỏ màn web.

Nguồn đã đọc: `apps/web/src/features/customer/` (`CustomerJourney`, `BookingContacts`, `BookingHorsePicker`, `BookingServices`, `BookingSteps`, `useRouteDistance`) và `BookingScreen` trong `apps/mobile/src/screens/CustomerScreens.tsx`.

## 1. Vì sao phải sửa

Không chỉ khác về giao diện. **Mobile đang gửi dữ liệu cứng, trong khi màn báo giá của quản lý tính từ `booking`** (`manager.service.ts`, `context`).

| Mục | Web | Mobile hiện tại | Hậu quả |
| --- | --- | --- | --- |
| Thứ tự 4 bước | Chuyến đi → Chọn ngựa → Dịch vụ & bảo hiểm → Xác nhận | Chọn ngựa → Tuyến và ngày → Người nhận → Xem lại | Khác nhau giữa hai nền tảng |
| Loại chuyến | Trong nước hoặc Quốc tế | Không có | |
| Quốc gia | Chỉ VN với CN, TH | Thêm Campuchia, Lào, Khác | Tạo được đơn tuyến web không hỗ trợ, không ước tính được km |
| Địa chỉ | Chọn tỉnh, chọn xã, nhập địa chỉ cụ thể | Gõ tự do một dòng | Tính km kém chính xác |
| Người gửi | Đủ thông tin, có nút "Tôi là người gửi" | Tự lấy từ tài khoản, không sửa được | Không gửi hộ được |
| Người nhận | Bắt buộc đủ | Không bắt buộc, không có địa chỉ riêng | Bỏ trống tên thì đơn **không có `booking`** |
| CCCD / MST / Hộ chiếu | Bắt buộc | Gửi rỗng | Thiếu giấy tờ định danh |
| Khung giờ đón | 5 lựa chọn | Gửi rỗng | Điều phối không biết giờ |
| Hạng xe | Khách chọn 2, 4, 6, 9 ngựa | App tự chọn theo số ngựa | Báo giá lệch mong muốn |
| Khoang, thức ăn, cữ nước, bảo hiểm | Khách chọn | Cứng: tiêu chuẩn, không bảo hiểm | **Khách không mua được dịch vụ** |
| Quãng đường | Bắt buộc tính được mới đi tiếp | Lỗi thì gửi `1` km | **Báo giá có thể sai** |
| Ước tính chi phí | Có, cập nhật theo lựa chọn | Không có | Khách không biết chi phí trước |
| Trạng thái giấy tờ ngựa | Hiện 3 loại | Không có | |
| Điều khoản | Có nội dung | Chỉ ô đánh dấu | |

## 2. Giữ gì của mobile

Các phần này tốt hơn web, nên giữ:

- **Lưu nháp:** web chỉ giữ trong bộ nhớ, thoát trang là mất. Mobile lưu trên máy và trên máy chủ. Điện thoại hay bị ngắt giữa chừng nên cần giữ.
- **Xử lý nháp đã gửi** (lỗi 3 ở file 09) và `requestId` chống tạo đơn trùng.
- **Lý do khi không chọn được ngựa**, đặt vận chuyển từ hồ sơ ngựa (chọn sẵn ngựa), và luồng sửa đơn `NEED_INFO`.

## 3. Thiết kế 4 bước

Áp dụng [00-context.md](00-context.md): một nút chính cố định ở đáy, không phải lướt ngang, tiếng Việt đủ dấu, mỗi màn tối đa 4 cỡ chữ. Thanh tiến trình 4 bước giữ dạng hiện có, chạm bước đã qua để quay lại.

### Bước 1. Chuyến đi

```text
+--------------------------------------+
| ←  Đặt chuyến                        |
| Bước 1 trên 4: Chuyến đi             |
| (Trong nước)  ( Quốc tế )            |
| [Việt Nam]  ⇄  [Trung Quốc ▾]        |  chỉ hiện khi Quốc tế
| Ngày khởi hành          [Chọn ngày]  |
| -- Người gửi & điểm đón --           |
| [ Tôi là người gửi ]                 |
| Họ tên / Tên đơn vị *                |
| Số điện thoại *                      |
| Tỉnh / Thành phố *                 › |  mở sheet có ô tìm
| Xã / Phường *                      › |
| Tên trang trại / Địa chỉ cụ thể *    |
| CCCD / MST / Hộ chiếu *              |
| -- Người nhận & điểm giao --         |
| (các ô tương tự)                     |
+--------------------------------------+
| [        Tiếp tục: Chọn ngựa       ] |
+--------------------------------------+
```

- Lần đầu vào, tự điền người gửi từ tài khoản. Nút "Tôi là người gửi" để điền lại khi đã sửa.
- **Chọn tỉnh, xã bằng sheet có ô tìm kiếm không dấu**, vì danh sách dài (34 tỉnh và 3.321 xã ở Việt Nam).
- Dưới mỗi nhóm có dòng xem trước địa chỉ đầy đủ.
- Bấm Tiếp tục khi thiếu: cuộn tới ô đầu tiên bị lỗi, báo lỗi ngay tại ô.

### Bước 2. Chọn ngựa

```text
| Khung giờ đón                        |
| [06-08][08-10][10-12][13-15][15-17]  |  cuộn ngang, lòi mục sau
| Hạng xe                              |
| (2 ngựa) (4 ngựa) (6 ngựa) (9 ngựa)  |
| Đã chọn 2 / 5 ngựa      [+ Thêm ngựa]|
| [ Tìm tên, microchip, giống...     ] |  hiện khi trên 6 ngựa
| [x] Sao Mai                          |
|     Chip 123 · Thuần chủng · 5 tuổi  |
|     ✓ Hộ chiếu  ✓ Sổ tiêm  ○ Xét nghiệm
| [ ] Bạch Long · Đang thuộc đơn VCN.. |  mờ, nêu lý do
| Tiếp tục: Dịch vụ & bảo hiểm         |
```

- Danh sách cuộn thay cho phân trang của web.
- **Tự chọn hạng xe nhỏ nhất đủ chỗ khi chọn ngựa**; hạng không đủ chỗ thì khóa và ghi lý do. Web chỉ báo lỗi lúc gửi, nên đây là cải tiến nhỏ.
- Chạm "Thêm ngựa" rồi quay lại không mất nội dung đã nhập.

### Bước 3. Dịch vụ & bảo hiểm

```text
| Khoang trên xe                       |
| (•) Tiêu chuẩn       Đã gồm trong cước|
| ( ) Khoang đơn mở rộng  +xxx ₫/ngựa   |
| Gói thức ăn: Cơ bản, Nâng cao, Thể thao
| Cữ nước: Tiêu chuẩn, Mỗi 2 giờ, Mỗi giờ
|   Số cữ thêm mỗi ngựa      [−] 3 [+]  |
| Bảo hiểm: Không mua, Mua → chọn nhóm  |
| Yêu cầu thêm cho ngựa                 |
+---------------------------------------+
| Khoảng 1.457 km                       |
| Tổng ước tính  12.000.000 ₫        ⌃  |  chạm mở sheet chi tiết
| [       Tiếp tục: Xác nhận & gửi    ] |
+---------------------------------------+
```

- Web để phần ước tính ở cột bên phải. Mobile đổi thành **thanh tổng tiền cố định trên nút**, chạm mở sheet từng khoản.
- Giá lấy từ `GET /pricing/current`; tổng từ `POST /pricing/estimate`, gọi lại khi đổi lựa chọn.
- Quãng đường: đang tìm, lỗi có nút Thử lại. **Chưa có quãng đường và tổng tiền thì không đi tiếp**, giống web, không dùng `1` km nữa.

### Bước 4. Xác nhận & gửi

```text
| Sau khi gửi, quản lý duyệt và báo giá.|
| Bạn chỉ đặt cọc khi đã nhận báo giá.  |
| Chuyến đi            5/11 · 08-10  Sửa|
| Người gửi: tên · SĐT · địa chỉ     Sửa|
| Người nhận: tên · SĐT · địa chỉ    Sửa|
| Ngựa: Sao Mai, Bạch Long · Xe 2    Sửa|
| Dịch vụ: tiêu chuẩn, bảo hiểm      Sửa|
| Chi phí dự kiến                       |
|   Từng khoản ....................     |
|   Tổng ước tính       12.000.000 ₫    |
|   Đặt cọc 30% sau khi duyệt 3.600.000 |
| [ ] Tôi đồng ý điều khoản  (Xem)      |
| [         Gửi đơn chờ duyệt          ]|
```

- Mỗi nhóm có "Sửa" nhảy về đúng bước, sửa xong quay lại bước 4.
- Điều khoản mở trong sheet, cùng nội dung với web.
- "Hủy chuyến đang đặt" nằm ở dạng nút phụ dưới cùng, có hỏi xác nhận, xóa cả nháp trên máy chủ.
- CUS-15 Đã gửi giữ nguyên.

## 4. Quy tắc phải giống web

| Quy tắc | Nội dung |
| --- | --- |
| Tuyến | Trong nước: VN → VN. Quốc tế: VN ↔ CN hoặc TH, đảo chiều được |
| Đổi nước | Xóa tỉnh, xã của bên đó |
| Địa chỉ gửi đi | `địa chỉ cụ thể, xã, tỉnh` (`contactAddress`) |
| Ngày đi | Từ hôm nay trở đi |
| Hộ chiếu ngựa | Ngựa thiếu số hộ chiếu thì chưa đi tiếp được |
| Nhóm bảo hiểm | Mặc định theo giống nếu cả đoàn cùng giống, còn lại là `Khác` |
| Cữ nước | Chọn cữ thì số cữ tối thiểu 1, tối đa 1000 |
| Đơn đi | Luôn có `booking` đầy đủ; gửi qua `POST` hoặc `PUT /orders` rồi `/submit` |

## 5. Tổ chức code

`CustomerScreens.tsx` đang 2.778 dòng, nên tách ra:

- `src/screens/booking/`: `BookingScreen`, 4 bước, sheet chọn địa điểm, sheet chi phí.
- `src/booking-domain.ts`: hàm thuần cho kiểm tra từng bước, dựng payload, gợi ý hạng xe, nhóm bảo hiểm, có unit test.
- **Dữ liệu tỉnh, xã:** chuyển 3 file JSON từ web sang `packages/shared` để web và mobile dùng chung; tải theo nước khi cần. Tổng khoảng 256 KB. Đây là thay đổi nhỏ duy nhất ở web, chỉ đổi đường dẫn import.
- `FilterBar` cuộn ngang và `Sheet` có sẵn được dùng lại. Thêm `SelectSheet` dùng chung.

API không cần đổi: các endpoint đều có sẵn. `POST /pricing/estimate` và `/customer/route-distance` đã được web dùng.

**Cần kiểm tra khi làm:** lưu nháp lên máy chủ khi `booking` chưa đủ. `bookingSchema` yêu cầu `distanceKm` ít nhất 1 nên nháp chưa có quãng đường sẽ không qua. Hướng xử lý: chỉ gửi `booking` khi đủ điều kiện, phần còn lại giữ trên máy.

## 6. Thứ tự làm

- [x] **Giai đoạn 1. Nền:** chuyển dữ liệu địa điểm, `booking-domain.ts` và test, `SelectSheet`.
- [x] **Giai đoạn 2. Bước 1 và 2:** người gửi, người nhận, địa điểm, loại chuyến, khung giờ, hạng xe, danh sách ngựa.
- [x] **Giai đoạn 3. Bước 3 và 4:** dịch vụ, ước tính, xác nhận, điều khoản, gửi đơn.
- [x] **Giai đoạn 4. Nháp và sửa đơn:** nháp cũ, nháp qua lại web, luồng `NEED_INFO`.
- [x] **Giai đoạn 5. Rà soát:** kiểm thử mục 7, cập nhật 02-screens (CUS-11 đến CUS-14), 03-user-flows, mockup HTML, changelog; bỏ `CountryPicker` cũ.

## 7. Kiểm thử

| Nhóm | Ca |
| --- | --- |
| Khớp web | Cùng lựa chọn, đơn từ mobile và web có `booking` và tổng ước tính giống nhau; quản lý mở báo giá thấy đúng |
| Tuyến | Trong nước, quốc tế hai chiều, đảo chiều, đổi nước xóa tỉnh xã |
| Thiếu thông tin | Mỗi ô bắt buộc báo lỗi đúng chỗ; thiếu quãng đường không đi tiếp được |
| Ngựa | Ngựa đang bận, thiếu hộ chiếu, vượt sức chứa, chọn sẵn từ hồ sơ |
| Giá | Đổi từng dịch vụ thì tổng đổi; mất mạng hoặc lỗi bảng giá báo rõ và Thử lại |
| Nháp | Thoát giữa chừng, mở lại đúng bước; nháp bản cũ; thêm ngựa rồi quay lại; hủy xóa nháp |
| Gửi | Bấm hai lần chỉ một đơn; lỗi mạng giữa lúc gửi; sửa đơn `NEED_INFO` |
| Giao diện | Màn hẹp 360 và 375, chế độ tối, bàn phím không che ô đang nhập, iPhone và Android |

Chạy trên DB dùng một lần, thêm các ca API vào `apps/mobile/scripts/e2e-api.mts`.

## 8. Câu hỏi cần chốt

1. **Phương thức đặt cọc ở bước 4:** web có Chuyển khoản, Ví, Thẻ, ghi là "lựa chọn dự kiến". Khi dùng VNPay, khách chọn ngay trên trang VNPay. Đề xuất: **bỏ trên mobile**, vẫn gửi mặc định `BANK` để API nhận.
2. **CCCD / MST / Hộ chiếu của cả người gửi và người nhận có bắt buộc không?** Web bắt buộc, API không. Khách thường không có số của người nhận. Đề xuất: **giữ bắt buộc giống web** cho đồng nhất; nếu thấy khó dùng thì đổi cả hai nền tảng sau.
3. **Thời gian chuyến (`durationDays`):** web không có ô nhập và luôn gửi 1 ngày; mobile đang tính theo quãng đường. Phí "Tài xế + hộ tống / ngày" nhân theo giá trị này (`pricing.type.ts`), nên **web đang tính 1 ngày công cả với chuyến rất xa**, có thể thu thiếu. Đề xuất: làm một hàm dùng chung, số ngày = quãng đường chia 500 km làm tròn lên, áp dụng cho cả web và mobile. Nếu chưa muốn đổi web thì mobile theo web để báo giá khớp, và ghi nhận để nhóm xem lại.
4. **Nháp cũ trên máy đang dùng định dạng cũ:** đề xuất giữ ngựa, ngày, và ghi chú đã nhập, bắt nhập lại phần địa chỉ, không tự đoán từ dòng chữ cũ.
5. **Làm trước hay sau kế hoạch VNPay (file 10)?** Hai việc độc lập. Đề xuất: **làm file này trước**, vì không phụ thuộc khóa VNPay và làm đúng dữ liệu báo giá, là đầu vào của thanh toán.

## 9. Ngoài phạm vi

Đổi cách tính giá, thêm dịch vụ mới, bản đồ chọn điểm đón, sửa màn web (trừ đường dẫn import dữ liệu), các ô `border`, `customsCode`, `importPermit` mà web cũng chưa cho nhập (mobile gửi giống web).

## 10. Kết quả

| Lớp | Kết quả |
| --- | --- |
| Unit mobile | 37/37, gồm 14 ca mới ở `tests/booking.test.ts` |
| Unit API | 179/179 |
| API thật trên DB dùng một lần | 28/28. Ca mới: đơn từ form mobile có đủ `booking`, khách thấy trong danh sách, quản lý thấy đơn và đúng giá khách đã thấy, duyệt đơn, lập và duyệt báo giá, khách xem được báo giá |
| Lint và build web | Đạt |
| Máy ảo Android | Đi trọn 4 bước, gửi đơn, DB có đủ dữ liệu; lỗi từng ô; tìm tỉnh, xã không dấu; khôi phục nháp đúng bước; xe tự nâng hạng; sửa từ màn xác nhận; đơn Cần bổ sung; quốc tế và đảo chiều; hủy chuyến |

**Quyết định ở mục 8 khi làm:** bỏ chọn phương thức cọc trên mobile, gửi `BANK`; CCCD bắt buộc cho cả hai bên; số ngày `estimateDurationDays` dùng chung trong `packages/shared`, gồm cả web; nháp cũ giữ ngựa, ngày, ghi chú, người nhận; làm trước kế hoạch VNPay.

**Thay đổi giá trên web:** phí "Tài xế + hộ tống / ngày" giờ nhân theo số ngày tính từ quãng đường, nên tổng ước tính các chuyến xa tăng so với trước. Đơn đã tạo không bị đổi.

**Chưa làm hoặc chưa kiểm chứng:**

- Chưa bấm thử trên iPhone và chưa bấm thử web sau khi đổi số ngày (mới lint, build và unit test).
- Đồng bộ với quản lý mới kiểm tra qua đúng các API màn web đang gọi (`/manager/intake`, `/manager/orders/:id/context`, duyệt đơn, báo giá), chưa bấm trên giao diện web.
- Mockup HTML các màn CUS-11 đến CUS-14 chưa cập nhật.
- Điểm không có đường bộ, như Côn Đảo, API báo "Chưa kết nối được dịch vụ bản đồ" nên khách không đi tiếp được. Web cũng vậy. Câu chữ chưa đúng bản chất, cần sửa ở API.
