# Kết quả chuyển Excel sang SQL

Nguồn: `C:\Users\Ninh Quoc Bao\Downloads\wdp_du_lieu.xlsx`

Tổng: 486 bản ghi, 24 bảng.

Giữ nguyên dữ liệu nguồn; không tự thêm, sửa hoặc xác nhận đây là dữ liệu thực tế. Workbook ghi rõ dữ liệu mẫu tại Muc_luc!A6 và phần mô tả từng sheet. password_hash đang là <bcrypt-hash>, không dùng được để đăng nhập. Đường dẫn attachment không chứng minh tệp đã tồn tại.

Giữ nguyên thời gian Excel. Schema quy ước UTC; nếu Excel nhập giờ Việt Nam thì cần xác nhận trước khi đổi giờ.

Đã kiểm tra cột, trường bắt buộc, độ dài CHAR/VARCHAR, kiểu số nguyên, PK/UNIQUE/FK/CHECK/ENUM bằng SQLite trong bộ nhớ sau khi chuyển đổi schema. Chưa thực thi trên MySQL; kiểm tra collation utf8mb4_unicode_ci và stored procedure cần MySQL.

| Bảng | Số dòng |
|---|---:|
| users | 20 |
| system_parameters | 5 |
| document_types | 20 |
| authorities | 20 |
| locations | 20 |
| vehicles | 20 |
| carriers | 20 |
| orders | 24 |
| horses | 24 |
| quarantine_rules | 20 |
| quarantine_rule_doctypes | 20 |
| documents | 20 |
| trips | 19 |
| trip_assignments | 22 |
| legs | 20 |
| leg_milestones | 28 |
| horse_logs | 20 |
| incidents | 20 |
| alerts | 20 |
| attachments | 24 |
| document_versions | 20 |
| dossiers | 20 |
| notifications | 20 |
| audit_logs | 20 |

## Kiểm tra nghiệp vụ (không tự sửa nguồn)
- Ngựa có chủ khác khách hàng của đơn: Không phát hiện.
- Nhật ký gắn ngựa và chuyến khác đơn: Không phát hiện.
- Sự cố gắn chặng khác chuyến: Không phát hiện.
- Sự cố gắn ngựa khác đơn của chuyến: Không phát hiện.
- Phiên bản upload sau thời điểm duyệt giấy tờ: 19, 20 (ID)
- Chặng đến trước lúc xuất phát thực tế: Không phát hiện.

## Cách nhập
1. Mở wdp_du_lieu_import.sql bằng File → Open SQL Script trong MySQL Workbench.
2. Kết nối database wdp đúng schema v2, 24 bảng rỗng. Không chạy lại schema gốc vì có DROP DATABASE.
3. Chạy toàn bộ file bằng Ctrl+Shift+Enter. Không chỉ chạy các INSERT hoặc CREATE PROCEDURE riêng lẻ.
4. Đối chiếu bảng đếm kết quả cuối file với bảng trên.
5. Nếu báo bảng đã có dữ liệu, dừng và kiểm tra; không xóa dữ liệu để ép nhập. Nếu Workbench dừng lỗi khiến procedure còn tồn tại, sau khi xử lý nguyên nhân chạy DROP PROCEDURE IF EXISTS wdp.import_wdp_excel_20261008; trước khi thử lại. Nếu dừng lỗi trước bước khôi phục sql_mode, ngắt và kết nối lại phiên.

File này cần quyền CREATE ROUTINE, EXECUTE, ALTER ROUTINE, SELECT và INSERT. Không sửa file Excel nguồn.
