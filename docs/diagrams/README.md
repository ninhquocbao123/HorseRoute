# Sơ đồ UML — HorseRoute

Bộ sơ đồ mô tả chức năng đang được triển khai trong repository, đối chiếu ngày **18/11/2026**. Mở [index.html](index.html) để xem toàn bộ.

| Sơ đồ | Ảnh vector | Bản chỉnh sửa |
| --- | --- | --- |
| Use-case tổng quan | [SVG](01-use-case.svg) | [Draw.io](01-use-case.drawio) |
| Activity — tiếp nhận đơn và thẩm định | [SVG](02-activity-order.svg) | [Draw.io](02-activity-order.drawio) |
| Activity — lập kế hoạch và cho phép xuất phát | [SVG](03-activity-plan.svg) | [Draw.io](03-activity-plan.drawio) |
| Activity — vận chuyển và bàn giao | [SVG](04-activity-delivery.svg) | [Draw.io](04-activity-delivery.drawio) |

Mở file `.drawio` bằng diagrams.net hoặc phần mở rộng Draw.io trong VS Code. Các hình, chữ và đường nối đều là phần tử chỉnh sửa được. SVG có thể chèn vào báo cáo và phóng to không vỡ hình. Chạy `node docs/diagrams/generate.cjs` ở thư mục gốc để sinh lại SVG, Draw.io và trang xem; lệnh này ghi đè các file sinh tự động nên cần lưu riêng bản Draw.io đã chỉnh tay.

Bản PNG đã xuất cùng thư mục: [use-case](01-use-case.png), [tiếp nhận / thẩm định](02-activity-order.png), [kế hoạch](03-activity-plan.png), [vận chuyển / bàn giao](04-activity-delivery.png). Sau khi sửa nguồn, chạy `node docs/diagrams/render.cjs` để xuất lại PNG bằng Edge và Playwright sẵn có của workspace web; có thể đặt `PLAYWRIGHT_CHANNEL=chrome` nếu dùng Chrome.

## Cách đọc và phạm vi

- Use-case dùng tác nhân bên ngoài biên hệ thống và các ellipse biểu diễn mục tiêu người dùng. Một ellipse có thể gom các thao tác gần nhau để giữ sơ đồ tổng quan dễ đọc; các đường nối thể hiện quyền tham gia, không phải trình tự xử lý. Không gán `include` / `extend` cho những chức năng chỉ cùng nhóm.
- Có 6 vai trò tài khoản: `CUSTOMER`, `ADMIN`, `MANAGER`, `SPECIALIST`, `COORDINATOR`, `DRIVER_ESCORT`. Tài xế và hộ tống được tách thành 2 tác nhân nghiệp vụ theo `trip_assignments.role` (`DRIVER` / `ESCORT`). “Người dùng” ở hàng cuối là cách gom chức năng chung, không phải vai trò thứ bảy. Đăng ký chỉ áp dụng cho khách hàng; xác minh email phụ thuộc cấu hình SMTP.
- Activity dùng chấm đặc để bắt đầu, vòng tròn kép để kết thúc, hình chữ nhật bo góc cho hành động, hình thoi cho quyết định và các làn trách nhiệm. Mũi tên có nhãn là nhánh điều kiện; nhánh quay lại thể hiện sửa / bổ sung / chờ xử lý.
- Bộ activity tập trung vào vòng đời vận chuyển. Luồng quản trị tài khoản, đăng nhập, CRUD danh mục và hủy đơn không được tách thành activity riêng. Use-case vẫn thể hiện các nhóm chức năng đó.
- Hộ tống chăm sóc và tài xế cập nhật hành trình có thể diễn ra độc lập. Activity vận chuyển gom các hoạt động này trong một chu kỳ nghiệp vụ để dễ đọc; không có nghĩa mỗi lần gửi GPS phải đợi báo cáo sức khỏe.
- VNPay là tác nhân hệ thống ngoài trong luồng thanh toán. Mô phỏng thanh toán là chế độ thử nghiệm. SMTP và nhà cung cấp bản đồ được lược khỏi use-case tổng quan; cơ quan phê duyệt hồ sơ không được vẽ thành người dùng trực tiếp vì chuyên viên ghi nhận kết quả vào hệ thống.

## Những điểm cần giữ đúng khi thuyết trình

