# Hướng dẫn chạy trọn vẹn Flow 4 từ đầu đến cuối

Mục tiêu: tự tay đi hết một đơn hàng từ **Customer tạo đơn** đến **Driver giao ngựa an toàn**, qua đủ các vai trò, để thấy Flow 4 (theo dõi hành trình) hoạt động trên dữ liệu do chính bạn tạo.

Flow 4 không đứng một mình. Nó chỉ bắt đầu được khi đơn đã đi qua Flow 1, 2 và 3. Vì vậy hướng dẫn chia thành 4 phần:

| Phần | Nội dung | Kết quả |
|---|---|---|
| A. Flow 1 | Customer tạo đơn, Manager xét duyệt | Đơn **Đã duyệt**, có checklist giấy tờ và một chuyến nháp |
| B. Flow 2 | Customer nộp giấy tờ, Specialist thẩm định và ghi nhận hồ sơ cơ quan | Giấy tờ **Hợp lệ**, hồ sơ cơ quan **Đã được duyệt** |
| C. Flow 3 | Coordinator lập lộ trình, Manager duyệt, phân công nhân sự, Manager xác nhận READY | Đơn **Sẵn sàng vận chuyển** |
| D. Flow 4 | Driver ghi mốc, nhật ký ngựa, sự cố; Coordinator xử lý; Customer theo dõi | Đơn **Đã giao** |

Ở những chỗ có hai cách đi, hướng dẫn tách thành **Option 1** và **Option 2**. Bạn chọn một Option để làm; muốn thấy hết thì làm lại đơn khác với Option còn lại.

---

## 0. Đọc trước khi bắt đầu

> **Cảnh báo dữ liệu dùng chung.** Hướng dẫn này chạy trên **database thật của nhóm** (Aiven), nơi các bạn khác cũng đang tạo đơn. Mọi thứ bạn tạo sẽ nằm lại trong DB: đơn đã gửi không xóa được, giấy tờ và nhật ký cũng vậy.
> - Gắn nhãn đơn của bạn để dễ nhận ra: ở ô **Yêu cầu đặc biệt** gõ `TEST FLOW4 - <ngày giờ>`.
> - Báo trước cho nhóm là bạn đang chạy thử, để không ai duyệt nhầm hay đụng vào đơn của bạn.
> - Khi Manager/Specialist/Coordinator mở danh sách, hãy chọn đúng **mã đơn của bạn** (xem ở Bước 1), vì trong DB còn nhiều đơn khác đang ở trạng thái Chờ duyệt.

### 0.1. Bật các dịch vụ

Mở PowerShell tại thư mục gốc dự án (`HorseRoute`).

**1. Bật Redis** (nếu API báo lỗi kết nối Redis khi khởi động thì do bước này):
```powershell
docker start horseroute-redis-1
```

**2. Chạy API** (cửa sổ PowerShell thứ nhất):
```powershell
cd apps/api
pnpm start:dev
```
Đợi đến khi log hiện `api_listening`. Dùng `start:dev`, không dùng `npm start` vì nó xóa thư mục `dist` mỗi lần chạy.

**3. Chạy giao diện** (cửa sổ PowerShell thứ hai, tại thư mục gốc):
```powershell
pnpm dev:web
```
Mở http://localhost:5173/login.

**4. Chọn nơi lưu file ảnh/PDF (quan trọng).** Mặc định `.env` lưu file lên Supabase của nhóm. Đường upload thật lên Supabase chưa được thử trực tiếp. Có hai cách:

| Cách | Khi nào dùng | Lệnh (chạy trước `pnpm start:dev`, trong cùng cửa sổ) |
|---|---|---|
| **Mặc định (Supabase)** | Muốn file dùng chung với nhóm, mạng ổn định | Không cần làm gì |
| **Lưu trên máy bạn** (khuyên dùng khi chạy thử) | Muốn chắc chắn không phụ thuộc mạng, không đẩy file thử lên kho chung | `$env:DOCUMENT_STORAGE_PROVIDER='local'` |

Nếu chọn lưu trên máy, file nằm ở `apps/api/var/private-documents`. Đừng đổi cách lưu giữa chừng: file đã nộp theo cách này sẽ không đọc được theo cách kia.

### 0.2. Tài khoản (mật khẩu tất cả: `123456`)

| Vai trò | Email | Tên hiển thị | Việc sẽ làm |
|---|---|---|---|
| Customer | `an.nguyen@saigonturf.vn` | Nguyễn Văn An | Tạo đơn, nộp giấy tờ, theo dõi hành trình |
| Manager | `manager1@wdp.vn` | Lê Thị Minh Châu | Duyệt đơn, duyệt kế hoạch, xác nhận READY |
| Specialist | `specialist1@wdp.vn` | Nguyễn Thanh Hà | Thẩm định giấy tờ, ghi nhận hồ sơ cơ quan |
| Coordinator | `coordinator1@wdp.vn` | Đặng Thu Trang | Lập lộ trình, phân công nhân sự, xử lý sự cố, phát cảnh báo |
| Driver | `driver1@wdp.vn` | Bùi Văn Tài | Ghi mốc, nhật ký ngựa, báo sự cố |
| Escort | `escort1@wdp.vn` | Phan Thị Lan | Được phân công cùng chuyến (có thể dùng như Driver) |

