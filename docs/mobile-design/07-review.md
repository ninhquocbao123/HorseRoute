# 07 — Review độc lập UI mobile HorseRoute

Ngày review: 30/10/2026. Người review không tham gia thiết kế. Vai trò: Design Lead, chuyên gia trợ năng, và người dùng thật (tài xế xe tải, người hộ tống ngựa).

Phạm vi: `00` đến `06`, `tokens/theme.ts`, ba bản UI `ui/driver.html`, `ui/escort.html`, `ui/customer.html` (kèm màn chung COM-xx), so với web (`landing-page.css`, `driver-shell.css`).

## Cách kiểm tra

- Mở ba bản UI bằng Playwright, chế độ "Xem tất cả màn", tỉ lệ 100%. Tổng 186 khung (tài xế 70, hộ tống 52, khách hàng 64), chụp cả Sáng và Tối (372 ảnh).
- Đo tự động trên từng khung: số cỡ chữ, số nút vàng, kích thước vùng chạm, tương phản chữ trên nền thật, nhãn trợ năng của nút icon.
- Thử thêm: khung rộng 360pt, và phóng chữ 130% (đúng mức `maxFontSizeMultiplier` 1.3 của nút trong 05).
- Tính tương phản từ token trong `theme.ts` cho các cặp màu chưa có trong bảng 05 mục 1.4.
- Không chấm lại các quyết định Long đã duyệt. Chỉ nhận xét cách thể hiện.

Ảnh và số liệu đo nằm trong scratchpad của phiên review (`review/mine/`, `review/audit.json`), không đưa vào repo.

## 1. Điểm số

### Theo nhóm

| # | Nhóm | Điểm | Lý do |
| --- | --- | --- | --- |
| 1 | Độ phủ phạm vi | 7 | Đủ màn cho mọi chức năng MVP, không có màn ngoài phạm vi, nhưng CUS-10 có giá trị không tồn tại trong API và vài trường tự bịa (mã sự cố, người nhận là địa điểm). |
| 2 | Luồng | 6 | Đường chính ngắn và rõ, nhưng còn 4 nhánh P0 bị chặn: từ chối camera (ảnh bắt buộc), GPS tắt hoặc bị từ chối, gọi người nhận khi giao, và "Cần bổ sung giấy tờ" dẫn vào ngõ cụt. |
| 3 | Phân cấp thị giác | 7 | Gần như mọi màn có đúng một nút vàng, nhưng giờ dự kiến của tài xế chỉ 13px và có hai chỗ dùng vàng sai (Đăng xuất, Bỏ qua). |
| 4 | Tuân thủ design system | 5 | Nhiều vùng chạm của tài xế và hộ tống chỉ 40–48pt, thấp hơn chính quy tắc 56pt của 05; có card lồng card và vàng dùng làm nhãn. |
| 5 | Chữ và màu | 4 | Quy tắc tối đa 4 cỡ chữ bị vượt ở gần như mọi màn (5–10 cỡ), nhiều thông tin quan trọng ở 13px, và chip đang chọn ở chế độ tối chỉ tách nền 1,48:1. |
| 6 | Thao tác và công thái học | 6 | Vùng ngón cái, Hoàn tác và haptic làm tốt, nhưng găng tay khó bấm vùng 44pt, Báo bất thường nằm trong nút "⋯" 44pt, và thanh đáy tài xế vỡ khi phóng chữ 130%. |
| 7 | Trạng thái | 8 | Độ phủ trạng thái rất tốt (tải, trống, lỗi, mất sóng, dữ liệu dài), chỉ thiếu GPS tắt, quyền bị từ chối và mục bị từ chối trong hàng chờ của bản tài xế. |
| 8 | Nền tảng và nội dung | 5 | Bản Android chỉ là đổi khung, chữ hướng dẫn quyền vị trí sai với Android 11+, không ghi hành vi nút Back; chữ tiếng Việt nhìn chung rõ nhưng còn vài chỗ không thống nhất. |
| 9 | Thương hiệu, không "AI" | 7 | Màu và font khớp web, không gradient sai, không emoji, nhưng không dùng logo thật và vài mẫu màn (kết quả, xin quyền) trông như template. |

### Theo actor

| Actor | Điểm | Lý do |
| --- | --- | --- |
| Tài xế | 6 | DRV-02 đúng hướng và Hoàn tác tốt, nhưng bàn giao chưa sẵn sàng: vùng chạm, cỡ chữ giờ dự kiến, phóng chữ, GPS tắt và gọi người nhận chưa đạt cho người đeo găng ngoài nắng. |
| Hộ tống | 7 | Ghi nhanh 2 chạm và Báo bất thường có ô chụp lớn là điểm mạnh, nhưng camera bị từ chối làm kẹt mọi báo cáo, và chip chọn ở chế độ tối gần như không thấy. |
| Khách hàng | 7 | Báo giá, theo dõi và tạo yêu cầu gọn và đáng tin, nhưng CUS-10 sẽ lỗi khi lưu, "Cần bổ sung" là ngõ cụt, và bản đồ chỉ là ô xám. |