1. **Quản lý duyệt đơn trước khi chuyên viên thẩm định.** Duyệt đơn tạo chuyến, chọn điều phối phụ trách và tạo checklist giấy tờ. Chuyên viên tiếp nhận hồ sơ ở giai đoạn sau đó.
2. **Duyệt đơn và duyệt hồ sơ là hai quyết định khác nhau.** Cả hai có nhánh yêu cầu bổ sung và từ chối. Chuyên viên từ chối thẩm định sẽ chuyển đơn sang `REJECTED`; duyệt hồ sơ đòi hỏi giấy tờ hợp lệ và còn hạn.
3. **Không áp đặt thứ tự bắt buộc giữa thẩm định, báo giá và lập kế hoạch.** Những việc này có thể tiến hành sau khi đơn `APPROVED`. Mã nguồn hiện không kiểm tra `assessment_status = APPROVED` như một điều kiện bắt buộc trong `releaseToDriver` hoặc `getDepartureBlockers`; vì vậy sơ đồ không tự thêm điều kiện đó. Nếu nghiệp vụ mong muốn bắt buộc thẩm định xong trước xuất phát, cần thay đổi cả hệ thống lẫn sơ đồ.
4. **Gửi kế hoạch chuyển đơn sang `PREPARING`.** Kế hoạch được gửi ở trạng thái `PENDING_APPROVAL`; trả lại cho điều phối chỉnh sửa hoặc quản lý duyệt thành `APPROVED`.
5. **Duyệt kế hoạch không tự làm xe xuất phát.** Quản lý chuyển đơn sang `READY`; tài xế ghi `DEPARTED` của chặng đầu mới chuyển đơn sang `IN_TRANSIT`. Hệ thống kiểm tra lại nguồn lực và ngựa trước xuất phát.
6. **Cọc và tờ khai có ngoại lệ riêng.** Quản lý có thể chuyển chuyến khi thiếu cọc hoặc thiếu số tờ khai quốc tế nếu cung cấp lý do tương ứng; hệ thống lưu audit. Các điều kiện kế hoạch và nguồn lực vẫn phải hợp lệ.
7. **Giao ngựa khi còn nợ cần hai bước.** Quản lý duyệt ngoại lệ, sau đó điều phối hoặc quản lý mở ngoại lệ. Tài xế vẫn là người ghi `DELIVERED`. Nếu đã thanh toán đủ thì không cần ngoại lệ.
8. **Giao ngựa kết thúc chặng cuối.** Chặng cuối phải ở `AT_STOP`; nếu điểm cuối là cửa khẩu phải có mốc thông quan. Khi giao thành công, đơn là `DELIVERED`, chặng là `COMPLETED`. Các chặng trung gian dùng thao tác hoàn tất chặng riêng. Luồng kế hoạch tuyến mới có một chặng vận hành đại diện; vòng lặp nhiều chặng phục vụ dữ liệu kế hoạch cũ còn được hỗ trợ.
9. **Khách không xem GPS nội bộ.** Khách xem bản đồ theo mốc, timeline, nhật ký chăm sóc và báo cáo đã gửi; tài xế mới được gửi tọa độ, còn hộ tống ghi chăm sóc và báo cáo sức khỏe.
10. **Giới hạn giao diện khác giới hạn API.** Quản lý xe đã có API cho điều phối, nhưng README dự án ghi nhận web chưa có màn thêm xe. Use-case này mô tả khả năng hệ thống, không khẳng định mọi thao tác đều có màn hình web.

## Đối chiếu mã nguồn

| Nội dung | Nguồn |
| --- | --- |
| Vai trò, phạm vi ứng dụng | [README dự án](../../README.md), [role.enum.ts](../../packages/shared/src/enums/role.enum.ts) |
| Quyền tài khoản / người dùng | [accounts.routes.ts](../../apps/api/src/features/accounts/accounts.routes.ts), [users.routes.ts](../../apps/api/src/features/users/users.routes.ts), [auth.routes.ts](../../apps/api/src/features/auth/auth.routes.ts) |
| Gửi / duyệt / bổ sung / hủy đơn | [orders.service.ts](../../apps/api/src/features/orders/orders.service.ts), [orders.routes.ts](../../apps/api/src/features/orders/orders.routes.ts) |
| Giấy tờ và kết luận thẩm định | [documents.service.ts](../../apps/api/src/features/documents/documents.service.ts), [specialist.service.ts](../../apps/api/src/features/specialist/specialist.service.ts) |
| Báo giá / thu tiền / doanh thu | [manager.service.ts](../../apps/api/src/features/manager/manager.service.ts), [payments.service.ts](../../apps/api/src/features/payments/payments.service.ts), [pricing.routes.ts](../../apps/api/src/features/pricing/pricing.routes.ts) |
| Lập / duyệt kế hoạch, chuyển READY | [trips.service.ts](../../apps/api/src/features/trips/trips.service.ts), [trips.repository.ts](../../apps/api/src/features/trips/trips.repository.ts) |
| GPS, chăm sóc, sự cố, xuất phát / bàn giao | [tracking.service.ts](../../apps/api/src/features/tracking/tracking.service.ts), [tracking.repository.ts](../../apps/api/src/features/tracking/tracking.repository.ts), [tracking.routes.ts](../../apps/api/src/features/tracking/tracking.routes.ts) |

## Ghi chú về thanh toán và nhánh lỗi

Trong sơ đồ lập kế hoạch và bàn giao, hành động thanh toán là bước nghiệp vụ mức tổng quan. Một lần thanh toán thất bại hoặc bị hủy không được coi là đã trả tiền: người dùng quay lại thanh toán hoặc chờ xử lý, chỉ biên nhận thành công / thu tiền thủ công hợp lệ mới thay đổi số đã thu. Các lỗi dữ liệu, quyền truy cập, dữ liệu vừa thay đổi và gửi yêu cầu trùng được gom vào bước kiểm tra điều kiện, không vẽ thành từng nhánh kỹ thuật.