**Cách đăng nhập nhiều vai trò cùng lúc:** dùng mỗi vai trò một cửa sổ ẩn danh, hoặc mỗi vai trò một hồ sơ (profile) trình duyệt khác nhau. Nếu dùng chung một cửa sổ, nhớ **Đăng xuất** trước khi đổi vai trò.

Hãy ghi nhanh vào giấy hai thứ sẽ cần xuyên suốt: **mã đơn** (Bước 1) và **số chuyến** (Bước 6).

### 0.3. Chuẩn bị file giấy tờ

Cần **4 file** để nộp cho 4 loại giấy tờ (Bước 3). Dùng bất kỳ ảnh JPG/PNG hoặc PDF nào **không quá 5 MB**; có thể dùng cùng một file cho cả 4 giấy tờ. Chuẩn bị thêm **1 file** làm giấy phép của cơ quan (Bước 5) và vài ảnh nhỏ để đính kèm nhật ký/sự cố (Bước 12 và 13).

### 0.4. Dữ liệu dùng trong hướng dẫn

- **Tuyến:** Việt Nam → Singapore. Tuyến này có sẵn quy định kiểm dịch trong DB: cơ quan *Animal & Veterinary Service (AVS)*, yêu cầu 4 loại giấy tờ cho mỗi ngựa.
- **Số ngựa:** 1 ngựa cho nhanh (4 giấy tờ). Muốn nhiều ngựa thì thêm ngựa ở Bước 1, mỗi ngựa thêm 4 giấy tờ và 1 hồ sơ cơ quan.
- **Quy tắc giờ:** các ô giờ hiển thị theo giờ Việt Nam (UTC+7).

---

## Sơ đồ trạng thái

```
Customer tạo đơn ──► DRAFT ──► (Lưu và gửi duyệt) ──► PENDING
Manager xét duyệt ──► APPROVED ──► (Coordinator gửi kế hoạch) ──► PREPARING
Manager duyệt kế hoạch + phân công nhân sự + giấy tờ hợp lệ + hồ sơ cơ quan được duyệt
Manager "Xác nhận READY" ──► READY
Driver bấm "Xác nhận xuất phát" (chặng 1) ──► IN_TRANSIT
Driver bấm "Đã giao ngựa an toàn" (chặng cuối) ──► DELIVERED
```

---

# PHẦN A. Flow 1: Tạo đơn và duyệt đơn

## Bước 1. Customer tạo đơn và gửi duyệt

**Tài khoản:** `an.nguyen@saigonturf.vn`

1. Đăng nhập. Ở menu trái chọn **Yêu cầu vận chuyển**.
2. Bấm **Tạo đơn +**. Form "Yêu cầu vận chuyển mới" mở ra.
3. Mục **01 Thông tin hành trình**, điền:

   | Ô | Giá trị |
   |---|---|
   | Địa chỉ đi | `Trang trại Củ Chi, TP. Hồ Chí Minh` |
   | Địa chỉ đến | `Trường đua Singapore Turf Club` |
   | Quốc gia đi | Việt Nam (gõ "Việt" để tìm) |
   | Quốc gia đến | Singapore (gõ "Singapore") |
   | Ngày khởi hành mong muốn | Một ngày **trong tương lai** (ví dụ ngày mai) |
   | Yêu cầu đặc biệt | `TEST FLOW4 - <ngày giờ của bạn>` |

4. Mục **02 Danh sách ngựa**, điền cho Ngựa 1:

   | Ô | Giá trị |
   |---|---|
   | Tên ngựa | `Bạch Mã Test` |
   | Định danh / hộ chiếu | `TESTF4-<ddMMhhmm>` (**phải khác mọi ngựa đã có trong DB**, ví dụ `TESTF4-20101530`) |
   | Giống ngựa, Giới tính, Màu lông | Tuỳ ý (không bắt buộc) |

   Muốn thêm ngựa: bấm **+ Thêm ngựa**, mỗi ngựa một định danh riêng.
5. Bấm **Lưu và gửi duyệt**.

**Kết quả mong đợi:** đơn có mã dạng `WDP-xxxxxxxx`, trạng thái **Chờ duyệt**. **Ghi lại mã đơn này.**
Nếu form báo lỗi ở ô nào, sửa ô đó (lỗi hiện ngay cạnh ô, dữ liệu đã nhập được giữ lại).

*Tuỳ chọn:* bấm **Lưu nháp** thay vì gửi để thử lưu nháp, sau đó mở lại đơn, chọn **Chỉnh sửa và gửi duyệt**.

---

## Bước 2. Manager xét duyệt đơn

**Tài khoản:** `manager1@wdp.vn` (cửa sổ khác)