Kết luận: chưa bàn giao nguyên trạng. Sửa 2 lỗi Critical và nhóm Major về vùng chạm, cỡ chữ, luồng bị chặn trước khi code. Phần lớn còn lại là sửa nhỏ trên nền đã tốt.

## 2. Danh sách vấn đề

Thứ tự: Critical → Major → Minor → Polish. Mã màn kèm biến thể (`--n`) khi chỉ xảy ra ở biến thể đó.

| ID | Màn | Nhóm | Mức | Mô tả | Vì sao quan trọng | Cách sửa cụ thể |
| --- | --- | --- | --- | --- | --- | --- |
| R-01 | ESC-04, ESC-07, DRV-07 (COM-08) | 2, 7 | Critical | Mọi báo cáo sức khỏe và báo bất thường bắt buộc ảnh, nhưng không có màn hoặc biến thể nào cho trường hợp người dùng đã từ chối quyền camera. COM-08 là khung "vẽ sau". | Hộ tống từ chối camera một lần là không gửi được báo cáo nào nữa. Chức năng P0 bị chặn hoàn toàn. | Thêm biến thể "Chưa có quyền camera" ngay trong PhotoPicker: nút "Chọn ảnh từ thư viện" và nút "Mở Cài đặt", kèm một câu giải thích. Vẽ COM-08 thành P0. |
| R-02 | CUS-10 | 1 | Critical | Chip giới tính có "Thiến". API chỉ nhận `''` / `Đực` / `Cái` (`payload.sex`). "Số hộ chiếu *" bị đánh dấu bắt buộc trong khi `passport_no` không bắt buộc. Ô "Năm sinh" trong khi API là `birthDate` (ngày). | Chọn "Thiến" (rất phổ biến với ngựa đực) sẽ bị 422 khi lưu. Bắt buộc hộ chiếu chặn khách chưa có số. | Bỏ "Thiến" hoặc xin backend thêm giá trị (xem mục 5). Bỏ dấu * ở Số hộ chiếu. Đổi "Năm sinh" thành chọn ngày, hoặc ghi rõ app lưu 01/01/năm. |
| R-03 | DRV-02, DRV-03, DRV-04, DRV-07, DRV-09, DRV-05, COM-12 | 4, 6 | Major | Đo được vùng chạm dưới 56pt ở tài xế: Quay lại và "⋯" 44; chip DRV-07 44, câu mẫu 40, link "Đổi" rộng 28; nút DRV-03 48; nút Hoàn tác 48; "Huỷ" DRV-04 48; "Báo sự cố mới" DRV-09 48; nút bản đồ DRV-05 48; stepper giờ 54. | 00-context và 05 yêu cầu ≥56 cho tài xế. Đeo găng, xe rung, 44pt là bấm trượt. | Áp `touchTargetLarge` 56 cho mọi phần tử bấm được trong bản tài xế, kể cả header và chip. Nút Hoàn tác cao 56. "Đổi" thành nút có chữ, rộng ≥56. |
| R-04 | ESC-02, ESC-03, ESC-04, ESC-05, ESC-06 | 4, 6 | Major | Hộ tống: chip ngựa và chip ăn uống 44, nút −5 L/+5 L 40, chip lọc 40, nút "⋯" 44. Nút "Ghi nhanh" đo được 48, trong khi tiêu đề hàng và 02 ghi 56. | 05 mục 6: hộ tống ≥56, chip L 56. Một tay cầm máy, tay kia giữ ngựa. | Chip hộ tống dùng biến thể "choice L" 56. Nút Ghi nhanh 56. Nút ±5 L cao 56. |
| R-05 | Mọi màn, rõ nhất DRV-02 (7 cỡ), DRV-04 (8), ESC-02 (8), ESC-03 (10 kể cả nền sau sheet), COM-10 (8), CUS-12 (7) | 5 | Major | Quy tắc tối đa 4 cỡ chữ mỗi màn bị vượt ở gần như mọi màn có nội dung. 06 chỉ ghi ngoại lệ cho DRV-02 (5 cỡ) và ESC-04 (5 cỡ), nhưng đo thật DRV-02 có 12/13/15/16/17/18/24. | Nhiều cỡ gần nhau (15/16/17, 12/13) làm phân cấp nhòe. Quy tắc trở thành vô nghĩa nếu ngoại lệ là mặc định. | Chốt bộ 4 cỡ cho màn làm việc: 24 (thông tin chính), 17 (nội dung, nút), 15 (phụ), 12 (nhãn hoa). Gộp 13→15 hoặc 12, 16→17, 18→17 trên nút. Cập nhật 05 nếu muốn 5 cỡ, nhưng phải là quy tắc, không phải ngoại lệ từng màn. |
| R-06 | DRV-02, DRV-01, DRV-05 | 3, 5 | Major | Giờ dự kiến và khoảng cách ("Dự kiến 07:30 · còn 18 km", "Kế hoạch 06:00 · còn 25 phút") chỉ 13px. DRV-01: giờ khởi hành 13px, mã đơn 17 đậm lại nổi nhất thẻ. | 5c: chữ lớn nhất là thông tin cần nhất (điểm đến + giờ). Tài xế liếc khi dừng đèn đỏ, nắng gắt; 13px không đọc được ở 50 cm. | Giờ dự kiến 24 đậm cùng dòng với trạng thái "Đúng giờ / Trễ 9 phút", khoảng cách 17. DRV-01: giờ khởi hành lên dòng đầu thẻ, cỡ 17 đậm. |
| R-07 | DRV-02 (mọi biến thể đang chạy), DRV-02--1 | 6, 7 | Major | Phóng chữ 130%: nút chính "Đã đến Trạm kiểm dịch Svay Rieng" thành 3 dòng, tràn khỏi 64pt; "Báo sự cố" gãy thành "Báo sự / cố"; icon ngựa lệch dòng. Ở 100%, nút chính đã 2 dòng với mọi tên điểm. | Tài xế 45 tuổi thường bật chữ lớn. Nút chính là việc thường xuyên nhất. | Nhãn nút dùng động từ + tên ngắn ("Đã đến Svay Rieng"), tối đa 2 dòng, nút tự cao lên. "Báo sự cố" thành nút icon 64×64 có nhãn trợ năng, hoặc đưa lên hàng riêng phía trên. Thêm biến thể "Chữ 130%" vào grid. |
| R-08 | ESC-03, DRV-07, ESC-04, CUS-10 (dark) | 5 | Major | Chip đang chọn chỉ đổi nền (quyết định đã duyệt). Ở chế độ tối nền chọn `surfaceBrand` #104d56 trên sheet #133034 chỉ đạt 1,48:1, chữ chọn và chưa chọn đều sáng. Ảnh ESC-03 tối: rất khó biết Sao Mai đã chọn. | WCAG 1.4.11 cần ≥3:1 cho trạng thái. Hộ tống ghi ban đêm trong chuồng tối sẽ ghi nhầm ngựa. | Giữ "chỉ đổi nền" nhưng đổi màu nền chọn ở dark: nền `#e8f4f4` chữ `#0b3b42`, hoặc nền `#14606a` kèm viền 2 `#96b4b7` (viền cả hai trạng thái để không đổi kích thước). |
| R-09 | DRV-02 tại điểm giao, DRV-10 (khung vẽ sau), DRV-13 | 1, 2 | Major | Không có cách gọi người nhận khi tới điểm giao. DRV-02 ghi "Người nhận: Trạm kiểm dịch Svay Rieng" (một địa điểm, không phải `recipient_name`), không có số điện thoại. Hành động "Gọi người nhận" chỉ có ở DRV-10, đang là khung. | Đến nơi không gặp ai là tình huống hằng ngày của tài xế. Đây là luồng P0 bị khung P1 chặn. | Ở DRV-02 biến thể "Tại điểm giao", thêm dòng "Người nhận: Trần Văn Bình · Gọi" (56pt) lấy từ `recipient_name/phone`. Trống thì ghi "Chưa có người nhận · Gọi điều phối". |
| R-10 | DRV-02, DRV-05, COM-07 | 2, 7 | Major | Luồng F-D2 có nhánh "Chỉ khi dùng app / Từ chối" và "Định vị đang tắt", nhưng grid không có biến thể nào cho hai trạng thái này. Chỉ có chuỗi "Mở Cài đặt" trong code bấm thử. | GPS nền là chức năng MVP. Tài xế cần biết ngay khi điều phối không thấy xe. | Thêm 2 biến thể DRV-02: Banner warning "Chỉ gửi vị trí khi mở app · Mở Cài đặt" và Banner danger "Định vị đang tắt · Bật định vị". Thêm vào DRV-05. |
| R-11 | COM-07 (Android) | 8 | Major | Chữ "Ở hộp tiếp theo, chọn Luôn cho phép" giống hệt trên Android. Từ Android 11 hộp hệ thống không có lựa chọn này; người dùng phải vào Cài đặt chọn "Luôn cho phép". | Tài xế Android làm đúng hướng dẫn vẫn không bật được GPS nền. | Tách chữ theo nền tảng: Android "Bước 1 chọn Khi dùng ứng dụng, bước 2 app mở Cài đặt, chọn Luôn cho phép". Vẽ biến thể Android riêng. |
| R-12 | CUS-03 (Cần bổ sung) | 2, 3 | Major | Lý do yêu cầu "Tải giấy mới trên web, sau đó gửi lại yêu cầu", nhưng nút chính là "Sửa và gửi lại" (mở lại form tuyến/ngày). Link web là chữ thường 13px, không bấm được. | Khách bấm nút chính, gửi lại mà chưa có giấy, đơn lại bị trả. Ngõ cụt. | Khi thiếu giấy tờ: nút chính "Tải giấy tờ trên web" (mở web đúng đơn), nút phụ "Gửi lại yêu cầu". Khi thiếu thông tin đơn: giữ "Sửa và gửi lại". |
| R-13 | CUS-04, CUS-03, CUS-16 | 2 | Major | Đặt cọc và tải giấy tờ mở web, nhưng không nói người dùng có phải đăng nhập lại trên trình duyệt hay không. JWT nằm trong app, web không có phiên. | Khách đang muốn trả tiền lại gặp màn đăng nhập web: rơi rụng ở bước quan trọng nhất về doanh thu. | Thiết kế sheet "Mở trang thanh toán" kèm trạng thái "Đang mở phiên an toàn", và đề xuất backend cấp mã một lần cho web (mục 5). |
| R-14 | ESC-02, ESC-05 | 6 | Major | Báo bất thường (việc gấp nhất) chỉ vào được qua nút "⋯" 44pt trên thẻ ngựa hoặc chạm giữ (không có gợi ý). ESC-05 có nút phụ nhưng nhãn chỉ là "Bất thường". | Một tay, ngựa đang kích động: tìm nút ba chấm nhỏ là chậm và dễ trượt. | Trên thẻ ngựa, thay "⋯" bằng nút chữ "Báo bất thường" 56pt viền đỏ (kiểu IncidentButton). ESC-05 đổi nhãn thành "Báo bất thường". |
| R-15 | `theme.ts` (incidentSeverity), DRV-06, DRV-09 | 1, 4 | Major | Token mức độ dùng khóa `LOW/MEDIUM/HIGH`, API dùng `RED/ORANGE/YELLOW` (`incidents.severity`). | Dev map sai một lần là "Nghiêm trọng" hiện thành "Nhẹ". Sự cố ngựa bị xử lý chậm. | Đổi khóa thành `RED/ORANGE/YELLOW` đúng API, hoặc thêm bảng map trong `theme.ts`. |
| R-16 | CUS-13, CUS-14, DRV-02 | 1 | Major | Người nhận ở điểm đến chỉ ghi được dạng chữ tự do trong ghi chú (chip gợi ý "Người nhận: anh Tuấn, 0908 456 789"). Trong khi DRV-02 cần `recipient_name/phone` có cấu trúc. | Tài xế không có số người nhận (xem R-09). Chip gợi ý chứa số điện thoại mẫu dễ bị chèn nhầm vào đơn thật. | Thêm ô "Người nhận (không bắt buộc)": tên + SĐT ở CUS-12 hoặc CUS-13. Bỏ chip có số điện thoại. Backend: mục 5. |
| R-17 | COM-01, COM-02 | 9 | Major | Không dùng logo thật (`BrandLogo.tsx`, `horse-transport-logo.png`). Splash và đăng nhập dùng icon đầu ngựa tự vẽ trong ô vàng; nét icon thô, nhìn giống ký tự hơn đầu ngựa. | Đây là hai màn đầu tiên mọi người thấy. Web và app sẽ có hai dấu hiệu nhận diện khác nhau. | Dùng logo thật cho COM-01/COM-02 và icon app. Icon đầu ngựa tự vẽ chỉ dùng ở tab bar, và cần vẽ lại cùng nét Lucide (đã ghi trong 02). |
| R-18 | COM-10--3 (mọi actor) | 3, 4 | Minor | Hộp "Đăng xuất?" có nút "Đăng xuất" màu vàng, đặt trên; "Huỷ" ở dưới. | 05 mục 5.22: nút an toàn ở trên, hành động phá hủy dùng destructive; 5.1 cấm vàng cho nút phá hủy. | "Ở lại" (secondary) ở trên, "Đăng xuất" destructive ở dưới. |
| R-19 | CUS-13 | 3 | Minor | Khi ô trống, nút vàng là "Bỏ qua". | Màu chính khuyến khích bỏ qua, trong khi ghi chú là nơi duy nhất ghi người nhận và tình trạng ngựa. | Nút vàng luôn "Tiếp tục". Ghi "Không bắt buộc" ở nhãn ô. |
| R-20 | CUS-01, CUS-05, COM-09 (chuông) | 4, 5 | Minor | Vàng dùng làm nhãn: "Báo cáo mới: Kim Long · Căng thẳng" (pill vàng), "Mới" vàng, số đếm chuông vàng. | 5b: vàng chỉ cho một nút chính. Báo cáo Căng thẳng là cảnh báo (cam), không phải hành động. | Nhãn báo cáo mới dùng tone theo tình trạng (warning cho Căng thẳng) + icon. "Mới" dùng nền `onBrand`/teal. Số đếm chuông dùng `surfaceBrand` như TabBar. |
| R-21 | CUS-05, DRV-09 | 4, 9 | Minor | Card lồng card: thẻ báo cáo sức khỏe nằm trong thẻ Lộ trình (CUS-05); ô ghi chú xử lý có nền và viền trong thẻ sự cố (DRV-09). | 05 mục 5.11 và 5c cấm lồng thẻ. Mật độ tăng, nhìn nặng. | CUS-05: báo cáo là dòng phụ trong timeline, phân cách bằng đường kẻ. DRV-09: ghi chú xử lý là đoạn có vạch trái, không nền. |
| R-22 | CUS-10 (sáng 2,49:1, tối 3,1:1), CUS-11 | 5 | Minor | Placeholder "Chưa nhập" dùng `textDisabled`. CUS-11: lý do khóa "Đang trên đơn HR-…" cũng màu disabled. | 05 quy định placeholder dùng `textSecondary`. Lý do khóa là thông tin cần đọc, không được miễn tương phản. | Placeholder và lý do khóa dùng `textSecondary` (5,5:1). |
| R-23 | CUS-15 | 5 | Minor | Số bước "1" trong vòng tròn hiện tại: chữ `textSecondary` trên nền tối, 2,21:1 (tối 4,29:1). | Không đọc được. | Chữ số dùng `onBrand` khi nền đậm, hoặc bỏ số và dùng icon. |
| R-24 | CUS-01 | 5 | Minor | Chữ phụ `onBrandMuted` 13px ở đầu phải của gradient (#14606a) chỉ đạt 4,59:1. | Sát ngưỡng, dưới nắng không đọc được. | Chữ phụ trên gradient dùng `onBrand` với opacity 0.85, hoặc 15px. |
| R-25 | Mọi màn tối | 5 | Minor | Thẻ `surface` #0c2326 trên nền #061416 chỉ 1,15:1, đường kẻ `border` 1,34:1. | Ngoài trời, ở chế độ tối các thẻ hòa vào nền. | Tăng `border` dark lên khoảng #2a5055, hoặc nền thẻ #102b2f. Đo lại ≥1,5:1 cho đường kẻ. |
| R-26 | ESC-05, ESC-02 | 4 | Minor | Nhãn "đã hơn 4 giờ chưa uống" ở ESC-05 là hộp cam, trong khi 05 mục 5.14 quy định nền `surfaceBrand`, chữ trắng. | Cùng một cảnh báo hai kiểu ở hai màn. | Chọn một kiểu (đề xuất cam vì là cảnh báo) và sửa 05 cho khớp. |
| R-27 | CUS-02 (40pt), 05 mục 5.7 (36pt) | 4 | Minor | Chip lọc đơn đo 40pt; 05 lại quy định chip filter 36, thấp hơn mức tối thiểu 44 của chính 05. | Design system tự mâu thuẫn. | Chip filter 44 trong 05 và UI. |
| R-28 | `theme.ts` (`inputHeight` 52), 05 mục 5.3 (ô cao 56) | 4 | Minor | Token và spec ô nhập lệch nhau. | Dev sẽ chọn một trong hai một cách ngẫu nhiên. | Thống nhất 56 (ô có nhãn trong ô). |
| R-29 | DRV-09, DRV-08, ESC-06 | 1 | Minor | Mã sự cố "SC-0457" không có trong dữ liệu (`incidents` chỉ có `id`). | Trường tự bịa, dev không biết lấy từ đâu. | Dùng `#457` từ id, hoặc đề xuất backend (mục 5). |
| R-30 | DRV-02--1, DRV-05 | 1, 8 | Minor | Thẻ ghi "Trạm kiểm dịch động vật cửa khẩu quốc tế Bavet – Svay Rieng", nút ghi "Trạm kiểm dịch Svay Rieng", bản đồ ghi "CK Mộc Bài". Không có trường tên ngắn trong `locations`. | Ba tên cho một điểm. App không có quy tắc rút gọn. | Định nghĩa trường tên ngắn (mục 5) hoặc quy tắc cắt; dùng thống nhất ở nút, timeline, bản đồ. |
| R-31 | CUS-05--1 | 8 | Minor | Câu "Điều phối đã được báo" khi trễ. Không có dữ liệu nào cho biết điều này. | Hứa điều không kiểm chứng làm mất niềm tin khi khách gọi hỏi. | Bỏ câu, hoặc chỉ hiện khi backend có cờ đã cảnh báo. |
| R-32 | DRV-13 | 1 | Minor | 02 ghi DRV-13 hiện người nhận và mục còn chờ gửi; bản UI không có người nhận. | Thiếu bằng chứng giao cho ai. | Thêm dòng "Người nhận" từ `recipient_name`. |
| R-33 | driver.html COM-12 | 7 | Minor | Bản tài xế chỉ có 1 biến thể Hàng chờ, không có "mục bị từ chối" (409/4xx). Biến thể này chỉ có trong `common.html`. | 06 nói mỗi bản đã đủ màn chung; người duyệt bản tài xế không thấy nhánh lỗi quan trọng nhất của hàng chờ. | Đưa biến thể "1 mục bị từ chối" (kèm "Sửa / Bỏ") vào bản tài xế. |
| R-34 | CUS-05 | 2, 9 | Minor | Thẻ bản đồ chỉ là dải xám gradient cao khoảng 80pt (02 ghi 160pt), không có tuyến hay điểm; "Xem bản đồ" mở khung vẽ sau. | Việc số 1 của khách là "ngựa đang ở đâu". Ô xám trông như ảnh lỗi. | Bản đồ tĩnh 160pt có tuyến và chấm "vị trí ước tính", vẽ tiếp màn bản đồ toàn màn. |
| R-35 | COM-02 → COM-03 (khách) | 2 | Minor | "Tạo tài khoản" mở khung COM-03 (vẽ sau). | Khách mới không vào được app. | Trong MVP, link mở trang đăng ký web và ghi rõ "Đăng ký trên web". |
| R-36 | DRV-03 | 3, 7 | Minor | Nút "Đã kiểm tra tất cả" gãy 2 dòng ("tất / cả") ở 390pt và 360pt; cả hai nút chỉ 48. Nhãn nút chính chỉ là "Xong". | Nút gãy nhìn lỗi. "Xong" không nói điều gì xảy ra. | Xếp dọc: "Xong, sẵn sàng khởi hành" (vàng, 64) trên, "Đánh dấu tất cả" (tertiary) dưới. |
| R-37 | DRV-07 | 3 | Minor | Ô ảnh nằm dưới nếp gấp, sau câu mẫu. Không thấy vị trí tự lấy. | Chức năng là "báo sự cố kèm ảnh". Tài xế sẽ gửi mà quên ảnh. | Đưa PhotoPicker lên ngay dưới dòng loại/mức. Dòng vị trí ngay dưới. |
| R-38 | ESC-04 | 3 | Minor | Màn đã tự lưu nháp ("tự lưu nháp lúc 07:42") nhưng vẫn có nút "Lưu nháp" ở đáy. Nhịp tim 46 ngoài khoảng 28–44 không có cảnh báo (CUS-06 có cảnh báo cho nhiệt độ). | Nút thừa chiếm vùng ngón cái. Hộ tống không được nhắc khi số đo bất thường. | Bỏ "Lưu nháp", nút chính chiếm cả hàng. Ô số đo ngoài khoảng: viền và chữ cam như CUS-06. |
| R-39 | ESC-03 | 6, 8 | Minor | "Bỏ chọn" là chip nằm cùng hàng với chip ngựa. | Trông như một con ngựa thứ ba; bấm nhầm là bỏ chọn cả đoàn. | Chuyển thành link tertiary "Chọn tất cả / Bỏ chọn" bên phải nhãn nhóm. |
| R-40 | ESC-07--1 đến --3 | 8 | Minor | Nút quay lại của sheet đặt góc trên phải, hình chevron trái. | Ngược quy ước, người dùng tìm ở góc trái. | Quay lại ở trái, đóng (X) ở phải, như sheet ESC-03. |
| R-41 | CUS-11 | 3 | Minor | 5/8 ngựa bị khóa xếp đầu danh sách, vẫn hiện ô tick rỗng, không có icon khóa (ghi chú dev nói có). | Khách phải cuộn qua ngựa không chọn được. | Ngựa chọn được lên đầu; ngựa khóa gom cuối với tiêu đề "Đang trên đơn khác", icon khóa thay ô tick. |
| R-42 | Toàn bộ Android | 8 | Minor | Không ghi hành vi nút Back hệ thống: đóng sheet, đóng dialog, hỏi lại khi form có dữ liệu, thoát wizard CUS-11–14. Thông báo xác nhận bo 22 kiểu iOS. | Android là đa số máy tài xế ở Việt Nam. | Thêm bảng hành vi Back vào 06 và biến thể Android cho thông báo (bo 16 như 05 đã ghi). |
| R-43 | Toàn bộ | 8 | Minor | Ghi chú màn không nêu nhãn trợ năng cho component phức tạp: StopTimeline, vạch mức độ, Stepper, bản đồ, thanh Hoàn tác có đếm ngược. | VoiceOver/TalkBack đọc "1, 2, 3" hoặc bỏ qua. | Thêm câu đọc mẫu cho từng component, ví dụ "Mức độ: Nghiêm trọng, 3 trên 3", "Hoàn tác ghi mốc, còn 4 giây". Thanh Hoàn tác cần kéo dài khi bật trình đọc màn hình. |
| R-44 | Nhiều màn | 8 | Minor | Từ ngữ chưa thống nhất: "Huỷ" (nút) và "Đã hủy" (token); "Ổn định" (ESC) và "Sức khỏe ổn định" (05); "Bỏ ăn" vừa là tình trạng vừa là mức ăn uống trong cùng ESC-04; lọc "Đã xong" và "Đã đóng" (CUS-02); "Quản lý điều phối" (CUS-03) lẫn hai vai trò. | Người dùng không phân biệt được hai lựa chọn gần nghĩa. | Chọn "Hủy". Ăn uống đổi thành "Không ăn". "Đã xong" → "Đã giao", "Đã đóng" → "Từ chối, đã hủy". Ghi đúng một vai trò người duyệt. |
| R-45 | DRV-02 | 6 | Polish | "Báo sự cố" cách nút chính 8pt ở vùng ngón cái. | Xe rung, bấm nhầm sang Báo sự cố (mở form, không nguy hiểm nhưng mất thời gian). | Tăng khoảng cách lên 16. |
| R-46 | DRV-04--1 | 6 | Polish | Sửa giờ chỉ có ±5 phút. Ghi bù 2 giờ cần 24 lần bấm. | Tình huống "quên ghi" thường lệch nhiều. | Chạm vào giờ mở picker giờ gốc (05 đã có DateTimePicker). |
| R-47 | DRV-02 | 3 | Polish | Nhãn "Kế tiếp" trong timeline đặt ngay sau dòng phụ 13px, cỡ lớn hơn, lệch baseline. | Nhìn như lỗi dàn trang. | Dùng StatusBadge nhỏ hoặc bỏ, vì vòng vàng đã nói điểm hiện tại. |
| R-48 | ESC-05, ESC-06 | 8 | Polish | "38,6 °C" bị ngắt dòng giữa số và đơn vị. | Đọc sai số đo. | Khoảng trắng không ngắt giữa số và đơn vị. |
| R-49 | ESC-02, ESC-05, CUS-06 | 1 | Polish | Dữ liệu mẫu lệch: tổng nước hôm nay 10 L nhưng Sao Mai 10 L + Kim Long 8 L; nhịp tim 46 ở ESC-04 nhưng 48 ở CUS-06. | Người duyệt dễ nghi màn tính sai. | Dùng một bộ dữ liệu mẫu cho cả 3 bản. |
| R-50 | DRV-13, CUS-15, DRV-08, COM-06, COM-07 | 9 | Polish | Màn kết quả (vòng tròn xanh tick ở giữa, tiêu đề, bảng) và màn xin quyền (3 dòng tick trong ô màu) là mẫu rất phổ biến. | Đây là chỗ app trông "tự sinh" nhất. | Màn kết quả: bắt đầu bằng thông tin thật ("Đã giao 2 ngựa lúc 10:40") canh trái, bỏ vòng tròn lớn. Màn quyền: thay ô tick bằng câu ngắn có icon nội dung (người, xe, khóa). |
| R-51 | ESC-02, CUS-06, CUS-11 | 9 | Polish | Ảnh giữ chỗ là ô gradient xám. 05 mục 5.14 quy định icon ngựa trên `surfaceMuted`. | Ô gradient trông như ảnh lỗi và là gradient thứ hai trong app. | Dùng icon ngựa trên nền phẳng như 05. |
| R-52 | driver.html (bảng ghi chú) | 4 | Polish | Ghi chú dev vẫn ghi DRV-05, DRV-09 "P1, vẽ sau", trong khi đã vẽ P0. Màu bản đồ (#eaf2ef, #0b1f22…) chưa có trong `theme.ts`. | Ghi chú cũ gây hiểu nhầm khi bàn giao. | Sửa ghi chú. Thêm nhóm token `map` vào `theme.ts`. |

### Đếm theo mức

| Mức | Số vấn đề |
| --- | --- |
| Critical | 2 |
| Major | 15 |
| Minor | 27 |
| Polish | 8 |
| Tổng | 52 |

## 3. Năm thay đổi tác động lớn nhất

1. **Chuẩn hóa vùng chạm và cỡ chữ cho tài xế và hộ tống** (R-03, R-04, R-05, R-06, R-07). Mọi phần tử bấm được ≥56. Bộ 4 cỡ chữ cố định. Giờ dự kiến 24 đậm. Thiết kế lại thanh đáy DRV-02 để chịu được chữ 130% và màn 360pt.
2. **Mở các luồng P0 đang bị chặn** (R-01, R-09, R-10, R-12). Camera bị từ chối có đường đi (thư viện, Cài đặt). Biến thể GPS tắt / quyền bị từ chối. Gọi người nhận ngay trên DRV-02 tại điểm giao. "Cần bổ sung giấy tờ" có nút chính mở web.
3. **Sửa hợp đồng dữ liệu trước khi code** (R-02, R-15, R-16, R-29, R-30). Bỏ "Thiến" và dấu bắt buộc hộ chiếu ở CUS-10. Đổi khóa mức độ sự cố theo API. Người nhận là trường có cấu trúc. Bỏ trường tự bịa.
4. **Làm trạng thái nhìn thấy được ở chế độ tối** (R-08, R-25, R-22). Màu chip đang chọn ở dark đạt ≥3:1. Đường kẻ thẻ rõ hơn. Placeholder và lý do khóa dùng `textSecondary`.
5. **Thương hiệu và nền tảng** (R-17, R-11, R-42, R-18, R-20). Dùng logo thật. Chữ xin quyền vị trí riêng cho Android. Bảng hành vi Back. Vàng chỉ cho một nút chính, không cho nhãn hay nút phá hủy.

## 4. Những gì đang làm tốt (giữ nguyên)

- **DRV-02 một nút theo ngữ cảnh + thanh Hoàn tác 5 giây ở đáy.** Đúng việc, đúng lúc, nằm trong vùng ngón cái. Thanh Hoàn tác có đếm ngược và tương phản tốt (vàng trên teal 6,9:1).
- **Mất sóng dùng teal, không dùng đỏ** (Banner offline, nhãn "Chờ gửi" trên timeline, COM-12). Thông điệp "vẫn được lưu" rất đúng với tài xế vùng biên.
- **Hộp xác nhận DRV-04 có sửa giờ trong 24 giờ.** Giải quyết thực tế "quên ghi mốc".
- **ESC-03 Ghi nhanh**: mặc định cả đoàn, Uống nước, 12 L; 2 chạm cho việc thường gặp nhất. Chip không đổi kích thước khi chọn, sheet không giật.
- **ESC-07 Báo bất thường**: ô chụp ảnh lớn chiếm nửa sheet, lỗi thiếu ảnh hiện ngay dưới ô thay vì khóa nút. Y tế khẩn tách riêng, viền đỏ.
- **ESC-06 Nhật ký**: đính chính thay vì sửa, nhãn Chờ gửi / Nháp / Khách đã xem rõ ràng.
- **CUS-04 Báo giá dạng hóa đơn**: số canh phải, tabular, có VAT, Đã thanh toán, Còn lại; hạn báo giá đếm giờ. Đáng tin.
- **CUS-05 trung thực**: ghi rõ "Vị trí ước tính theo mốc gần nhất", báo cáo sức khỏe xen đúng điểm dừng.
- **Nhãn trạng thái luôn có icon + chữ**; mức độ sự cố có vạch 1-2-3 + chữ. Không truyền nghĩa chỉ bằng màu.
- **Độ phủ trạng thái**: gần như mọi màn có tải, trống, lỗi, mất sóng và dữ liệu dài. Hiếm thấy ở giai đoạn này.
- **Token màu bám web và đã đo tương phản**; đổi warning sang cam đất là quyết định đúng. Không emoji, không gradient sai chỗ, không minh họa.
- **Chữ UI cụ thể**: "Xác nhận đã thông quan", "Cần 1 ảnh để gửi. Chụp rõ vùng bất thường", "Thanh toán cọc 3.402.000 ₫". Lỗi nói cách sửa.
- **Nhãn trợ năng cho nút icon**: đo tự động không thấy nút icon nào thiếu `aria-label`; chip có `aria-pressed`.

## 5. Thay đổi backend/API mới phát hiện

Chỉ liệt kê điểm chưa có trong G1–G13 (01) và danh sách cuối 04. Chỉ là đề xuất.

| # | Thay đổi | Lý do (màn) | Mức |
| --- | --- | --- | --- |
| B1 | `customer_horse_profiles.payload.sex` thêm giá trị "Thiến" (gelding), hoặc UI bỏ lựa chọn này | CUS-10 (R-02) | Bắt buộc MVP (quyết định) |
| B2 | Người nhận có cấu trúc cho yêu cầu đơn giản: cho phép `recipientName`, `recipientPhone` ở `POST/PUT /orders` mà không cần cả `booking`. 02 đã ghi là khoảng trống; đề xuất nâng thành bắt buộc vì DRV-02 cần gọi người nhận | CUS-13, DRV-02, DRV-13 (R-09, R-16) | Bắt buộc MVP |
| B3 | Mã một lần để mở web đã đăng nhập: `POST /auth/web-handoff` trả token ngắn hạn, web đổi lấy phiên rồi chuyển tới trang thanh toán hoặc giấy tờ của đơn | CUS-04, CUS-03 (R-12, R-13) | Nên có cho MVP |
| B4 | Tên ngắn của điểm dừng: `locations.short_name` (hoặc trong `route_plan`) | DRV-02, DRV-05 (R-30) | Nên có |
| B5 | Mã sự cố hiển thị (`incident_code`), hoặc thống nhất dùng `#id` | DRV-09, DRV-08 (R-29) | Nên có |
| B6 | Giờ và người tiếp nhận sự cố: xác nhận `IIncident` trả `receivedByName`, `acknowledgedAt`, `handlingNote` cho người báo | DRV-09 (CẦN XÁC NHẬN) | Nên có |
| B7 | Cờ "đã cảnh báo điều phối về trễ" trong `IOrderTimeline`, nếu muốn giữ câu ở CUS-05--1 | CUS-05 (R-31) | Tùy chọn |
| B8 | Khoảng bình thường của nhiệt độ, nhịp tim đặt trong `packages/shared` để ESC-04 và CUS-06 cảnh báo giống nhau | ESC-04, CUS-06 (R-38) | Nên có |
| B9 | `summary` của care-activities theo ngày (theo múi giờ chuyến), không chỉ theo cả chuyến | ESC-02 "Hôm nay, cả đoàn" (CẦN XÁC NHẬN cách tính hiện tại) | Nên có |
| B10 | Báo trạng thái định vị của máy tài xế: `POST /tracking/trips/:id/device-status` (quyền vị trí, GPS bật/tắt) để điều phối biết vì sao không có điểm GPS | DRV-02 biến thể GPS tắt (R-10) | Sau MVP |

## Tóm tắt

- Điểm nhóm: phạm vi 7, luồng 6, phân cấp 7, design system 5, chữ và màu 4, thao tác 6, trạng thái 8, nền tảng và nội dung 5, thương hiệu 7.
- Điểm actor: tài xế 6, hộ tống 7, khách hàng 7.
- 52 vấn đề: 2 Critical, 15 Major, 27 Minor, 8 Polish.
- Hai lỗi Critical: camera bị từ chối làm kẹt mọi báo cáo bắt buộc ảnh; CUS-10 gửi giá trị giới tính API không nhận.
- Nền tảng (token, luồng, trạng thái, chữ UI) tốt. Việc cần làm là đưa quy tắc ergonomics của chính 00/05 vào từng pixel cho tài xế và hộ tống.
