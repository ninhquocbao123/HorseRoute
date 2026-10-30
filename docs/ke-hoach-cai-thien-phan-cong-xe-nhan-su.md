# Kế hoạch cải thiện phân công xe và nhân sự

Bản kế hoạch cuối cùng dưới đây giữ nguyên cách lưu **Chuyến → Xe → Tài xế, lơ xe**. Trên giao diện, người dùng chọn xe và nhân sự độc lập; hệ thống tự bố trí người vào xe trước khi lưu.

## 1. Khu vực phân công trên trang chính

Giữ hai ô hiện có:

| Ô | Nội dung | Nút |
|---|---|---|
| Phương tiện | Danh sách biển số, tổng số xe và số ngựa đã bố trí | Chọn/Cập nhật phương tiện |
| Nhân sự | Danh sách tài xế và lơ xe của toàn bộ chuyến | Chọn/Cập nhật nhân sự |

- Giao diện không chia nhân sự theo từng xe.
- Có thể chọn nhân sự trước khi chọn xe; nút vẫn phụ thuộc quyền chỉnh sửa và trạng thái tải dữ liệu.
- Khi chưa chọn xe, chỉ ghi nhận lựa chọn nhân sự tạm; chưa thể xác nhận phân công đầy đủ để lưu.
- Không thêm nút “Lưu phân công” dưới hai ô.

## 2. Modal chọn xe

Giữ bố cục thẻ xe, tìm kiếm biển số, lọc loại xe, sức chứa, số ngựa và phân trang.

| Trạng thái | Nội dung bổ sung trên thẻ | Cho chọn mới? |
|---|---|---|
| Đang rảnh | Không cần thông tin chuyến | Có |
| Đã giữ chỗ | “Chuyến đang giữ: …” | Không |
| Đang vận chuyển | “Đang vận chuyển chuyến: …” | Không |

- Mặc định bộ lọc **“Tất cả trạng thái”**.
- Ba nhãn phản ánh trạng thái được cập nhật theo vòng đời thực tế.
- Không thêm nhãn “Đã bố trí cho chuyến này”.
- Bỏ dòng “Chưa kiểm tra lịch nháp…” và phần lý do bị khóa.
- Xe đã lưu trong chính chuyến được nhận biết bằng dấu tích và nền thẻ đã chọn. Có thể bỏ chọn khi còn quyền sửa.
- Xe đang được giữ cho chính chuyến có thể được chọn lại sau khi bỏ tạm; xe của chuyến khác luôn bị khóa.
- Giữ nút **Hủy** và **Xác nhận chọn**.

Bỏ hoặc thay xe chỉ thay đổi danh sách xe và số ngựa bố trí. **Danh sách tài xế/lơ xe đã chọn được giữ nguyên.**

## 3. Modal chọn tài xế và lơ xe

Bỏ hàng tab biển số xe. Người dùng chọn nhân sự chung cho chuyến, không cần thao tác phân từng người vào từng xe.

Modal gồm:

1. Phần tổng hợp tài xế/lơ xe đang chọn.
2. Hai tab **Tài xế / Lơ xe**.
3. Ô tìm theo tên và bộ lọc trạng thái.
4. Danh sách thẻ nhân sự.
5. Phân trang, nút **Hủy** và **Xác nhận chọn**.

| Trạng thái | Nội dung trên thẻ | Cho chọn mới? |
|---|---|---|
| Đang rảnh | Họ tên, chuyên môn, trạng thái | Có, nếu hồ sơ hợp lệ |
| Đã phân công | Họ tên, chuyên môn, trạng thái | Không |
| Đang trong chuyến | Họ tên, chuyên môn, trạng thái | Không |

- Không hiển thị chuyến hoặc biển số xe trên thẻ nhân sự.
- Mặc định **“Tất cả trạng thái”**.
- Bộ lọc gồm: **Tất cả trạng thái / Đang rảnh / Đã phân công / Đang trong chuyến**.
- Người đã lưu trong chính chuyến được giữ dấu tích; có thể bỏ hoặc chọn lại khi còn quyền sửa.
- Một người chỉ xuất hiện một lần trong danh sách được chọn.
- Bỏ phần lý do bị khóa và thông tin kiểm tra lịch nháp.
- “Xác nhận chọn” chỉ cập nhật lựa chọn tạm, chưa giữ nhân sự trên máy chủ.