1. Menu **Yêu cầu vận chuyển**. Ở ô **Trạng thái** chọn *Chờ duyệt*.
2. Bấm đúng dòng có **mã đơn của bạn** (cột khách hàng: Nguyễn Văn An).
3. Cuộn xuống mục **03 Kết quả xét duyệt**. Bạn có hai cách đi:

### Option 1. Duyệt ngay (đường nhanh)
1. Ở **Điều phối viên phụ trách** chọn **Đặng Thu Trang** (đây là người sẽ lập kế hoạch chuyến, nên phải chọn đúng để Bước 6 dùng `coordinator1@wdp.vn`).
2. Mục **Chọn quy định áp dụng**: thấy tuyến `VN → SG` và danh sách quy định. Tích chọn **Quy định #1 · Animal & Veterinary Service (AVS)**; dòng "Đã chọn" phải là `1/1`. Bắt buộc chọn đủ, nếu không bị chặn.
3. Bấm **Duyệt đơn**.

**Kết quả mong đợi:** đơn chuyển **Đã duyệt**. Hệ thống tự tạo checklist 4 giấy tờ cho mỗi ngựa, một hồ sơ cơ quan (AVS) cho mỗi ngựa và một chuyến ở trạng thái Bản nháp. Customer nhận thông báo.

### Option 2. Yêu cầu bổ sung rồi duyệt lại
1. Điền nội dung vào ô lý do, ví dụ `Vui lòng bổ sung ngày sinh của ngựa`. Nếu để trống, nút bị chặn (đúng quy tắc).
2. Bấm **Yêu cầu bổ sung**. Đơn chuyển **Cần bổ sung**.
3. **Chuyển sang Customer:** mở lại đơn (nó ở trạng thái *Đang bổ sung*), thấy khung **Phản hồi quản lý** với nội dung vừa nhập. Bấm **Chỉnh sửa và gửi duyệt**, bổ sung (ví dụ điền Ngày sinh ngựa), bấm **Lưu và gửi duyệt**. Đơn về **Chờ duyệt**.
4. **Quay lại Manager:** làm đúng như Option 1 (chọn điều phối viên, tích quy định, bấm **Duyệt đơn**).

> Nhánh còn lại, **Từ chối** (kèm lý do), kết thúc đơn ở trạng thái Từ chối và không sinh chuyến. Không dùng nhánh này để chạy tiếp Flow 4.

**Kiểm tra:** đăng nhập lại Customer, menu **Yêu cầu vận chuyển**, mở đơn: trạng thái **Đã duyệt**, mục "Giấy tờ đã ghi nhận" liệt kê 4 giấy tờ cho ngựa, đều **Chưa nộp**.

---

# PHẦN B. Flow 2: Giấy tờ và hồ sơ kiểm dịch

## Bước 3. Customer nộp 4 giấy tờ

**Tài khoản:** `an.nguyen@saigonturf.vn`

1. Menu **Hồ sơ & kiểm dịch**. Bên trái chọn **đơn của bạn**.
2. Tab **Checklist giấy tờ** hiện 4 thẻ:
   - Hộ chiếu ngựa
   - Giấy chứng nhận sức khỏe thú y
   - Kết quả xét nghiệm EIA (Coggins)
   - Giấy chứng nhận tiêm phòng cúm ngựa
3. Với **từng thẻ**: bấm **Chọn giấy tờ từ thiết bị**, chọn file (PDF/JPG/PNG, tối đa 5 MB), thấy phần xem trước, rồi bấm **Nộp phiên bản mới**.

**Kết quả mong đợi:** mỗi thẻ báo "Đã lưu cập nhật hồ sơ", trạng thái **Đã nộp**, mục "Lịch sử file" có 1 phiên bản.
Nếu file quá 5 MB hoặc sai định dạng, hệ thống báo ngay và không gửi.
Nếu báo "Không kết nối được máy chủ" hoặc lỗi lưu file, xem phần **Xử lý sự cố** cuối tài liệu (mục lưu file).

---

## Bước 4. Specialist thẩm định giấy tờ

**Tài khoản:** `specialist1@wdp.vn`

1. Menu **Hồ sơ & kiểm dịch**, chọn **đơn của bạn**, tab **Checklist giấy tờ**.
2. Thẩm định **từng giấy tờ**. Có hai cách đi:

### Option 1. Cả 4 giấy tờ đều hợp lệ (đường nhanh)
- Với mỗi thẻ: nếu có ô **Ngày hết hạn** (giấy chứng nhận sức khỏe, EIA, tiêm phòng cúm có ô này), chọn ngày **ít nhất 1 năm sau hôm nay**. Hộ chiếu ngựa không có ô này.
- Bấm **Đánh dấu hợp lệ**. Thẻ chuyển **Hợp lệ**.

