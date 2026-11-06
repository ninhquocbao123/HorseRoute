# 14 — Kế hoạch sửa lỗi sau khi Long test trên máy ảo

Ngày 06/11/2026. Trạng thái: **đã sửa xong đợt 1 và đợt 2, xem mục 9. Đã có trên `long`.**

Đơn phát hiện lỗi: `VCN-20261025-0002`, tài khoản khách `huy.hoang@phutho.vn`.

## 1. Thẻ chuyến đang chạy ở trang chủ khách bị cắt

**Hiện tượng:** dòng "Xem hành trình" bị cắt ở đáy thẻ khi tên điểm đến dài: `43, Manorom · มโนรมย์, Chai Nat · ชัยนาท`.

**Vị trí:** `RunningCard` trong `apps/mobile/src/screens/CustomerScreens.tsx`.

**Đã thấy trong code:**

- Thẻ có `overflow: "hidden"`, nên phần nội dung tràn ra bị cắt thay vì đẩy thẻ cao lên.
- Tên điểm đến dùng cỡ chữ 24, không giới hạn số dòng.
- Tên lấy nguyên từ dữ liệu địa điểm, gồm cả chữ Thái lẫn chữ Latin.

**Nguyên nhân gốc, đã xác nhận khi tái hiện:** chữ không bị cắt mà nền gradient thấp hơn nội dung. `Svg` giữ kích thước đo lần đầu, khi thẻ còn ngắn vì dữ liệu chuyến chưa tải xong, nên không cao theo thẻ. Giao diện tối vẫn thấy chữ trắng tràn ra ngoài nền; giao diện sáng thì chữ trắng trên nền trắng nên trông như bị cắt. Dự đoán ban đầu về font chữ Thái là sai.

**Cách sửa:**

1. Tái hiện với đúng tên trên, thử thêm một tên dài chỉ có chữ Latin để biết lỗi do chữ Thái hay do độ dài.
2. Tên điểm đến: giới hạn 2 dòng (`numberOfLines={2}`), giảm cỡ chữ khi tên dài. Không được để nội dung bị cắt nữa, kể cả khi bật cỡ chữ hệ thống lớn.
3. Thêm hàm rút gọn tên cho thẻ, bỏ phần chữ không phải Latin sau dấu `·`. **Không dùng `shortName` có sẵn:** hàm này cắt ở dấu phẩy đầu tiên, tên trên sẽ chỉ còn `43`.
4. Kiểm tra các chỗ khác cũng hiện tên này: thẻ theo dõi CUS-05, màn tài xế.

**Xong khi:** "Xem hành trình" hiện đủ với tên dài, ở cả cỡ chữ thường và cỡ chữ lớn, giao diện sáng và tối.

## 2. Xóa nút "Xem toàn tuyến"

**Vị trí:**

- Khách: `TrackingMapScreen` trong `CustomerScreens.tsx`.
- Tài xế: `CrewWork.tsx`, cùng nhãn nhưng là nút chuyển qua lại với "Bám theo xe".

**Cách sửa, phần khách:** xóa nút, bỏ `view` và `TripMapHandle` nếu không còn dùng ở màn này. Trạng thái `fallback` cũng chỉ phục vụ nút này nên bỏ theo.

**Hệ quả:** khách kéo bản đồ đi xa thì không có nút quay về toàn tuyến, phải thoát màn rồi mở lại hoặc tự thu phóng.

**Giữ nguyên:** hàm `fit()` trong `TripMapView`, vì màn tài xế còn dùng.

**Xong khi:** màn bản đồ của khách không còn nút; bản đồ vẫn tự hiện toàn tuyến lúc mở (kiểm tra lại trên máy ảo).

## 3. Khách không thấy nhật ký chăm sóc của hộ tống

**Hộ tống ghi 2 loại dữ liệu:**

| Loại | Thao tác | Bảng, API | Khách trên mobile |
| --- | --- | --- | --- |
| Chăm sóc: cho ăn, uống nước, nghỉ chân | Ghi nhanh | `horse_care_activities`, `POST /tracking/trips/:id/care-activities` | **Không thấy** |
| Báo cáo sức khỏe | Báo cáo | `horse_logs`, `POST /tracking/legs/:id/horse-logs` | Thấy, nếu bật "Gửi cho khách" (mặc định bật) |

