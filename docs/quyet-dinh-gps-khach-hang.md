# Quyết định: khách hàng không xem GPS thật của xe

Ngày 12/11/2026. Việc D3 trong [ke-hoach-xu-ly-loi-10-11-2026.md](ke-hoach-xu-ly-loi-10-11-2026.md), theo câu trả lời Q4 của Long (11/11/2026). Lỗi gốc là P1-7 trong [danh-gia-hoi-dong-10-11-2026.md](danh-gia-hoi-dong-10-11-2026.md).

## Quyết định

Khách hàng theo dõi chuyến bằng **mốc hành trình**, không thấy vị trí GPS thời gian thực, tốc độ hay vệt đường chạy của xe. GPS thật chỉ dành cho nhân sự nội bộ: tài xế, hộ tống, điều phối viên, quản lý, chuyên viên.

## Lý do

1. **Riêng tư của tổ lái.** Vị trí theo từng giây cho biết tài xế dừng ở đâu, nghỉ bao lâu, kể cả lúc nghỉ đêm. Đây là dữ liệu cá nhân của người lao động. Khách không cần dữ liệu đó để biết ngựa của mình đang ở chặng nào.
2. **An toàn cho hàng giá trị cao.** Ngựa đua có giá trị lớn. Nếu một tài khoản khách bị lộ hoặc bị chia sẻ, người ngoài sẽ biết chính xác xe đang ở đâu và lúc nào xe dừng. Mốc hành trình chỉ công bố những điểm đã qua.
3. **Tránh gây hiểu lầm.** GPS trên điện thoại tài xế có thể mất sóng, trễ hoặc lệch (đi qua vùng núi, qua cửa khẩu). Khách thấy xe "đứng yên" hoặc "nhảy" dễ lo lắng và gọi hỏi. Mốc do tài xế xác nhận là thông tin chắc chắn.
4. **Vẫn đủ thông tin cho khách.** Khách thấy:
   - Chuyến đã xuất phát lúc nào, từ đâu, đang đi tới đâu.
   - Từng điểm nghỉ xe đã tới (tài xế check-in).
   - Ở chuyến quốc tế: xe đang ở cửa khẩu nào, đang kiểm tra giấy tờ, đã qua cửa khẩu chưa.
   - Giờ đến dự kiến, số km còn lại theo tuyến kế hoạch.
   - Nhật ký chăm sóc ngựa và báo cáo sức khỏe hộ tống gửi.
   - Thông báo trên web và app ở mỗi mốc.

## Cách hệ thống thực hiện

| Phần | Hành vi | Nơi trong code |
| --- | --- | --- |
| Bản đồ của khách | `GET /api/v1/tracking/orders/:orderId/map` chỉ dành cho khách, chỉ đơn của mình. Không đọc bảng `trip_positions`; xe đang chạy được đặt ở điểm xuất phát của chặng kèm câu "Đã xuất phát từ … lúc …, đang trên đường đến …"; `latestPosition`, giới hạn tốc độ và cảnh báo kỹ thuật luôn rỗng | `apps/api/src/features/tracking/tracking.service.ts` (`getCustomerOrderMap`) |
| Bản đồ nội bộ, GPS | `GET /trips/:tripId/map` và `GET /trips/:tripId/positions` trả 403 với khách | `tracking.routes.ts`, `tracking.service.ts` |
| Tiến độ của khách | `GET /orders/:orderId/timeline`: mốc chặng, check-in điểm nghỉ và cửa khẩu | `getOrderTimeline` |
| Kiểm thử | `flow4-tracking.mysql.cjs`: khách gọi bản đồ nội bộ và vệt GPS bị 403; khi tài xế đã gửi GPS, bản đồ của khách vẫn chỉ có vị trí ước tính, không có tọa độ GPS (thêm ngày 12/11/2026) | `apps/api/test/flow4-tracking.mysql.cjs` |

## Nếu sau này muốn mở cho khách

Nếu nghiệp vụ đổi, ví dụ khách VIP muốn xem xe trực tiếp, làm theo hướng đã đề xuất ở Q4:

- Trả vị trí chậm 1–2 phút, làm tròn khoảng 1 km.
- Ẩn vị trí khi xe dừng lâu (nghỉ đêm).
- Ghi nhật ký mỗi lần khách xem.
- Tổ lái phải được báo trước trong hợp đồng lao động.

Chỉ phải sửa `getCustomerOrderMap`. Ứng dụng khách đã có sẵn ô bản đồ, chỉ cần dữ liệu.

## Trả lời khi hội đồng hỏi

> Vì sao khách không xem được xe đang ở đâu như các app giao hàng?

Đây là quyết định có chủ đích, không phải thiếu tính năng. Hàng là ngựa đua giá trị cao, và tổ lái nghỉ đêm trên đường. Lộ vị trí theo thời gian thực vừa ảnh hưởng an toàn chuyến hàng, vừa lộ dữ liệu cá nhân của tài xế. Khách vẫn biết ngựa đang ở chặng nào, đã qua cửa khẩu chưa, khi nào tới, qua các mốc do tài xế xác nhận. Nội bộ thì có GPS đầy đủ để điều phối và xử lý sự cố.