### Option 2. Một giấy tờ bị trả, Customer nộp lại
1. Chọn một giấy tờ (ví dụ *Kết quả xét nghiệm EIA*). Ở ô **Lý do / Nội dung cần bổ sung** gõ `File mờ, không đọc được`.
2. Bấm **Không hợp lệ** (đánh dấu sai) hoặc **Yêu cầu bổ sung** (đề nghị nộp thêm). Nút bị khóa nếu chưa có lý do.
3. **Chuyển sang Customer:** vào lại thẻ đó, thấy dòng "Lý do: …". Chọn file khác, bấm **Nộp phiên bản mới**. Lịch sử file giờ có 2 phiên bản (bản cũ vẫn được giữ).
4. **Quay lại Specialist:** mở lại thẻ, bấm **Xem tài liệu mới nhất** để kiểm tra, rồi **Đánh dấu hợp lệ**.
5. Làm Option 1 cho 3 giấy tờ còn lại.

**Kết quả mong đợi:** cả 4 thẻ đều **Hợp lệ**. Đây là điều kiện bắt buộc trước khi nộp hồ sơ cơ quan.

---

## Bước 5. Specialist ghi nhận hồ sơ cơ quan (AVS)

**Tài khoản:** `specialist1@wdp.vn`, cùng màn hình đơn, chuyển sang tab **Hồ sơ cơ quan**. Mỗi ngựa có một thẻ, cơ quan *Animal & Veterinary Service (AVS)*, trạng thái **Chưa nộp**.

1. **Nộp hồ sơ:** ở ô **Trạng thái mới** giữ *Đã nộp*. Ô **Ngày ghi nhận** để hôm nay. Ô **Mã biên nhận \*** gõ `BN-TEST-001` (bắt buộc). Bấm **Ghi nhận cập nhật**. Thẻ chuyển **Đã nộp**.
2. Bước tiếp, có hai cách đi:

### Option 1. Cơ quan duyệt luôn
1. Ở **Trạng thái mới** chọn *Đã được cơ quan duyệt*.
2. Xuất hiện khung chọn file: **chọn file giấy phép** (bắt buộc với trạng thái duyệt).
3. Bấm **Ghi nhận cập nhật**. Thẻ chuyển **Đã được cơ quan duyệt**, xuất hiện nút **Xem giấy phép**.

### Option 2. Cơ quan yêu cầu bổ sung, nộp lại rồi mới duyệt
1. Chọn *Cần bổ sung*, ở ô **Kết quả / Lý do \*** gõ `Thiếu bản dịch hộ chiếu`, bấm **Ghi nhận cập nhật**. Thẻ chuyển **Cần bổ sung**.
2. Chọn lại *Đã nộp* (nộp lại), nhập mã biên nhận mới `BN-TEST-002`, bấm **Ghi nhận cập nhật**.
3. Chọn *Đã được cơ quan duyệt*, chọn file giấy phép, bấm **Ghi nhận cập nhật**.

> Nếu chọn *Bị từ chối* thì cũng cần lý do, và sau đó có thể nộp lại giống Option 2.

**Kết quả mong đợi:** hồ sơ của mọi ngựa ở **Đã được cơ quan duyệt**. Đây là điều kiện để Manager xác nhận READY ở Bước 9.

**Kiểm tra (tuỳ chọn):** đăng nhập `manager1@wdp.vn`, menu **Hồ sơ & kiểm dịch**, mở đơn: thấy bảng giấy tờ và hồ sơ, nhưng **không có** nút upload hay thẩm định (Manager chỉ xem).

---

# PHẦN C. Flow 3: Kế hoạch chuyến và sẵn sàng vận chuyển

## Bước 6. Coordinator lập lộ trình

**Tài khoản:** `coordinator1@wdp.vn`

1. Menu **Chuyến vận chuyển** (không phải "Điều hành vận hành", mục đó của Flow 4). Danh sách hiện các chuyến bạn phụ trách. Tìm chuyến có **mã đơn của bạn**, bấm vào. **Ghi lại số chuyến** (dạng `Chuyến #123`).
2. Trang chi tiết: kế hoạch đang **Bản nháp**, chưa có chặng. Bấm **Lập kế hoạch**.
3. Chọn lộ trình. Có hai cách đi:

### Option 1. Một chặng thẳng (nhanh nhất, ít bước ở Flow 4)
Bấm **+ Thêm chặng cuối** (nếu form chưa có chặng nào) và điền **Chặng 01**:

| Ô | Giá trị |
|---|---|
| Điểm đi | Sân bay quốc tế Tân Sơn Nhất |
| Điểm đến | Changi Airport |
| Phương tiện | `51C-121.19 · TRUCK · 5 chỗ` (xem lưu ý xe bên dưới) |
| Khởi hành dự kiến | **Giờ hiện tại** (hôm nay) |
| Đến dự kiến | **Hiện tại + 6 giờ** |

### Option 2. Hai chặng có cửa khẩu (đầy đủ nhất, thấy đủ mốc thông quan)
**Chặng 01:**