**Nguyên nhân:** API cho khách đã có, `GET /tracking/orders/:orderId/care-activities`, và web đã dùng (`CareLog` trong `apps/web/src/features/tracking/customer/CustomerTracking.tsx`). Mobile chỉ gọi `horse-reports`, chưa gọi API này. **Lỗi nằm ở mobile, không cần đổi API.**

**Cách sửa:**

1. `TrackingScreen` (CUS-05): tải thêm `care-activities` và làm mới cùng nhịp với timeline.
2. Thêm loại `care` vào `TrackEvent`, xếp xen vào timeline đúng giờ như báo cáo sức khỏe.
3. Thêm dòng tóm tắt như web. Dùng lại cách hiển thị của `care-ui.ts` trên web, nhãn phải giống nhau.
4. Hiện ảnh chăm sóc nếu có. API ảnh đã cho khách xem (`attachments/:id`).

**Xong khi:** hộ tống ghi cho ăn, uống nước, nghỉ chân thì khách thấy trên timeline trong lần làm mới kế tiếp (tối đa 60 giây), không có bản đã bị đính chính.

## 4. Không có thông báo khi hộ tống chăm sóc ngựa

**Nguyên nhân:** `createCareActivity` trong `tracking.service.ts` chỉ ghi audit, không gọi `notify`. Báo cáo sức khỏe thì đã có thông báo `HORSE_REPORT`, nhưng chỉ khi gửi cho khách.

**Cách sửa:**

1. Thêm thông báo `CARE_ACTIVITY` cho khách, ví dụ: `Đơn VCN-20261025-0002: hộ tống đã cho Silver Storm uống 3 lít nước.`
2. Bỏ qua khi là bản đính chính, và khi gửi lại từ hàng chờ. Nhánh `replay` đã trả về sớm nên không tạo trùng; phải có test cho ca này.
3. Ghi thông báo trong cùng transaction với hoạt động, giống các thông báo khác.
4. Khi chạm thông báo, khách mở màn Theo dõi thay vì Chi tiết đơn. Hiện `Notifications` trong `App.tsx` luôn mở `order`.
5. Thông báo này cũng hiện ở chuông của khách trên web. Kiểm tra web hiển thị đúng event mới.
6. Cập nhật OpenAPI nếu có mô tả event, `02-screens`, `changelog`.

**Lưu ý:** app chưa có push. Thông báo chỉ hiện trong app ở lần làm mới kế tiếp, không nổi lên khi app đang tắt.

**Xong khi:** hộ tống ghi xong, khách có đúng một thông báo; đính chính và gửi lại không tạo thêm.

## 5. Đã chốt (Long, 06/11/2026)

1. **Mục 2:** chỉ xóa nút ở màn khách, giữ ở tài xế, vì ở tài xế nút này còn là cách chuyển với "Bám theo xe".
2. **Mục 4, tần suất:** gộp tối đa một thông báo mỗi 30 phút cho mỗi đơn, vì uống nước có thể mỗi giờ một lần. Timeline vẫn hiện đầy đủ.
3. **Mục 3, 4, nghỉ chân cả đoàn:** hoạt động không gắn với một con ngựa thì ghi "cả đoàn", giống web.

## 6. Thứ tự làm

| Bước | Việc | Cỡ | Sửa ở |
| --- | --- | --- | --- |
| 1 | Mục 2, xóa nút | Rất nhỏ | Mobile |
| 2 | Mục 1, tái hiện rồi sửa thẻ | Nhỏ | Mobile |
| 3 | Mục 3, nhật ký trên timeline | Vừa | Mobile |
| 4 | Mục 4, thông báo | Vừa | API và mobile, không cần migration vì `notifications.event_type` là `varchar(50)` |

## 7. Kiểm thử

- Test mobile: gộp timeline có `care` đúng thứ tự giờ; hàm rút gọn tên với tên có chữ Thái, tên có dấu phẩy, tên ngắn.
- `e2e-api.mts` trên MySQL dùng một lần: ghi chăm sóc thì khách có thông báo; đính chính và gửi lại không tạo thêm; khách khác không đọc được.
- Máy ảo: toàn bộ điều kiện "Xong khi" ở các mục trên, thử cả giao diện tối.
- Không chạy test ghi dữ liệu trên DB chung.

## 8. Đợt 2: chỉnh giao diện (Long yêu cầu 06/11/2026)

Toàn bộ chỉ sửa mobile, không đổi API.

### G1. Hồ sơ ngựa: mỗi hồ sơ là một nút riêng