**Giữ nguyên định mức hiện tại:** mỗi xe có 1–2 tài xế và 1–2 lơ xe. Vì vậy, chuyến có `N` xe cần tổng cộng `N–2N` tài xế và `N–2N` lơ xe.

Khi tăng hoặc giảm số xe, giao diện kiểm tra lại định mức, không tự xóa người. Nếu thiếu hoặc thừa, hiển thị thông báo tại phần tổng hợp phân công để người dùng điều chỉnh trước khi lưu.

## 4. Tự bố trí nhân sự vào xe

Dữ liệu vẫn lưu:

> Chuyến A → Xe X → Tài xế An, lơ xe Bình.

Frontend chuyển danh sách nhân sự chung thành các tổ theo xe trước khi gửi API, theo thứ tự:

1. Ưu tiên giữ tổ đã lưu của những xe không thay đổi, nếu những người đó vẫn được chọn.
2. Người thuộc xe bị bỏ hoặc người mới được chọn được bố trí vào xe còn thiếu.
3. Bảo đảm mỗi xe có ít nhất một tài xế và một lơ xe trước khi bố trí người thứ hai.
4. Mỗi xe không quá hai tài xế và hai lơ xe; mỗi người chỉ thuộc một xe trong chuyến.
5. Nếu cần, điều chuyển người từ tổ có hai người cùng vai trò sang xe còn thiếu.
6. Không tự thêm, bỏ hoặc thay người ngoài danh sách người dùng đã chọn.

Máy chủ tiếp tục kiểm tra lại cấu trúc phân công theo xe; không chỉ dựa vào kết quả bố trí từ frontend.

## 5. Thao tác lưu và thay đổi lựa chọn

Không thêm nút lưu mới. Tiếp tục dùng nút lưu hiện có ở cuối trang.

Luồng thao tác:

1. Chọn xe và nhân sự theo thứ tự tùy ý.
2. Xác nhận lựa chọn trong từng modal.
3. Bấm nút lưu ở cuối trang.
4. Frontend bố trí người vào từng xe và gửi cấu trúc phân công hiện tại.
5. Máy chủ kiểm tra và lưu đồng thời xe, nhân sự, trạng thái giữ tài nguyên.

Ví dụ thay xe X bằng xe Y:

- Bỏ X, chọn Y.
- An và Bình vẫn nằm trong danh sách nhân sự.
- Hệ thống bố trí An và Bình sang Y.
- Khi lưu phân công thành công, X được giải phóng, Y được giữ; An và Bình tiếp tục được giữ cho chuyến.

Nếu lưu **phân công** thất bại, toàn bộ thay đổi phân công và giữ tài nguyên được hủy. Tuy nhiên, nút lưu chung hiện gọi API phân công và API lịch riêng: nếu phân công đã lưu nhưng bước lưu lịch thất bại, phải thông báo rõ phần nào đã lưu. Không coi hai API này là một giao dịch duy nhất.

Mở và chọn trong modal không cần ngày giờ. **Bước lưu kế hoạch chung vẫn yêu cầu lộ trình và ngày giờ hợp lệ**, theo luồng hiện tại.

## 6. Vòng đời trạng thái

| Sự kiện | Xe | Tài xế/lơ xe |
|---|---|---|
| Chọn tạm trong modal | Chưa đổi trạng thái | Chưa đổi trạng thái |
| Lưu phân công thành công | `RESERVED` — Đã giữ chỗ | `RESERVED` — Đã phân công |
| Đơn chuyển sang `READY` | Vẫn `RESERVED` | Vẫn `RESERVED` |
| Tài xế ghi `DEPARTED`, đơn sang `IN_TRANSIT` | `IN_TRANSIT` — Đang vận chuyển | `IN_TRIP` — Đang trong chuyến |
| Ghi `DELIVERED`, đơn sang `DELIVERED` | `AVAILABLE` — Đang rảnh | `AVAILABLE` — Đang rảnh |
| Bị bỏ khỏi phân công và lưu hợp lệ | Về `AVAILABLE` | Về `AVAILABLE` nếu không còn trong phân công mới |