| Ô | Giá trị |
|---|---|
| Điểm đi | Sân bay quốc tế Tân Sơn Nhất |
| Điểm đến | Cửa khẩu Mộc Bài *(loại BORDER, Driver sẽ phải ghi mốc "Đã thông quan")* |
| Phương tiện | `51C-121.19 · TRUCK · 5 chỗ` |
| Khởi hành dự kiến | Giờ hiện tại |
| Đến dự kiến | Hiện tại + 3 giờ |

Bấm **+ Thêm chặng cuối**, điền **Chặng 02** (điểm đi tự nối từ chặng trước):

| Ô | Giá trị |
|---|---|
| Điểm đi | Nối từ chặng trước (Cửa khẩu Mộc Bài) |
| Điểm đến | Changi Airport |
| Phương tiện | `51C-128.22 · TRUCK · 6 chỗ` |
| Khởi hành dự kiến | Hiện tại + 4 giờ |
| Đến dự kiến | Hiện tại + 9 giờ |

**Lưu ý chọn xe:**
- Chọn xe tải ở bảng trên vì chúng hiện chưa gắn với chuyến nào. Nếu hệ thống báo "Xe trùng lịch" hoặc "Xe còn đang vận hành", chọn xe khác trong danh sách.
- Sức chứa xe phải **không nhỏ hơn số ngựa** trong đơn.
- Giờ đến phải **sau** giờ đi; giờ đi của chặng sau không được trước giờ đến chặng trước.
- Đặt giờ đến ở **tương lai** để chuyến không bị gắn "Trễ hạn" ở Flow 4.

4. Bấm **Lưu bản nháp**.

> **Lưu ý về nút:** bản hiện tại của nút **Lưu bản nháp** vừa lưu **vừa gửi duyệt**. Bạn sẽ thấy thông báo "Đã lưu và gửi kế hoạch chờ duyệt". Không có nút gửi riêng.

**Kết quả mong đợi:** kế hoạch **Chờ duyệt**, đơn chuyển **Đang chuẩn bị**.

---

## Bước 7. Manager duyệt kế hoạch

**Tài khoản:** `manager1@wdp.vn`

1. Menu **Chuyến vận chuyển**, mở chuyến có mã đơn của bạn. Tab **Kế hoạch** thấy các chặng vừa lập.
2. Bấm **Duyệt kế hoạch** (nút ở phía trên). Hộp thoại "Xét duyệt kế hoạch" mở ra. Có hai cách đi:

### Option 1. Duyệt
Bấm **Duyệt kế hoạch** trong hộp thoại. Kế hoạch chuyển **Đã duyệt**.

### Option 2. Trả lại để chỉnh sửa
1. Ở ô **Lý do trả lại** gõ `Đề nghị đổi sang xe có sức chứa lớn hơn`. Bắt buộc phải có lý do.
2. Bấm **Trả lại**. Kế hoạch về **Bản nháp**.
3. **Chuyển sang Coordinator:** mở lại chuyến, thấy khung đỏ **Kế hoạch đã bị trả lại** kèm lý do. Bấm **Chỉnh sửa kế hoạch**, sửa (ví dụ đổi xe), bấm **Lưu bản nháp** (lại gửi duyệt).
4. **Quay lại Manager:** làm Option 1.

**Kết quả mong đợi:** kế hoạch **Đã duyệt**; ở khung bên phải "Tóm tắt chuyến" có người duyệt và thời điểm duyệt.

---

## Bước 8. Coordinator phân công Driver và Escort

**Tài khoản:** `coordinator1@wdp.vn`

1. Menu **Chuyến vận chuyển**, mở chuyến của bạn, tab **Nhân sự**.
2. Bấm **Chọn nhân sự** ở dòng đầu, chọn **Bùi Văn Tài**, vai trò **Tài xế**.
3. Bấm **+ Thêm người**, chọn **Phan Thị Lan**, vai trò **Hộ tống**.
4. Bấm **Xem thay đổi và lưu**, kiểm tra nội dung, bấm **Xác nhận lưu**.

**Kết quả mong đợi:** danh sách nhân sự có 2 người. Bắt buộc có **ít nhất một Tài xế và một Hộ tống khác người**. Hai người được phân công nhận thông báo.

---

## Bước 9. Manager kiểm tra điều kiện và xác nhận READY

**Tài khoản:** `manager1@wdp.vn`

1. Menu **Chuyến vận chuyển**, mở chuyến của bạn, tab **Điều kiện READY**.
2. Bấm **Kiểm tra điều kiện**. Có hai tình huống:

### Option 1. Đủ điều kiện (đúng nếu đã làm tốt Phần B và C)
Danh sách hiện "Không còn blocker". Bấm **Xác nhận READY**, rồi **Xác nhận** trong hộp thoại.

### Option 2. Còn blocker
Hệ thống liệt kê từng lý do. Xử lý rồi bấm **Kiểm tra lại**:

| Blocker thường gặp | Cách xử lý |
|---|---|
| Giấy tờ chưa hợp lệ / hết hạn | Quay lại Bước 4 (Specialist) |
| Hồ sơ cơ quan chưa được duyệt, thiếu giấy phép | Quay lại Bước 5 (Specialist) |
| Thiếu Tài xế hoặc Hộ tống | Quay lại Bước 8 (Coordinator) |
| Xe không đủ chỗ, xe ngừng hoạt động, xe trùng lịch | Quay lại Bước 6 (Coordinator) chọn xe khác; kế hoạch phải được duyệt lại |
| Kế hoạch chưa duyệt | Quay lại Bước 7 |

Khi hết blocker, làm như Option 1.

**Kết quả mong đợi:** đơn chuyển **Sẵn sàng vận chuyển** (READY). Customer, Coordinator và hai nhân sự nhận thông báo. Từ đây trở đi là Flow 4.

---

# PHẦN D. Flow 4: Theo dõi hành trình

## Bước 10. Customer xem trước khi xuất phát

**Tài khoản:** `an.nguyen@saigonturf.vn`, menu **Theo dõi hành trình**.

- Chọn đơn của bạn. Thấy các chặng đều **Chưa bắt đầu**, chưa có dòng "Cập nhật lần cuối".
- Customer chỉ thấy đơn của chính mình. Không có nhật ký ngựa hay sự cố ở đây (đây là dữ liệu nội bộ).

## Bước 11. Driver xác nhận xuất phát

**Tài khoản:** `driver1@wdp.vn`. Nên dùng cửa sổ giả lập điện thoại: F12, bật Device Toolbar (`Ctrl+Shift+M`), chọn 390 px.

1. Menu **Chuyến của tôi**: thấy thẻ chuyến có mã đơn của bạn (số ngựa, xe, tuyến theo kế hoạch). Chỉ thấy chuyến được phân công cho mình.
2. Vào **Mốc hành trình** (hoặc bấm **Cập nhật mốc** ở thẻ chuyến). Có **một nút lớn** `XÁC NHẬN XUẤT PHÁT`.
3. Bấm nút, rồi bấm **Xác nhận** (2 lần chạm). Giờ mặc định là lúc bấm.

**Kết quả mong đợi:** chặng 1 chuyển **Đang di chuyển**, đơn chuyển **Đang vận chuyển**. Customer nhận thông báo khởi hành.

> **Hệ thống kiểm tra lại trước khi cho xuất phát:** nhân sự còn hoạt động, xe còn hoạt động, đủ chỗ và không đang chạy chuyến khác, không có ngựa bị đánh dấu. Nếu có vấn đề, nút báo lỗi kèm lý do và **không ghi gì**. Xử lý nguyên nhân (thường ở Bước 6 hoặc 8) rồi thử lại.

*Tuỳ chọn, nhập bù giờ:* bấm **Nhập bù giờ đã xảy ra** để chọn giờ đã qua. Chỉ cho phép trong **120 phút gần nhất** (chọn xa hơn sẽ bị từ chối) và không chọn được giờ tương lai.

## Bước 12. Driver ghi nhật ký ngựa

**Tài khoản:** `driver1@wdp.vn`, menu **Nhật ký ngựa** (làm khi chuyến đang chạy).

1. Chọn ngựa **Bạch Mã Test**, chọn tình trạng (**Ổn định**, **Bỏ ăn**, **Căng thẳng** hoặc **Thời tiết**), gõ ghi chú.
2. Bấm **Chụp / chọn ảnh** để đính kèm ảnh JPG/PNG (tối đa 3 ảnh, mỗi ảnh ≤ 5 MB). Có hai cách đi:

### Option 1. Không kèm ảnh
Bấm **GỬI NHẬT KÝ**.

### Option 2. Kèm ảnh
Chọn ảnh, thấy ảnh xem trước, bấm **GỬI NHẬT KÝ**. Bản ghi hiện kèm ảnh thu nhỏ.

**Kết quả mong đợi:** thông báo "Đã lưu nhật ký ngựa" và bản ghi hiện trong danh sách.

**Đính chính:** bản ghi không sửa hay xóa được. Bấm **Đính chính bản ghi này**, chọn tình trạng đúng (ví dụ **Ổn định**), gửi. Bản mới ghi "đính chính bản #…"; bản cũ vẫn còn nguyên.

## Bước 13. Driver báo sự cố

**Tài khoản:** `driver1@wdp.vn`, bấm nút đỏ **BÁO SỰ CỐ KHẨN CẤP** (làm khi chuyến đang chạy). Có hai cách đi:

### Option 1. Sự cố thường (Tắc đường hoặc Hỏng xe)
1. Chọn loại **Tắc đường** (hoặc **Hỏng xe**), gõ mô tả, gửi.
2. Thông báo trả về là "Đã báo sự cố. Điều phối viên sẽ liên hệ với bạn." (không phải bản KHẨN như Y tế ngựa). Coordinator của chuyến và Manager nhận thông báo.

