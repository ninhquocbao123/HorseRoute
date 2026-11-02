# 04 — Wireframe (prototype HTML bấm thử)

Trạng thái: đợt 1/4 (Tài xế), 2/4 (Hộ tống), 3/4 (Khách hàng) xong 29/10/2026. Còn lại: Chung.

## Đường dẫn

| Actor | File trong repo | Link xem (điện thoại được) |
| --- | --- | --- |
| Tài xế | `docs/mobile-design/wireframes/driver.html` | https://claude.ai/artifact/MX4PKaAm79n3JdBPb6fbPV |
| Hộ tống | `docs/mobile-design/wireframes/escort.html` | https://claude.ai/artifact/Bf2gNwzZ1bT4fm2vhK7Zes |
| Khách hàng | `docs/mobile-design/wireframes/customer.html` | https://claude.ai/artifact/NZFgBNpcveqYKqBGHgYsjB |

Màu trong khung (Long chỉnh 29/10): xanh #0b3b42 cho chữ đậm, thẻ nổi bật, thanh trạng thái; xanh #14606a cho thanh thông báo; vàng #f4b942 chỉ cho nút chính; nền trắng và #f6faf9. Không dùng đen hay xám trung tính.

Mở file trực tiếp bằng trình duyệt, không cần cài gì. Hai chế độ:

- **Bấm thử**: một khung điện thoại, bấm nút trong khung để đi theo luồng ở 03-user-flows.md. Thanh "Trạng thái" bên ngoài khung đổi màn hiện tại sang Đang tải, Trống, Lỗi, Mất sóng. Bảng bên phải ghi hành động chính, dữ liệu, API, hành vi đặc biệt.
- **Xem tất cả màn**: mỗi màn một hàng, xếp các biến thể cạnh nhau. Chọn tỉ lệ 100% trước khi đưa sang Figma bằng plugin html.to.design. Mỗi khung có `id` = mã màn (biến thể thêm `--1`, `--2`...).

## Màn đã vẽ — Tài xế

| Mã | Màn | Biến thể |
| --- | --- | --- |
| DRV-01 | Chuyến của tôi | bình thường, đang tải, trống, lỗi, mất sóng |
| DRV-02 | Chuyến hôm nay | 9 bước của chuyến, Hoàn tác 5 giây, mất sóng (mốc Chờ gửi), đang tải, lỗi, chuyến chưa sẵn sàng |
| DRV-03 | Kiểm tra trước chuyến | 3/5, hỏi lại khi còn mục chưa tick, 5/5 |
| COM-07 | Giải thích quyền vị trí nền | (màn chung, vẽ ở đây vì nằm trong luồng bắt đầu chuyến) |
| DRV-04 | Xác nhận mốc (bottom sheet) | Bắt đầu chuyến, Đã thông quan + sửa giờ, Đã giao, lỗi 409, mất sóng |
| DRV-06 | Báo sự cố bước 1 | chưa chọn, đã chọn |
| DRV-07 | Báo sự cố bước 2 | đang điền, Y tế ngựa chưa chọn ngựa, lỗi ảnh, mất sóng |
| DRV-08 | Đã gửi / chờ gửi | đã gửi, lưu chờ gửi |
| DRV-13 | Hoàn tất chuyến | hoàn tất, còn mục chờ gửi |
| COM-12 | Hàng chờ đồng bộ (bottom sheet) | (màn chung) |

Màn P1 và màn chung khác (DRV-05, 09, 10, 11, COM-09, COM-10) chỉ là khung giữ chỗ để tab và nút bấm được.

## Quyết định bố cục và lý do