- Một xe hoặc một người chỉ được giữ/sử dụng bởi một chuyến chưa hoàn thành.
- Trả kế hoạch về chỉnh sửa vẫn giữ xe và người.
- Giải phóng khi giao xong không xóa lịch sử phân công.
- Việc thay xe/người tuân theo quyền chỉnh sửa hiện có; không mở rộng quyền sửa chuyến đã khóa hoặc đã vận hành.

## 7. Phạm vi thay đổi API và dữ liệu

**Giữ nguyên cấu trúc gửi phân công:** danh sách xe, bên trong mỗi xe có danh sách nhân sự. Giữ `trip_assignments.trip_vehicle_id`, không chuyển sang mô hình người chỉ thuộc chuyến.

| API/luồng | Thay đổi cần làm |
|---|---|
| `GET /trips/:id/plan-options` | Trả trạng thái xe, chuyến đang giữ/sử dụng và khả năng chọn; bỏ phần lý do/kiểm tra lịch dành cho thẻ xe. |
| `GET /trips/:id/assignment-options` | Hỗ trợ ba trạng thái nhân sự và khả năng chọn; bỏ phần lý do/kiểm tra lịch dành cho thẻ nhân sự. |
| `GET /trips/:id/assignments` | Hỗ trợ trạng thái `RESERVED`; trả phân công theo xe để frontend giữ tổ cũ khi bố trí lại. |
| `PUT /trips/:id/assignments` | Giữ cấu trúc đầu vào; bổ sung giữ/giải phóng xe và người đồng thời, chống phân công trùng. |
| Gửi duyệt, duyệt, kiểm tra xuất phát | Chấp nhận xe/người được giữ cho chính chuyến; chặn tài nguyên của chuyến khác. |
| `POST /trips/:id/start-transport` | Chuyển đơn sang `READY`; xe/người vẫn được giữ. |
| API ghi mốc flow04 | Đồng bộ xe/người khi `DEPARTED` và `DELIVERED`. |
| API hiệu chỉnh tracking | Đồng bộ trạng thái, ngăn chiếm dụng lại xe/người đang thuộc chuyến khác. |
| Luồng chỉnh trạng thái thủ công | Không cho ghi trạng thái trái với phân công thực tế. |

Về cơ sở dữ liệu:

- **`crew_profiles`:** bổ sung `RESERVED` vào `work_status`.
- **`vehicles`:** cập nhật trạng thái theo vòng đời.
- **`trip_vehicles`, `trip_assignments`:** giữ cấu trúc liên kết hiện tại.
- **`trips`, `orders`, `legs`, `leg_milestones`:** dùng thông tin kế hoạch và mốc vận hành hiện có.
- **`users`:** kiểm tra tài khoản, chuyên môn hợp lệ.
- **`audit_logs`:** ghi nhận thay đổi phân công và trạng thái.

Không chuyển đổi dữ liệu cũ sang mô hình nhân sự theo chuyến. Vẫn cần đối chiếu trạng thái cũ với phân công thực tế, phát hiện xe/người đang bị gắn vào nhiều chuyến chưa hoàn thành trước khi áp dụng quy tắc giữ độc quyền.

## 8. Kiểm tra trước khi hoàn tất

- Chọn người trước xe; thay xe không mất người.
- Mặc định thấy đủ các trạng thái; xe/người bận của chuyến khác không chọn được.
- Xe/người của chính chuyến có thể giữ nguyên, bỏ hoặc chọn lại khi được phép sửa.
- Tự bố trí đúng định mức, không trùng người giữa các xe.
- Tăng/giảm số xe báo thiếu hoặc thừa người, không tự xóa lựa chọn.
- Hai người lưu cùng một tài nguyên: chỉ một phân công thành công.
- Vòng đời đầy đủ: lưu → `READY` → `DEPARTED` → `DELIVERED` → sử dụng cho chuyến tiếp theo.
- Lưu phân công thất bại không làm giữ hoặc giải phóng tài nguyên một phần.

> Trạng thái tài liệu: Kế hoạch đã chốt để kiểm tra; chưa thay đổi mã nguồn hoặc cơ sở dữ liệu.
