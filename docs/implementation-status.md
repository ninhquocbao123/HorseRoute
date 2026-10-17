# Trạng thái triển khai

- Flow 1: tạo/duyệt đơn đã nối FE/BE; tự sinh checklist, dossiers và Trip nháp.
- Flow 2: upload phiên bản, thẩm định, bổ sung, theo dõi cơ quan, giấy phép, file riêng có phân quyền, audit và cập nhật hết hạn đã nối FE/BE. Xem flow2.md để chạy migration và cấu hình kho file.
- Flow 3: đã có GET trips, chi tiết và plan-options; phân quyền Coordinator/Manager, dữ liệu danh mục từ MySQL. Đã có PUT lưu kế hoạch nháp với khóa Order → Trip → chặng, transaction, audit và kiểm thử rollback trên fixtures/schema.sql. Đã có POST submit-plan: Trip PENDING_APPROVAL, Order PREPARING, audit và thông báo IN_APP cùng transaction; kiểm tra sơ bộ sức chứa/lịch xe. Đã có POST review-plan: Manager duyệt/trả lại, thông tin duyệt trong TripDetail, kiểm tra lại sức chứa và khóa xe chống duyệt trùng lịch đồng thời. Phân công, readiness và UI lập kế hoạch chưa triển khai.
- Flow 4: mới có khu vực giao diện; chưa triển khai nghiệp vụ.
- Xác thực: JWT/MySQL, đăng ký Customer đủ 5 thông tin. Xem auth-pages-swagger.md.
- Dashboard: tài khoản/đăng xuất nằm trong menu tên ở góc phải; typography và form thống nhất, responsive.

Không tuyên bố đã hoàn tất toàn bộ MVP. Các mục chưa chốt [X] không tự coi là yêu cầu đã xác nhận. Kiểm thử MySQL dùng database riêng; trình duyệt dùng API giả lập.