1. **Một nút chính 64pt ở đáy, đổi nhãn theo bước** (DRV-02 hướng A). Tài xế chỉ có một việc đúng tại mỗi thời điểm, chạm được khi đeo găng. Nút "Báo sự cố" luôn ở bên trái nút chính, 1 chạm.
2. **Hoàn tác 5 giây thay hộp xác nhận** cho Đã đến và Rời điểm dừng (Long chốt 29/10). Thanh tối hiện ngay trên nút chính, có đếm ngược. Bắt đầu chuyến, Đã thông quan, Đã giao vẫn qua hộp xác nhận DRV-04 vì khó đảo ngược.
3. **Thẻ "điểm kế tiếp" ở đầu màn**, chữ 24pt: tài xế liếc nhanh khi dừng đèn đỏ là biết đang tới đâu, giờ kế hoạch, đúng giờ hay trễ.
4. **Chỉ báo GPS và mất sóng là một thanh ngay dưới header**. Mất sóng thì thanh chuyển tối, chạm mở hàng chờ (COM-12). Mốc chưa gửi có nhãn "Chờ gửi" ngay trên lộ trình.
5. **Mức độ sự cố dùng vạch 1-2-3 kèm chữ**, không dựa vào màu.
6. **Mô tả sự cố có câu mẫu theo loại** và nút đọc giọng nói, vì đây là ô nhập dài duy nhất của tài xế.
7. **Hộp xác nhận cho phép sửa giờ** trong 24 giờ (G3 phương án A), để ghi bù khi quên.

## Màn đã vẽ — Hộ tống

| Mã | Màn | Biến thể |
| --- | --- | --- |
| ESC-02 | Ngựa trên chuyến (tab Ngựa) | bình thường, vừa lưu ghi nhanh, đang tải, chưa được phân công, lỗi, mất sóng |
| ESC-03 | Ghi nhanh chăm sóc (bottom sheet) | uống nước cả đoàn, cho ăn 1 ngựa, nghỉ chân + đổi giờ, lỗi giờ quá xa, mất sóng |
| ESC-07 | Báo bất thường (bottom sheet) | chọn loại, chưa chụp ảnh, đã chụp, mất sóng |
| ESC-04 | Báo cáo sức khỏe | chưa có ảnh, đủ ảnh + gửi khách, bấm gửi khi thiếu ảnh, mất sóng |
| ESC-05 | Chi tiết ngựa | Kim Long, Sao Mai, mất sóng |
| ESC-01 | Chuyến của tôi | có 2 chuyến (chỉ hiện khi từ 2 chuyến) |
| COM-12 | Hàng chờ đồng bộ | (màn chung) |

Giữ chỗ: ESC-06 Nhật ký (tab, P1), ESC-08, COM-09, COM-10, DRV-07 (Y tế khẩn dùng chung màn báo sự cố của tài xế).

### Quyết định bố cục — Hộ tống

1. **Một nút "Ghi nhanh" rộng ngang ngay trên tab bar** thay cho nút nổi tròn: dễ chạm bằng ngón cái, chuyển sang Figma Auto Layout không phải đặt tọa độ tuyệt đối.
2. **Ghi nhanh mặc định chọn cả đoàn** và lượng nước 12 L: việc thường gặp nhất là cho cả đoàn uống nước ở trạm nghỉ, 2 chạm (Ghi nhanh, Lưu) vì Uống nước được chọn sẵn. Nghỉ chân luôn ghi cho cả đoàn.
3. **Thẻ ngựa gọn** (hướng B): tình trạng, giờ ăn và uống gần nhất; nhãn tối "4 giờ chưa uống" khi quá ngưỡng. Nút ⋯ trên thẻ mở Báo bất thường và Báo cáo sức khỏe.
4. **Báo bất thường tách Y tế khẩn ra riêng**, viền đậm, chuyển sang báo sự cố vì cần điều phối xử lý gấp; ba loại còn lại là báo cáo sức khỏe có ảnh.
5. **Mọi báo cáo sức khỏe bắt buộc ảnh** (Long chốt 29/10): nút Gửi luôn bấm được, thiếu ảnh thì báo ngay dưới ô ảnh thay vì làm mờ nút, để người dùng biết vì sao chưa gửi được.
6. **Tổng hôm nay của cả đoàn** (lít nước, bữa, lần nghỉ) ở đầu màn để hộ tống trả lời điều phối nhanh.
7. **Icon tab Ngựa vẽ riêng** (đầu ngựa, nét 2px như Lucide). Bản này là phác, chỉnh kỹ ở Prompt 5.

## Màn đã vẽ — Khách hàng