**Hiện tại:** `ProfilesScreen` trong `CustomerScreens.tsx` xếp mọi hồ sơ thành các dòng trong một thẻ chung.

**Cách sửa:** mỗi hồ sơ một thẻ riêng có thể bấm, cách nhau 12pt, giữ icon, tên, dòng phụ và mũi tên. Có phản hồi khi chạm và nhãn cho trình đọc màn hình. Danh sách dài vẫn cuộn được, thẻ cuối không bị nút "Thêm ngựa" che.

### G2. Bỏ tên vai trò ở đầu màn

**Hiện tại:** dòng `subtitle={pages.length === 1 ? roleName : undefined}` trong `App.tsx` hiện "Khách hàng", "Tài xế", "Hộ tống" trên tiêu đề.

**Cách sửa:** bỏ dòng phụ này ở cả 3 actor. Bỏ xong phải kiểm tra lại khoảng cách đầu màn.

**Giữ nguyên:** tên vai trò dưới họ tên trong màn Tài khoản, vì đó là nơi xem mình đang dùng tài khoản loại nào. Long muốn bỏ luôn thì báo (G7).

### G3. Báo sự cố: tách rõ loại sự cố và chi tiết

**Hiện tại:** `IncidentForm` trong `CrewWork.tsx` có 2 nhóm chip cùng kiểu, xuống dòng, nên nhìn như một trường.

**Cách sửa:**

- **Loại sự cố:** một hàng cuộn ngang, tràn ra mép phải màn, chip cuối lộ một phần để biết còn nữa. Bỏ lề phải 16pt của riêng hàng này như `FilterBar`.
- **Chi tiết:** thêm nhãn riêng ("Chi tiết sự cố"), kiểu khác với hàng trên. Đề xuất: hàng trên giữ chip nền teal khi chọn, hàng dưới là chip viền, khi chọn thì nền nhạt và viền teal đậm.
- Không truyền nghĩa chỉ bằng màu: nhãn riêng cho từng trường, và có trạng thái chọn cho trình đọc màn hình.
- Giữ vùng chạm 56pt của tổ lái, đúng 00-context mục 5.

### G4. Mức độ: viền đổi theo màu đã chọn

**Hiện tại:** cùng `IncidentForm`, đang chọn thì viền dùng `c.chipSelectedBg` cho cả 3 mức.

**Cách sửa:** viền theo mức: Nghiêm trọng đỏ, Trung bình cam, Nhẹ vàng. Viền dày hơn khi chọn, thêm dấu tích để không phân biệt chỉ bằng màu.

**Cần lưu ý:** `incidentSeverity` trong `theme.ts` đang để Nhẹ là `neutral`, tức màu xám, nên phải thêm màu vàng. Có sẵn `#ca8a04` trong `INCIDENT_SEVERITY_META`; kiểm tra đủ tương phản ở cả giao diện sáng và tối. Đổi màu cho thanh và chữ của mức Nhẹ cho khớp.

### G5. Nhật ký của hộ tống: bộ lọc cuộn ngang

**Hiện tại:** màn Nhật ký trong `CrewWork.tsx` dùng `s.wrap`, nên "Ăn uống, nghỉ" rơi xuống dòng 2.

**Cách sửa:** dùng lại `FilterBar` trong `ui.tsx`: "Tất cả" cố định, phần còn lại cuộn ngang, tràn mép phải và lộ một phần chip kế tiếp. Màn đơn hàng của khách đã dùng component này.

**Cần lưu ý:** `FilterBar` đang dùng chip `compact` cao 44pt cho khách. Hộ tống cần 56pt, nên thêm tùy chọn cỡ chip. Nếu "Báo cáo sức khỏe" vừa khít màn thì chip sau không lộ; kiểm tra với màn hẹp và màn rộng, thêm khoảng đệm nếu cần.

### G6. Ghi nhanh: giữ nguyên chiều cao khi đổi loại

**Hiện tại:** `QuickLogSheet` trong `CrewWork.tsx` dùng `Sheet` của `overlay.tsx`, cao theo nội dung. Uống nước, Cho ăn, Nghỉ chân có nội dung khác nhau nên sheet nhảy lên xuống mỗi lần chọn.

**Cách sửa:**