### Option 2. Sự cố khẩn (Y tế ngựa)
1. Chọn loại **Y tế ngựa**, gõ mô tả.
2. **Thử không chọn ngựa rồi gửi:** hệ thống báo phải chọn con ngựa bị ảnh hưởng (đúng quy tắc).
3. Chọn ngựa, đính kèm ảnh nếu muốn, gửi. Báo "Đã báo sự cố KHẨN…". Sự cố tự động ở mức **CAO**.

**Kết quả mong đợi:** sự cố ở trạng thái **Mới**, Coordinator và Manager nhận thông báo.

## Bước 14. Coordinator xử lý sự cố, phát cảnh báo, hiệu chỉnh

**Tài khoản:** `coordinator1@wdp.vn`, menu **Điều hành vận hành** (mục khác với "Chuyến vận chuyển"). Chọn chuyến của bạn.

**Tab Sự cố hành trình**
1. Thấy sự cố vừa báo kèm ảnh. Bấm **Tiếp nhận** (Mới thành Đã tiếp nhận).
2. Bấm **Đóng sự cố**. Có hai cách đi:
   - **Option 1:** để trống ghi chú rồi bấm đóng. Hệ thống báo cần ghi hướng xử lý (đúng quy tắc).
   - **Option 2:** nhập hướng xử lý, ví dụ `Đã đổi tuyến, ngựa được bác sĩ thú y kiểm tra`, bấm đóng. Sự cố Đã đóng, hiện dòng "Đã xử lý lúc …".

**Tab Cảnh báo**
- Chọn loại (**Thời tiết**, **Giao thông**, **Cửa khẩu**), nhập nội dung, bấm **Gửi cảnh báo**. Cảnh báo gửi đến Driver, Escort, Manager **và Customer** của đơn.

**Tab Tiến độ, hiệu chỉnh mốc (khi Driver ghi nhầm)**
1. Bấm **Hiệu chỉnh mốc** ở một chặng, chọn trạng thái đúng.
2. Bấm Lưu khi chưa nhập lý do: báo "Lý do hiệu chỉnh là bắt buộc". Nhập lý do rồi lưu. Việc này ghi lại giá trị cũ và mới.

**Tab Nhật ký ngựa:** xem toàn bộ nhật ký của Driver, gồm các bản đính chính.

## Bước 15. Driver hoàn tất hành trình

**Tài khoản:** `driver1@wdp.vn`, menu **Mốc hành trình**. Đầu trang thấy cảnh báo của Coordinator (nếu đã gửi). Mỗi lần: bấm nút lớn rồi **Xác nhận**. Trình tự nút phụ thuộc lộ trình bạn chọn ở Bước 6:

### Option 1. Lộ trình một chặng
Bạn đã bấm xuất phát ở Bước 11. Tiếp theo:
1. `ĐÃ ĐẾN ĐIỂM ĐÍCH`
2. `ĐÃ GIAO NGỰA AN TOÀN`

### Option 2. Lộ trình hai chặng có cửa khẩu
**Chặng 1** (đến Cửa khẩu Mộc Bài; đã xuất phát ở Bước 11):
1. `ĐÃ ĐẾN TRẠM DỪNG`
2. `ĐÃ THÔNG QUAN` (chỉ xuất hiện vì điểm đến là cửa khẩu)
3. `HOÀN THÀNH CHẶNG`

**Chặng 2** (đến Changi Airport):
4. `XÁC NHẬN XUẤT PHÁT`
5. `ĐÃ ĐẾN ĐIỂM ĐÍCH`
6. `ĐÃ GIAO NGỰA AN TOÀN`

**Quy tắc cần biết:**
- Chặng phải đi tuần tự, không bỏ bước. Chặng 2 không xuất phát được khi chặng 1 chưa hoàn thành.
- Chặng cuối không có nút "Hoàn thành chặng": chặng cuối kết thúc bằng `ĐÃ GIAO NGỰA AN TOÀN`.
- Chặng đến cửa khẩu không hoàn thành được nếu chưa `ĐÃ THÔNG QUAN`.
- Mỗi mốc ghi một lần; bấm lặp báo đã ghi nhận.

**Kết quả mong đợi:** cuối cùng hiện "Tất cả các chặng đã hoàn thành"; đơn chuyển **Đã giao**.

## Bước 16. Customer, Manager, Specialist xem kết quả

| Tài khoản | Menu | Cần thấy |
|---|---|---|
| `an.nguyen@saigonturf.vn` (Customer) | **Theo dõi hành trình** | Đơn **Đã giao**, mọi chặng màu xanh kèm các mốc và giờ; dòng "Cập nhật lần cuối lúc … bởi Bùi Văn Tài". Menu **Thông báo** có tin khởi hành, tiến độ chặng và đã giao ngựa an toàn |
| `manager1@wdp.vn` (Manager) | **Tiến độ vận hành** | Xem được chuyến, sự cố, nhật ký ngựa. Tab Sự cố **không có** nút Tiếp nhận hay Đóng |
| `specialist1@wdp.vn` (Specialist) | **Theo dõi thông quan** | Dòng "Bạn xem ở chế độ chỉ đọc"; không có tab Sự cố, không có nút Hiệu chỉnh |