| Mã | Màn | Biến thể |
| --- | --- | --- |
| CUS-01 | Hành trình (tab đầu) | bình thường, đang tải, chưa có chuyến, lỗi, mất sóng |
| CUS-05 | Theo dõi hành trình | đúng kế hoạch, trễ, đang tải, lỗi, mất sóng |
| CUS-06 | Báo cáo sức khỏe | căng thẳng, ổn định |
| CUS-02 | Đơn hàng | đang xử lý, đang chạy, đã đóng, chưa có đơn, mất sóng |
| CUS-03 | Chi tiết đơn | cần bổ sung, chờ đặt cọc, đang vận chuyển, đã giao, từ chối, lỗi (thêm chờ duyệt và nháp khi bấm thử) |
| CUS-04 | Báo giá và thanh toán | chờ đặt cọc, mở trang thanh toán, đã đặt cọc có điều chỉnh, mất sóng |
| CUS-08 | Ngựa (tab) | 6 hồ sơ, chưa có hồ sơ, đang tải |
| CUS-09 | Hồ sơ ngựa | giấy tờ hết hạn, đang trên đơn (nút đặt bị khóa) |
| CUS-10 | Thêm hoặc sửa hồ sơ | thêm ngựa, trùng số hộ chiếu, mất sóng |
| CUS-11 → 14 | Tạo yêu cầu 4 bước | chọn ngựa (ngựa đang bận bị khóa), lưu nháp khi thoát, tuyến và ngày, ghi chú có gợi ý, xem lại, lỗi 422, mất sóng |
| CUS-15 | Đã gửi yêu cầu | |

Giữ chỗ: CUS-07, CUS-16, bản đồ toàn màn của CUS-05, COM-09, COM-10.

### Quyết định bố cục — Khách hàng

1. **Hành trình là tab đầu**: thẻ chuyến đang chạy (nền chuyển xanh, chỗ duy nhất được dùng) cho thấy đang tới đâu, chấm tiến độ 4 điểm, báo cáo sức khỏe mới bằng nhãn vàng; ngay dưới là "Cần bạn xử lý".
2. **CUS-05 theo hướng B**: lộ trình là chính, báo cáo sức khỏe xen đúng điểm dừng; bản đồ là thẻ 160pt ghi rõ "Vị trí ước tính theo mốc gần nhất".
3. **Không hiện số điều phối viên** (Long 29/10). Khu "Liên hệ với HorseRoute" để chỗ, ghi rõ kênh đang được chốt.
4. **Báo giá trình bày như hóa đơn**: số canh phải, khoản điều chỉnh có lý do, Tổng và Còn lại in đậm; khung đầu màn đổi theo trạng thái (cần đặt cọc kèm hạn, hay đã đặt cọc).
5. **Đặt cọc mở web**: bottom sheet giải thích trước khi rời app; trả xong app tự chuyển sang Đã đặt cọc (bấm thử có mô phỏng).
6. **Chi tiết đơn có 6 bước tiến độ** (Gửi, Duyệt, Báo giá và cọc, Chuẩn bị, Vận chuyển, Đã giao) để khách biết đơn đang ở đâu và bước tiếp theo.
7. **Tạo yêu cầu 4 bước có thanh tiến độ và Lưu nháp** ở header; ngựa đang trên đơn khác bị khóa và ghi mã đơn.

## Việc cần backend xác nhận (phát sinh khi vẽ)

- Ghi mốc theo điểm dừng: cần `stopIndex` (hoặc tương đương) trong `POST /legs/:id/milestones`.
- Mọi báo cáo sức khỏe bắt buộc ảnh (G13): backend cần bỏ điều kiện chỉ bắt buộc khi khác Ổn định.
- Ghi nhanh cho nhiều ngựa: API care-activities nhận 1 ngựa mỗi lần, app gửi nhiều request (nên có API ghi theo lô).
- Ngưỡng "quá 4 giờ chưa uống" cần chuyên viên xác nhận.
- Khách hàng: chưa có API từ chối báo giá, hủy đơn (G9); người nhận chưa gửi được nếu bỏ `booking` (tạm ghi trong ghi chú).