- Thêm tùy chọn chiều cao cố định cho `Sheet`, ví dụ `fixedHeight`, mặc định tắt để các sheet khác không đổi.
- `QuickLogSheet` dùng chiều cao đó, đề xuất khoảng 75% màn hình. Phần nội dung cuộn bên trong, nút "Lưu" luôn cố định ở đáy.
- Hàng Uống nước, Cho ăn, Nghỉ chân đứng yên ở cùng vị trí khi đổi loại.
- Đổi loại thì giữ nguyên vị trí cuộn nếu hợp lý, không tự nhảy về đầu làm người dùng mất chỗ.

**Xong khi:** đổi qua lại 3 loại, sheet không đổi kích thước. Màn thấp và khi bàn phím mở vẫn cuộn tới được mọi ô, và nút "Lưu" không che ô đang nhập.

### G7. Câu cần Long chốt

1. **G2:** giữ tên vai trò trong màn Tài khoản? Đề xuất: giữ.
2. **G3:** hàng dưới dùng chip viền như đề xuất, hay Long muốn màu khác?
3. **G5:** có áp dụng hàng cuộn ngang này cho các bộ lọc khác của tổ lái không? Đề xuất: chỉ làm ở Nhật ký như Long yêu cầu, thấy chỗ khác cần thì thêm sau.

### Thứ tự và kiểm thử đợt 2

Làm sau đợt 1, theo thứ tự: G2, G1, G4, G5, G3, G6. G6 đổi `Sheet` dùng chung nên để cuối và kiểm tra lại các sheet khác, như sheet xác nhận giao ngựa.

Kiểm tra trên máy ảo: giao diện sáng và tối, cỡ chữ hệ thống lớn, TalkBack đọc đúng trạng thái đã chọn. Đây là thay đổi giao diện, không cần chạy trên DB ghi dữ liệu thật.

## 9. Kết quả (06/11/2026)

Ba câu ở G7 Long chưa chọn nên làm theo đề xuất: giữ tên vai trò trong màn Tài khoản, hàng chi tiết sự cố dùng chip viền, chỉ đổi bộ lọc ở màn Nhật ký.

**Đã sửa:**

| Mục | Kết quả |
| --- | --- |
| 1 | Nền thẻ theo kích thước đo được, có màu nền dự phòng, tên tối đa 2 dòng, rút gọn bằng `placeName` |
| 2 | Bỏ nút ở bản đồ khách; tài xế giữ nguyên |
| 3 | Timeline CUS-05 có nhật ký chăm sóc xen đúng giờ, dòng tóm tắt, ảnh |
| 4 | Thông báo `CARE_ACTIVITY` gộp 30 phút mỗi đơn; đính chính và gửi lại không báo; chạm mở màn Theo dõi; đẩy realtime cho chuông web |
| G1 | Mỗi hồ sơ ngựa một thẻ |
| G2 | Bỏ dòng vai trò ở đầu màn |
| G3 | Loại sự cố cuộn ngang, tràn cả hai mép; "Chi tiết sự cố" có nhãn và chip viền riêng |
| G4 | Viền và dấu tích theo mức. Mức Nhẹ thêm màu vàng `severityLowMark`, chữ dùng `severityLow` |
| G5 | Nhật ký dùng `FilterBar` với tùy chọn `large`, chip cao 56pt |
| G6 | `Sheet` có tùy chọn `fixedHeight`, Ghi nhanh cao 75% màn hình |

**Kiểm thử:** `tsc` mobile và API sạch, test mobile 61/61, test API 180/180, `e2e-api.mts` 46/46 trên MySQL dùng một lần, gồm 4 ca mới. Đã xem trên máy ảo Android: mục 1 đến 4 và G1 đến G6. Mục 1, 2, G1 xem ở giao diện tối; G3 đến G6 xem ở giao diện sáng.

**Chưa kiểm tra:**

- Ghi nhanh khi bàn phím ảo mở: máy ảo không bật bàn phím ảo. Đã kiểm tra cuộn tới được mọi ô.
- Cỡ chữ hệ thống lớn, TalkBack.
- Chuông thông báo trên web với event mới, và hiển thị G3 đến G6 ở giao diện tối.

**Còn lại, không sửa lần này:**

- Tên có chữ Thái vẫn hiện nguyên ở dòng timeline, nhãn trên bản đồ và câu vị trí từ API. Câu vị trí là cả câu nên không rút gọn bằng `placeName` được; muốn đổi thì sửa ở API.
- Vì gộp thông báo, ghi nhanh cho nhiều ngựa cùng lúc chỉ báo tên con đầu. Timeline vẫn đủ.
