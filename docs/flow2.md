# Flow 2 — Hồ sơ pháp lý và kiểm dịch

## Đã nối BE và FE

- Customer: mở Hồ sơ & kiểm dịch, chọn đơn đã có checklist từ Flow 1, upload PDF/JPG/PNG, xem trạng thái, phiên bản cũ, tải file của đơn mình và xem kết quả cơ quan.
- Specialist: xem các đơn có checklist; thẩm định đúng phiên bản mới nhất, ghi ngày hết hạn, đánh dấu không hợp lệ kèm lý do; gửi yêu cầu bổ sung riêng từng mục.
- Specialist: ghi nhận đã nộp cơ quan với ngày và mã biên nhận, đang thẩm định, cần bổ sung, bị từ chối hoặc được duyệt. Phê duyệt phải có file giấy phép; yêu cầu bổ sung/từ chối phải có lý do.
- Manager: đọc checklist, lịch sử và bảng ngựa × cơ quan; không có quyền upload/thẩm định.
- Nhật ký và thông báo được lưu cùng transaction. Upload đồng thời được đánh số phiên bản riêng. File tải xuống qua API kiểm tra role và quyền sở hữu, không có URL công khai.
- Tự chuyển VALID thành EXPIRED theo UTC khi đọc chi tiết và bằng tác vụ mỗi phút trong tiến trình BE. Không đổi kết quả lịch sử của cơ quan thành kết luận mới.

## Quy tắc xử lý

Tất cả giấy tờ trong checklist của ngựa phải VALID và còn hạn trước khi ghi nhận nộp cơ quan hoặc phê duyệt. Khi bất kỳ hồ sơ cơ quan nào của ngựa đang SUBMITTED, REVIEWING hoặc APPROVED, hệ thống khóa thay file/thẩm định. Khi hồ sơ được trả NEED_INFO hoặc REJECTED và không còn hồ sơ khác đang khóa, Customer có thể nộp phiên bản mới; phiên bản mới trở về SUBMITTED để thẩm định lại.

Quy trình cơ quan: NOT_SUBMITTED → SUBMITTED → REVIEWING / NEED_INFO / REJECTED / APPROVED; NEED_INFO/REJECTED có thể nộp lại; APPROVED là kết quả cuối. Màn hình chỉ thể hiện checklist và kết quả ghi nhận từ cơ quan, không tự kết luận đủ điều kiện kiểm dịch.

## Chạy tại máy bạn

```powershell
pnpm migration:run
pnpm dev:api
# Terminal khác
pnpm dev:web
```

Migration SystemAudit cho phép actor_id NULL để phân biệt nhật ký tự động với người dùng. Chưa chạy migration này trên database wdp thật trong lần triển khai.

File lưu riêng ngoài CSDL. Có thể chọn Supabase Storage để cả team dùng chung ảnh/PDF; xem [hướng dẫn cấu hình](supabase-storage.md). Mặc định vẫn là local: `var/private-documents` tính từ thư mục chạy BE; nên đặt DOCUMENT_STORAGE_DIR thành đường dẫn tuyệt đối ổn định trong .env. Khi dùng Docker cần mount volume vào đường dẫn này. Sao lưu DB và thư mục file cùng nhau. Không di chuyển thư mục giữa các lần chạy nếu không cập nhật cấu hình. Các attachment cũ trỏ file chưa có tại kho riêng sẽ báo không tìm thấy, không tự truy cập URL bên ngoài.

Giới hạn tạm thời 5 MB/file, kiểm tra chữ ký PDF/JPG/PNG. Chưa có quét malware. Nếu tiến trình bị tắt giữa lúc ghi file và commit, có thể còn file mồ côi; không xóa tự động các file đó.

Swagger: `/docs`, nhóm Flow 2 - Documents, multipart/form-data upload và dossier, Bearer JWT.

## Kiểm tra

- 25 kiểm thử MySQL đạt, gồm 13 hồi quy Flow 1 và 12 kiểm thử Flow 2. Chỉ tạo/xóa DB wdp_flow2_test_* và thư mục file thử, không sửa wdp.
- Swagger xác nhận multipart và bảo mật download.
- 36 kiểm tra render theo role đạt.
- Trình duyệt Edge headless với API giả lập: Customer upload, Specialist thẩm định và nộp hồ sơ; màn hình mobile không tràn ngang; không có lỗi JavaScript.
- Chưa nghiệm thu end-to-end qua tài khoản thật và dữ liệu wdp thật.

## Chưa triển khai

Specialist upload thay khách và CRUD quy định kiểm dịch là mục [X] chưa chốt. Nhắc trước ngày hết hạn là Phase 2. Flow 3/4 (kế hoạch chuyến, timeline, nhật ký) chưa triển khai. Không xóa giấy tờ để giữ lịch sử.
