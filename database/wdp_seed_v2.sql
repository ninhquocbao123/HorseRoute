-- Dữ liệu giả lập cho wdp_schema_v2.sql, MySQL >= 8.0.16.
-- Chạy sau khi tạo schema, trên database wdp có 24 bảng RỖNG.
-- Mốc demo cố định: 2026-10-08, thời gian DATETIME là UTC.
-- Cơ quan, quy định kiểm dịch và tham số dưới đây chỉ dùng thử nghiệp vụ.
-- password_hash là giá trị vô hiệu có chủ đích; không có mật khẩu đăng nhập.
-- storage_path chỉ là metadata mẫu, chưa có tệp tương ứng.
-- Không xóa dữ liệu, không tắt FK. Lỗi sẽ rollback toàn bộ INSERT.
USE wdp;
SET NAMES utf8mb4;

DELIMITER $$
CREATE PROCEDURE seed_wdp_v2_demo()
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;
  IF EXISTS (SELECT 1 FROM users) OR EXISTS (SELECT 1 FROM system_parameters)
    OR EXISTS (SELECT 1 FROM orders) OR EXISTS (SELECT 1 FROM horses)
    OR EXISTS (SELECT 1 FROM document_types) OR EXISTS (SELECT 1 FROM authorities)
    OR EXISTS (SELECT 1 FROM quarantine_rules) OR EXISTS (SELECT 1 FROM quarantine_rule_doctypes)
    OR EXISTS (SELECT 1 FROM documents) OR EXISTS (SELECT 1 FROM document_versions)
    OR EXISTS (SELECT 1 FROM dossiers) OR EXISTS (SELECT 1 FROM vehicles)
    OR EXISTS (SELECT 1 FROM locations) OR EXISTS (SELECT 1 FROM carriers)
    OR EXISTS (SELECT 1 FROM trips) OR EXISTS (SELECT 1 FROM trip_assignments)
    OR EXISTS (SELECT 1 FROM legs) OR EXISTS (SELECT 1 FROM leg_milestones)
    OR EXISTS (SELECT 1 FROM horse_logs) OR EXISTS (SELECT 1 FROM incidents)
    OR EXISTS (SELECT 1 FROM alerts) OR EXISTS (SELECT 1 FROM attachments)
    OR EXISTS (SELECT 1 FROM notifications) OR EXISTS (SELECT 1 FROM audit_logs)
  THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed requires all 24 tables to be empty; no data was changed.';
  END IF;

  INSERT INTO users (id,email,password_hash,full_name,role,account_status,organization_name,customer_type,address,created_at) VALUES
  (1,'admin@example.com','!DEMO_LOGIN_DISABLED!','Nguyễn Minh An','ADMIN','ACTIVE',NULL,NULL,NULL,'2026-09-01 01:00:00'),
  (2,'manager@example.com','!DEMO_LOGIN_DISABLED!','Trần Hoàng Nam','MANAGER','ACTIVE',NULL,NULL,NULL,'2026-09-01 01:00:00'),
  (3,'specialist@example.com','!DEMO_LOGIN_DISABLED!','Lê Thu Hà','SPECIALIST','ACTIVE',NULL,NULL,NULL,'2026-09-01 01:00:00'),
  (4,'coordinator@example.com','!DEMO_LOGIN_DISABLED!','Phạm Gia Huy','COORDINATOR','ACTIVE',NULL,NULL,NULL,'2026-09-01 01:00:00'),
  (5,'driver@example.com','!DEMO_LOGIN_DISABLED!','Võ Thành Đạt','DRIVER_ESCORT','ACTIVE',NULL,NULL,NULL,'2026-09-01 01:00:00'),
  (6,'escort@example.com','!DEMO_LOGIN_DISABLED!','Đặng Ngọc Mai','DRIVER_ESCORT','ACTIVE',NULL,NULL,NULL,'2026-09-01 01:00:00'),
  (7,'club@example.com','!DEMO_LOGIN_DISABLED!','Nguyễn Bảo Long','CUSTOMER','ACTIVE','CLB Ngựa Ánh Dương Demo','CLUB','Khu chuồng ngựa Demo, Long An, Việt Nam','2026-09-01 01:00:00'),
  (8,'owner@example.com','!DEMO_LOGIN_DISABLED!','Trần Thanh Lan','CUSTOMER','ACTIVE',NULL,'INDIVIDUAL','Trang trại Demo, Tây Ninh, Việt Nam','2026-09-01 01:00:00'),
  (9,'pending@example.com','!DEMO_LOGIN_DISABLED!','Lê Minh Khang','CUSTOMER','PENDING',NULL,'INDIVIDUAL',NULL,'2026-10-07 01:00:00'),
  (10,'locked@example.com','!DEMO_LOGIN_DISABLED!','Phạm Ngọc Anh','CUSTOMER','LOCKED',NULL,'INDIVIDUAL',NULL,'2026-09-01 01:00:00');

  -- Mã DEMO riêng vì schema chưa giải thích ý nghĩa nghiệp vụ của L/D/N/S/T.
  INSERT INTO system_parameters (param_code,param_value,description) VALUES
  ('DEMO_REV','48','Demo: số giờ phản hồi đơn; chưa nối với cấu hình ứng dụng'),
  ('DEMO_EXP','30','Demo: số ngày cảnh báo giấy tờ sắp hết hạn'),
  ('DEMO_FILE','10485760','Demo: dung lượng tệp tối đa tính bằng byte');

  INSERT INTO document_types (id,name,has_expiry,description) VALUES
  (1,'Hộ chiếu ngựa',0,'Giấy nhận dạng ngựa trong bộ dữ liệu demo'),
  (2,'Giấy chứng nhận sức khỏe',1,'Chứng nhận sức khỏe giả lập'),
  (3,'Giấy chứng nhận tiêm phòng',1,'Chứng nhận tiêm phòng giả lập');

  INSERT INTO authorities (id,name,authority_type,country) VALUES
  (1,'Cơ quan nông nghiệp VN Demo','AGRICULTURE','VN'),
  (2,'Hải quan VN Demo','CUSTOMS','VN'),
  (3,'Trạm kiểm dịch KH Demo','QUARANTINE','KH');

  INSERT INTO locations (id,name,location_type,country,timezone,address) VALUES
  (1,'Trạm kiểm dịch xuất phát Demo','QUARANTINE_STATION','VN','Asia/Ho_Chi_Minh','Tây Ninh, Việt Nam'),
  (2,'Điểm nghỉ trước cửa khẩu Demo','REST_STOP','VN','Asia/Ho_Chi_Minh','Tây Ninh, Việt Nam'),
  (3,'Cửa khẩu VN Demo','BORDER','VN','Asia/Ho_Chi_Minh','Tây Ninh, Việt Nam'),
  (4,'Trạm kiểm dịch đến Demo','QUARANTINE_STATION','KH','Asia/Phnom_Penh','Svay Rieng, Campuchia'),
  (5,'Sân bay VN Demo','AIRPORT','VN','Asia/Ho_Chi_Minh','TP. Hồ Chí Minh, Việt Nam'),
  (6,'Sân bay SG Demo','AIRPORT','SG','Asia/Singapore','Singapore'),
  (7,'Trạm nhiên liệu Demo','FUEL_STOP','VN','Asia/Ho_Chi_Minh','Tây Ninh, Việt Nam');

  INSERT INTO quarantine_rules (id,origin_country,destination_country,border_location_id,authority_id,updated_by,updated_at) VALUES
  (1,'VN','KH',3,3,3,'2026-09-01 02:00:00');
  INSERT INTO quarantine_rule_doctypes (rule_id,document_type_id) VALUES (1,1),(1,2),(1,3);

  INSERT INTO vehicles (id,vehicle_type,capacity_stalls,plate_or_code,is_active) VALUES
  (1,'TRUCK',4,'DEMO-TRUCK-01',1),
  (2,'TRUCK',2,'DEMO-TRUCK-02',0),
  (3,'AIRCRAFT_HOLD',6,'DEMO-AIR-01',1),
  (4,'CRATE',1,'DEMO-CRATE-01',1);
  INSERT INTO carriers (id,name,iata_code) VALUES (1,'Hãng vận chuyển hàng không Demo',NULL);

  INSERT INTO orders (id,order_code,customer_id,origin_address,origin_country,destination_address,destination_country,desired_departure_date,status,created_at,submitted_at,reviewed_by,reviewed_at,manager_note,response_deadline) VALUES
  (1,'DEMO-2026-001',7,'Trạm kiểm dịch xuất phát Demo','VN','Trạm kiểm dịch đến Demo','KH','2026-10-20','DRAFT','2026-10-07 01:00:00',NULL,NULL,NULL,NULL,NULL),
  (2,'DEMO-2026-002',8,'Trạm kiểm dịch xuất phát Demo','VN','Trạm kiểm dịch đến Demo','KH','2026-10-21','PENDING','2026-10-06 01:00:00','2026-10-07 02:00:00',NULL,NULL,NULL,'2026-10-09 02:00:00'),
  (3,'DEMO-2026-003',7,'Trạm kiểm dịch xuất phát Demo','VN','Trạm kiểm dịch đến Demo','KH','2026-10-22','NEED_INFO','2026-10-01 01:00:00','2026-10-02 02:00:00',2,'2026-10-03 03:00:00','Cần bổ sung chứng nhận sức khỏe','2026-10-10 03:00:00'),
  (4,'DEMO-2026-004',8,'Trạm kiểm dịch xuất phát Demo','VN','Trạm kiểm dịch đến Demo','KH','2026-10-23','REJECTED','2026-10-01 01:00:00','2026-10-02 02:00:00',2,'2026-10-03 03:00:00','Không đáp ứng điều kiện vận chuyển demo',NULL),
  (5,'DEMO-2026-005',7,'Trạm kiểm dịch xuất phát Demo','VN','Trạm kiểm dịch đến Demo','KH','2026-10-15','APPROVED','2026-10-01 01:00:00','2026-10-02 02:00:00',2,'2026-10-03 03:00:00','Đồng ý tiếp nhận đơn',NULL),
  (6,'DEMO-2026-006',8,'Trạm kiểm dịch xuất phát Demo','VN','Trạm kiểm dịch đến Demo','KH','2026-10-12','PREPARING','2026-10-01 01:00:00','2026-10-02 02:00:00',2,'2026-10-03 03:00:00','Đang hoàn thiện hồ sơ',NULL),
  (7,'DEMO-2026-007',7,'Trạm kiểm dịch xuất phát Demo','VN','Trạm kiểm dịch đến Demo','KH','2026-10-10','READY','2026-09-20 01:00:00','2026-09-21 02:00:00',2,'2026-09-22 03:00:00','Đủ hồ sơ và kế hoạch',NULL),
  (8,'DEMO-2026-008',8,'Trạm kiểm dịch xuất phát Demo','VN','Trạm kiểm dịch đến Demo','KH','2026-10-08','IN_TRANSIT','2026-09-20 01:00:00','2026-09-21 02:00:00',2,'2026-09-22 03:00:00','Đã xuất phát',NULL),
  (9,'DEMO-2026-009',7,'Trạm kiểm dịch xuất phát Demo','VN','Trạm kiểm dịch đến Demo','KH','2026-10-05','DELIVERED','2026-09-20 01:00:00','2026-09-21 02:00:00',2,'2026-09-22 03:00:00','Đã bàn giao ngựa',NULL),
  (10,'DEMO-2026-010',8,'Trạm kiểm dịch xuất phát Demo','VN','Trạm kiểm dịch đến Demo','KH','2026-10-18','CANCELLED','2026-10-01 01:00:00','2026-10-02 02:00:00',NULL,NULL,'Khách hủy trước khi duyệt',NULL);

  INSERT INTO horses (id,order_id,owner_id,name,passport_no,order_status,breed,birth_date,sex,coat_color,note) VALUES
  (1,1,7,'Sao Mai','DEMO-PASS-001','NORMAL','Thoroughbred','2021-03-12','FEMALE','Nâu',NULL),
  (2,2,8,'Bạch Phong','DEMO-PASS-002','NORMAL','Arabian','2020-05-20','MALE','Xám',NULL),
  (3,3,7,'Hồng Vân','DEMO-PASS-003','FLAGGED','Thoroughbred','2021-06-10','FEMALE','Nâu đỏ','Chờ giấy sức khỏe hợp lệ'),
  (4,4,8,'Lôi Đình','DEMO-PASS-004','FLAGGED','Arabian','2019-04-15','MALE','Đen','Hồ sơ bị từ chối'),
  (5,5,7,'Ánh Dương','DEMO-PASS-005','NORMAL','Thoroughbred','2020-02-05','MALE','Nâu',NULL),
  (6,6,8,'Thanh Vũ','DEMO-PASS-006','NORMAL','Arabian','2021-07-18','FEMALE','Xám',NULL),
  (7,7,7,'Kim Long','DEMO-PASS-007','NORMAL','Thoroughbred','2020-08-25','MALE','Nâu',NULL),
  (8,8,8,'Phi Vân','DEMO-PASS-008','NORMAL','Arabian','2019-11-08','FEMALE','Xám',NULL),
  (9,9,7,'Ngân Hà','DEMO-PASS-009','NORMAL','Thoroughbred','2020-12-01','FEMALE','Nâu',NULL),
  (10,10,8,'Trường Phong','DEMO-PASS-010','REMOVED','Arabian','2021-01-19','MALE','Đen','Đơn đã hủy'),
  (11,9,7,'Sao Băng','DEMO-PASS-011','NORMAL','Thoroughbred','2020-04-21','MALE','Nâu đỏ',NULL);

  -- Mỗi ngựa có checklist đủ 3 loại giấy tờ.
  INSERT INTO documents (id,horse_id,document_type_id,status,expiry_date,invalid_reason,reviewed_by,reviewed_at)
  SELECT (h.id-1)*3+d.id, h.id, d.id,
    CASE WHEN h.id IN (7,8,9,11) THEN 'VALID'
         WHEN h.id=3 AND d.id=2 THEN 'INVALID'
         WHEN h.id=4 AND d.id=3 THEN 'EXPIRED'
         WHEN h.id IN (2,6) THEN 'SUBMITTED' ELSE 'NOT_SUBMITTED' END,
    CASE WHEN d.has_expiry=0 THEN NULL
         WHEN h.id=4 AND d.id=3 THEN '2026-09-30'
         WHEN h.id IN (2,3,6,7,8,9,11) THEN '2027-03-31' ELSE NULL END,
    CASE WHEN h.id=3 AND d.id=2 THEN 'Bản chụp thiếu chữ ký xác nhận' ELSE NULL END,
    CASE WHEN h.id IN (7,8,9,11) OR (h.id=3 AND d.id=2) OR (h.id=4 AND d.id=3) THEN 3 ELSE NULL END,
    CASE WHEN h.id IN (7,8,9,11) THEN '2026-09-29 04:00:00'
         WHEN (h.id=3 AND d.id=2) OR (h.id=4 AND d.id=3) THEN '2026-10-03 02:00:00' ELSE NULL END
  FROM horses h CROSS JOIN document_types d;

  INSERT INTO trips (id,order_id,plan_status,planned_departure_at,planned_arrival_at,planned_by,approved_by,approved_at) VALUES
  (1,5,'DRAFT','2026-10-15 01:00:00','2026-10-15 07:00:00',4,NULL,NULL),
  (2,6,'PENDING_APPROVAL','2026-10-12 01:00:00','2026-10-12 07:00:00',4,NULL,NULL),
  (3,7,'APPROVED','2026-10-10 01:00:00','2026-10-10 07:00:00',4,2,'2026-10-01 05:00:00'),
  (4,8,'APPROVED','2026-10-08 01:00:00','2026-10-08 07:00:00',4,2,'2026-10-01 05:00:00'),
  (5,9,'APPROVED','2026-10-05 01:00:00','2026-10-05 07:00:00',4,2,'2026-10-01 05:00:00');

  INSERT INTO trip_assignments (id,trip_id,user_id,role,assigned_by,assigned_at) VALUES
  (1,3,5,'DRIVER',4,'2026-10-01 06:00:00'),(2,3,6,'ESCORT',4,'2026-10-01 06:00:00'),
  (3,4,5,'DRIVER',4,'2026-10-01 06:00:00'),(4,4,6,'ESCORT',4,'2026-10-01 06:00:00'),
  (5,5,5,'DRIVER',4,'2026-10-01 06:00:00'),(6,5,6,'ESCORT',4,'2026-10-01 06:00:00');

  INSERT INTO legs (id,trip_id,seq_no,from_location_id,to_location_id,vehicle_id,planned_departure_at,planned_arrival_at,status,actual_departure_at,actual_arrival_at,updated_by,updated_at) VALUES
  (1,1,1,1,4,1,'2026-10-15 01:00:00','2026-10-15 07:00:00','NOT_STARTED',NULL,NULL,NULL,NULL),
  (2,2,1,1,4,1,'2026-10-12 01:00:00','2026-10-12 07:00:00','NOT_STARTED',NULL,NULL,NULL,NULL),
  (3,3,1,1,4,1,'2026-10-10 01:00:00','2026-10-10 07:00:00','NOT_STARTED',NULL,NULL,NULL,NULL),
  (4,4,1,1,2,1,'2026-10-08 01:00:00','2026-10-08 02:00:00','COMPLETED','2026-10-08 01:00:00','2026-10-08 02:00:00',5,'2026-10-08 02:00:00'),
  (5,4,2,2,4,1,'2026-10-08 02:30:00','2026-10-08 07:00:00','MOVING','2026-10-08 02:30:00',NULL,5,'2026-10-08 02:30:00'),
  (6,5,1,1,4,1,'2026-10-05 01:00:00','2026-10-05 07:00:00','COMPLETED','2026-10-05 01:00:00','2026-10-05 07:00:00',5,'2026-10-05 07:00:00');

  INSERT INTO leg_milestones (id,leg_id,milestone_type,occurred_at,recorded_by) VALUES
  (1,4,'DEPARTED','2026-10-08 01:00:00',5),
  (2,4,'ARRIVED_AT_STOP','2026-10-08 02:00:00',5),
  (3,5,'DEPARTED','2026-10-08 02:30:00',5),
  (4,6,'DEPARTED','2026-10-05 01:00:00',5),
  (5,6,'CUSTOMS_CLEARED','2026-10-05 04:00:00',6),
  (6,6,'DELIVERED','2026-10-05 07:00:00',6);

  INSERT INTO horse_logs (id,horse_id,leg_id,condition_status,note,logged_at,created_by,corrects_log_id) VALUES
  (1,8,4,'STABLE','Ăn uống bình thường trước khi xuất phát','2026-10-08 01:00:00',6,NULL),
  (2,8,5,'STRESSED','Bồn chồn khi xe đi qua đoạn đường đông','2026-10-08 02:40:00',6,NULL),
  (3,9,6,'OFF_FEED','Ghi nhận ban đầu: ăn ít','2026-10-05 02:00:00',6,NULL),
  (4,9,6,'STABLE','Đính chính bản ghi 3: khẩu phần đã được ăn trước giờ kiểm tra','2026-10-05 02:10:00',6,3),
  (5,11,6,'CLIMATE_CHANGE','Theo dõi phản ứng khi nhiệt độ tăng','2026-10-05 03:00:00',6,NULL),
  (6,9,6,'STABLE','Tình trạng ổn định khi bàn giao','2026-10-05 07:00:00',6,NULL),
  (7,11,6,'STABLE','Tình trạng ổn định khi bàn giao','2026-10-05 07:00:00',6,NULL);

  INSERT INTO incidents (id,trip_id,leg_id,horse_id,incident_type,description,urgency,status,reported_by,reported_at,received_by,handling_note,closed_at) VALUES
  (1,4,5,NULL,'LONG_TRAFFIC_JAM','Ùn xe trên đường đến cửa khẩu Demo','NORMAL','ACKNOWLEDGED',5,'2026-10-08 02:45:00',4,'Điều phối đang theo dõi thời gian chờ',NULL),
  (2,4,5,8,'HORSE_MEDICAL','Ngựa có dấu hiệu căng thẳng cần đánh giá','HIGH','NEW',6,'2026-10-08 02:50:00',NULL,NULL,NULL),
  (3,5,6,NULL,'VEHICLE_BREAKDOWN','Cảm biến cửa khoang báo lỗi tại điểm dừng','NORMAL','CLOSED',5,'2026-10-05 02:30:00',4,'Đã kiểm tra và khắc phục trước khi tiếp tục','2026-10-05 02:50:00');

  INSERT INTO alerts (id,trip_id,alert_type,content,sent_by,sent_at) VALUES
  (1,4,'TRAFFIC','Đoạn đường đến cửa khẩu đang ùn xe',4,'2026-10-08 02:46:00'),
  (2,3,'WEATHER','Kịch bản demo: dự kiến mưa, kiểm tra che chắn trước chuyến',4,'2026-10-07 03:00:00'),
  (3,3,'BORDER','Kịch bản demo: xác nhận giờ tiếp nhận tại cửa khẩu',4,'2026-10-07 03:10:00');

  -- Upload trước khi duyệt; ID tệp giấy tờ bằng ID checklist.
  INSERT INTO attachments (id,original_name,file_type,size_bytes,storage_path,uploaded_by,uploaded_at)
  SELECT d.id,CONCAT('demo-document-',d.id,'.pdf'),'PDF',2048,
    CONCAT('demo/documents/',d.id,'/v1.pdf'),h.owner_id,
    CASE WHEN h.id IN (7,8,9,11) THEN '2026-09-28 02:00:00' ELSE '2026-10-02 02:00:00' END
  FROM documents d JOIN horses h ON h.id=d.horse_id WHERE d.status <> 'NOT_SUBMITTED';

  INSERT INTO document_versions (id,document_id,version_no,attachment_id,uploaded_by,uploaded_at)
  SELECT a.id,a.id,1,a.id,a.uploaded_by,a.uploaded_at FROM attachments a;

  INSERT INTO attachments (id,original_name,file_type,size_bytes,storage_path,uploaded_by,uploaded_at,horse_log_id,incident_id) VALUES
  (101,'demo-permit-7.pdf','PDF',2048,'demo/permits/7.pdf',3,'2026-09-30 04:00:00',NULL,NULL),
  (102,'demo-permit-8.pdf','PDF',2048,'demo/permits/8.pdf',3,'2026-09-30 04:00:00',NULL,NULL),
  (103,'demo-permit-9.pdf','PDF',2048,'demo/permits/9.pdf',3,'2026-09-30 04:00:00',NULL,NULL),
  (104,'demo-permit-11.pdf','PDF',2048,'demo/permits/11.pdf',3,'2026-09-30 04:00:00',NULL,NULL),
  (105,'demo-horse-check.jpg','JPG',1024,'demo/logs/1.jpg',6,'2026-10-08 01:01:00',1,NULL),
  (106,'demo-sensor.png','PNG',1024,'demo/incidents/3.png',5,'2026-10-05 02:35:00',NULL,3),
  (107,'demo-passport-v2.pdf','PDF',2048,'demo/documents/19/v2.pdf',7,'2026-09-28 03:00:00',NULL,NULL);
  INSERT INTO document_versions (id,document_id,version_no,attachment_id,uploaded_by,uploaded_at) VALUES
  (101,19,2,107,7,'2026-09-28 03:00:00');

  INSERT INTO dossiers (id,horse_id,authority_id,status,submitted_at,receipt_code,result_at,result,rejection_reason,permit_attachment_id,specialist_id) VALUES
  (1,5,3,'NOT_SUBMITTED',NULL,NULL,NULL,NULL,NULL,NULL,3),
  (2,6,1,'SUBMITTED','2026-10-04 01:00:00','DEMO-R002',NULL,NULL,NULL,NULL,3),
  (3,6,2,'REVIEWING','2026-10-04 01:00:00','DEMO-R003',NULL,NULL,NULL,NULL,3),
  (4,6,3,'NEED_INFO','2026-10-04 01:00:00','DEMO-R004','2026-10-06 01:00:00','Cần bổ sung bản xác nhận',NULL,NULL,3),
  (5,7,3,'APPROVED','2026-09-29 05:00:00','DEMO-R005','2026-09-30 04:00:00','Chấp thuận demo',NULL,101,3),
  (6,8,3,'APPROVED','2026-09-29 05:00:00','DEMO-R006','2026-09-30 04:00:00','Chấp thuận demo',NULL,102,3),
  (7,9,3,'APPROVED','2026-09-29 05:00:00','DEMO-R007','2026-09-30 04:00:00','Chấp thuận demo',NULL,103,3),
  (8,11,3,'APPROVED','2026-09-29 05:00:00','DEMO-R008','2026-09-30 04:00:00','Chấp thuận demo',NULL,104,3),
  (9,5,1,'REJECTED','2026-10-04 01:00:00','DEMO-R009','2026-10-06 01:00:00',NULL,'Hồ sơ demo không đủ xác nhận',NULL,3);

  INSERT INTO notifications (id,recipient_id,event_type,content,related_type,related_id,channel,is_read,created_at) VALUES
  (1,2,'ORDER_SUBMITTED','Có đơn DEMO-2026-002 chờ duyệt','orders',2,'IN_APP',0,'2026-10-07 02:00:00'),
  (2,7,'ORDER_NEED_INFO','Đơn DEMO-2026-003 cần bổ sung giấy tờ','orders',3,'EMAIL',1,'2026-10-03 03:00:00'),
  (3,5,'TRIP_ASSIGNED','Bạn được phân công lái xe chuyến 3','trips',3,'IN_APP',1,'2026-10-01 06:00:00'),
  (4,4,'INCIDENT_REPORTED','Cần xử lý dấu hiệu căng thẳng của ngựa Phi Vân','incidents',2,'SMS',0,'2026-10-08 02:50:00'),
  (5,7,'ORDER_DELIVERED','Đơn DEMO-2026-009 đã bàn giao','orders',9,'IN_APP',0,'2026-10-05 07:00:00');

  INSERT INTO audit_logs (id,actor_id,occurred_at,entity_type,entity_id,action,old_value,new_value,reason) VALUES
  (1,2,'2026-10-03 03:00:00','orders',5,'APPROVE','{"status":"PENDING"}','{"status":"APPROVED"}','Đồng ý tiếp nhận đơn'),
  (2,2,'2026-10-01 05:00:00','trips',3,'APPROVE','{"plan_status":"PENDING_APPROVAL"}','{"plan_status":"APPROVED"}','Kế hoạch đã được kiểm tra'),
  (3,6,'2026-10-05 02:10:00','horse_logs',4,'CORRECT',NULL,'{"corrects_log_id":3,"condition_status":"STABLE"}','Đính chính, giữ nguyên bản ghi cũ'),
  (4,4,'2026-10-05 02:50:00','incidents',3,'CLOSE','{"status":"ACKNOWLEDGED"}','{"status":"CLOSED"}','Đã khắc phục cảm biến');
  COMMIT;
END$$
DELIMITER ;

CALL seed_wdp_v2_demo();
DROP PROCEDURE seed_wdp_v2_demo;

SELECT 'users' AS table_name, COUNT(*) AS row_count FROM users
UNION ALL SELECT 'orders',COUNT(*) FROM orders
UNION ALL SELECT 'horses',COUNT(*) FROM horses
UNION ALL SELECT 'documents',COUNT(*) FROM documents
UNION ALL SELECT 'trips',COUNT(*) FROM trips;