Chuyến đã giao không còn nằm trong danh sách "đang vận hành" của Coordinator và Manager.

---

# Danh sách kiểm tra cuối

- [ ] Đơn đi đủ trạng thái: Chờ duyệt → Đã duyệt → Đang chuẩn bị → Sẵn sàng → Đang vận chuyển → Đã giao
- [ ] Giấy tờ Hợp lệ, hồ sơ AVS Đã được cơ quan duyệt (có giấy phép)
- [ ] Kế hoạch Đã duyệt, đủ Tài xế và Hộ tống
- [ ] Ghi mốc đúng thứ tự; chặng cửa khẩu có mốc thông quan (nếu chọn lộ trình hai chặng)
- [ ] Nhật ký ngựa có bản đính chính, bản cũ còn nguyên
- [ ] Sự cố đi hết Mới → Đã tiếp nhận → Đã đóng (có ghi chú xử lý)
- [ ] Cảnh báo tới được Driver, Manager và Customer
- [ ] Hiệu chỉnh mốc có lý do và ghi lại giá trị cũ, mới
- [ ] Customer thấy "Cập nhật lần cuối … bởi …" và các thông báo

## Kiểm tra quyền (làm thêm, không bắt buộc)

- Đăng nhập một Customer khác (ví dụ `quan.tran@daina.vn`, `huy.hoang@phutho.vn`): **không thấy** đơn của bạn.
- Đăng nhập `driver2@wdp.vn` (không được phân công): **không thấy** chuyến của bạn.
- Đăng nhập `coordinator2@wdp.vn`: không thấy chuyến của bạn trong **Điều hành vận hành** (chuyến do `coordinator1` phụ trách).

---

# Xử lý sự cố thường gặp

| Hiện tượng | Nguyên nhân và cách xử lý |
|---|---|
| API sập ngay khi khởi động, log `ECONNREFUSED` ở bước Redis | Redis chưa chạy: `docker start horseroute-redis-1`, rồi chạy lại API |
| API sập, log `EAI_AGAIN` | Máy tạm thời không phân giải được tên máy chủ DB cloud. Kiểm tra mạng, thử lại sau ít giây |
| API lỗi `EADDRINUSE` cổng 3000 | Còn một API cũ đang chạy. Tắt nó (hoặc tắt cửa sổ cũ) rồi chạy lại |
| Trang trắng ở `/dashboard` | Vite đôi khi giữ cache file rỗng trên Windows. Dừng `pnpm dev:web` và chạy lại (có thể thêm `--force`) |
| Nộp giấy tờ báo lỗi, ảnh/giấy không lưu được | Có thể do kho Supabase hoặc mạng. Dừng API, đặt `$env:DOCUMENT_STORAGE_PROVIDER='local'` rồi chạy lại API và nộp lại |
| "Bạn thao tác quá nhanh" | API giới hạn 100 request/phút cho mỗi địa chỉ IP. Đợi vài giây rồi làm tiếp. Dữ liệu đã nhập vẫn được giữ |
| Manager không thấy đơn của bạn ở danh sách Chờ duyệt | Đơn chưa được gửi (còn Bản nháp) hoặc đang lọc sai trạng thái. Hãy kiểm tra ở Customer |
| Không tìm thấy chuyến ở Coordinator | Chuyến thuộc về Coordinator mà Manager đã chọn ở Bước 2. Phải chọn **Đặng Thu Trang** để dùng `coordinator1@wdp.vn` |
| Bấm xuất phát báo "Chuyến chưa đủ điều kiện" | Nhân sự, xe hoặc ngựa không còn hợp lệ. Đọc lý do trong thông báo, xử lý ở Bước 6 hoặc 8, hoặc chọn xe khác |
| Bấm xuất phát báo đơn chưa READY | Chưa làm xong Bước 9 |
| Không ghi nhận được giờ nhập bù | Quá 120 phút hoặc ở tương lai. Chọn giờ gần hơn |
| Đăng nhập báo sai mật khẩu | Mật khẩu của các tài khoản `@wdp.vn` và khách trong bảng là `123456`. Tài khoản cá nhân của bạn dùng mật khẩu riêng |

# Lưu ý cuối

- Hướng dẫn này **tạo dữ liệu thật** trong DB chung. Đơn đã gửi, giấy tờ, nhật ký và sự cố không có chức năng xóa. Nếu cần chạy lặp nhiều lần, hãy báo nhóm.
- Sau buổi chạy thử, đóng các cửa sổ API và web (`Ctrl+C`). Nếu đã đặt `DOCUMENT_STORAGE_PROVIDER` trong cửa sổ PowerShell, đóng cửa sổ đó để lần sau API dùng lại cấu hình `.env`.
- Muốn thử Flow 4 mà **không đụng DB chung**, dùng bản demo cục bộ trong [huong-dan-test-flow4.md](huong-dan-test-flow4.md): bản đó có sẵn đơn ở trạng thái READY, chỉ chạy Phần D.
