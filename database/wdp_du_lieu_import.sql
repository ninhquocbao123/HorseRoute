-- Chuyển nguyên dữ liệu từ wdp_du_lieu.xlsx. Không xác thực tính có thật.
-- Workbook tự mô tả là dữ liệu mẫu; password_hash còn là <bcrypt-hash>.
-- Giữ nguyên ID, nội dung, thời gian trong Excel; không tự đổi múi giờ.
-- Chỉ chạy khi 24 bảng rỗng, không có tiến trình khác ghi đồng thời.
-- Không xóa dữ liệu và không tắt khóa ngoại. MySQL >= 8.0.16.
USE wdp;
SET NAMES utf8mb4;
SET @wdp_previous_sql_mode = @@SESSION.sql_mode;
SET SESSION sql_mode = CONCAT_WS(',', NULLIF(@wdp_previous_sql_mode,''), 'NO_BACKSLASH_ESCAPES', 'STRICT_ALL_TABLES');
DELIMITER //
CREATE PROCEDURE import_wdp_excel_20261008()
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SET SESSION sql_mode = @wdp_previous_sql_mode;
    RESIGNAL;
  END;
  START TRANSACTION;
  IF EXISTS (SELECT 1 FROM `users`) OR
     EXISTS (SELECT 1 FROM `system_parameters`) OR
     EXISTS (SELECT 1 FROM `orders`) OR
     EXISTS (SELECT 1 FROM `horses`) OR
     EXISTS (SELECT 1 FROM `document_types`) OR
     EXISTS (SELECT 1 FROM `authorities`) OR
     EXISTS (SELECT 1 FROM `quarantine_rules`) OR
     EXISTS (SELECT 1 FROM `quarantine_rule_doctypes`) OR
     EXISTS (SELECT 1 FROM `documents`) OR
     EXISTS (SELECT 1 FROM `document_versions`) OR
     EXISTS (SELECT 1 FROM `dossiers`) OR
     EXISTS (SELECT 1 FROM `vehicles`) OR
     EXISTS (SELECT 1 FROM `locations`) OR
     EXISTS (SELECT 1 FROM `carriers`) OR
     EXISTS (SELECT 1 FROM `trips`) OR
     EXISTS (SELECT 1 FROM `trip_assignments`) OR
     EXISTS (SELECT 1 FROM `legs`) OR
     EXISTS (SELECT 1 FROM `leg_milestones`) OR
     EXISTS (SELECT 1 FROM `horse_logs`) OR
     EXISTS (SELECT 1 FROM `incidents`) OR
     EXISTS (SELECT 1 FROM `alerts`) OR
     EXISTS (SELECT 1 FROM `attachments`) OR
     EXISTS (SELECT 1 FROM `notifications`) OR
     EXISTS (SELECT 1 FROM `audit_logs`) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Import requires all 24 tables to be empty. No data changed.';
  END IF;

-- Sheet users: 20 rows, Excel rows 5 onward.
INSERT INTO `users` (`id`, `email`, `password_hash`, `full_name`, `phone`, `role`, `account_status`, `organization_name`, `customer_type`, `address`, `created_at`) VALUES
(1, 'admin@wdp.vn', '<bcrypt-hash>', 'Trần Quốc Bảo', '0901000001', 'ADMIN', 'ACTIVE', NULL, NULL, 'Văn phòng WDP, 25 Lê Duẩn, Quận 1, TP.HCM', '2026-01-08 08:00:00'),
(2, 'manager1@wdp.vn', '<bcrypt-hash>', 'Lê Thị Minh Châu', '0901000002', 'MANAGER', 'ACTIVE', NULL, NULL, 'Văn phòng WDP, 25 Lê Duẩn, Quận 1, TP.HCM', '2026-01-11 08:00:00'),
(3, 'manager2@wdp.vn', '<bcrypt-hash>', 'Phạm Hoàng Nam', '0901000003', 'MANAGER', 'ACTIVE', NULL, NULL, 'Văn phòng WDP, 25 Lê Duẩn, Quận 1, TP.HCM', '2026-01-14 08:00:00'),
(4, 'specialist1@wdp.vn', '<bcrypt-hash>', 'Nguyễn Thanh Hà', '0901000004', 'SPECIALIST', 'ACTIVE', NULL, NULL, 'Văn phòng WDP, 25 Lê Duẩn, Quận 1, TP.HCM', '2026-01-17 08:00:00'),
(5, 'specialist2@wdp.vn', '<bcrypt-hash>', 'Võ Đức Anh', '0901000005', 'SPECIALIST', 'ACTIVE', NULL, NULL, 'Văn phòng WDP, 25 Lê Duẩn, Quận 1, TP.HCM', '2026-01-20 08:00:00'),
(6, 'coordinator1@wdp.vn', '<bcrypt-hash>', 'Đặng Thu Trang', '0901000006', 'COORDINATOR', 'ACTIVE', NULL, NULL, 'Văn phòng WDP, 25 Lê Duẩn, Quận 1, TP.HCM', '2026-01-23 08:00:00'),
(7, 'coordinator2@wdp.vn', '<bcrypt-hash>', 'Huỳnh Quốc Việt', '0901000007', 'COORDINATOR', 'ACTIVE', NULL, NULL, 'Văn phòng WDP, 25 Lê Duẩn, Quận 1, TP.HCM', '2026-01-26 08:00:00'),
(8, 'driver1@wdp.vn', '<bcrypt-hash>', 'Bùi Văn Tài', '0901000008', 'DRIVER_ESCORT', 'ACTIVE', NULL, NULL, 'Kho vận WDP, Củ Chi, TP.HCM', '2026-01-29 08:00:00'),
(9, 'driver2@wdp.vn', '<bcrypt-hash>', 'Ngô Minh Khôi', '0901000009', 'DRIVER_ESCORT', 'ACTIVE', NULL, NULL, 'Kho vận WDP, Củ Chi, TP.HCM', '2026-02-01 08:00:00'),
(10, 'escort1@wdp.vn', '<bcrypt-hash>', 'Phan Thị Lan', '0901000010', 'DRIVER_ESCORT', 'ACTIVE', NULL, NULL, 'Kho vận WDP, Củ Chi, TP.HCM', '2026-02-04 08:00:00'),
(11, 'escort2@wdp.vn', '<bcrypt-hash>', 'Đỗ Anh Tuấn', '0901000011', 'DRIVER_ESCORT', 'ACTIVE', NULL, NULL, 'Kho vận WDP, Củ Chi, TP.HCM', '2026-02-07 08:00:00'),
(12, 'an.nguyen@saigonturf.vn', '<bcrypt-hash>', 'Nguyễn Văn An', '0912000012', 'CUSTOMER', 'ACTIVE', 'CLB Đua Ngựa Sài Gòn', 'CLUB', '12 Nguyễn Huệ, Quận 1, TP.HCM', '2026-03-16 09:00:00'),
(13, 'quan.tran@daina.vn', '<bcrypt-hash>', 'Trần Minh Quân', '0912000013', 'CUSTOMER', 'ACTIVE', 'CLB Ngựa Đua Đại Nam', 'CLUB', 'Đại Nam, Phú Hòa, Bình Dương', '2026-03-31 09:00:00'),
(14, 'son.ly@gmail.com', '<bcrypt-hash>', 'Lý Thanh Sơn', '0912000014', 'CUSTOMER', 'LOCKED', NULL, 'INDIVIDUAL', '45 Trần Hưng Đạo, Quận 5, TP.HCM', '2026-04-15 09:00:00'),
(15, 'huy.hoang@phutho.vn', '<bcrypt-hash>', 'Hoàng Gia Huy', '0912000015', 'CUSTOMER', 'ACTIVE', 'CLB Ngựa Đua Phú Thọ', 'CLUB', '2 Lý Thường Kiệt, Quận 11, TP.HCM', '2026-04-30 09:00:00'),
(16, 'mai.vu@gmail.com', '<bcrypt-hash>', 'Vũ Thị Mai', '0912000016', 'CUSTOMER', 'ACTIVE', NULL, 'INDIVIDUAL', '88 Võ Văn Tần, Quận 3, TP.HCM', '2026-05-15 09:00:00'),
(17, 'vinh.le@cuchi-stud.vn', '<bcrypt-hash>', 'Lê Quang Vinh', '0912000017', 'CUSTOMER', 'ACTIVE', 'Trại Ngựa Củ Chi', 'CLUB', 'Tân An Hội, Củ Chi, TP.HCM', '2026-05-30 09:00:00'),
(18, 'thanh.dinh@gmail.com', '<bcrypt-hash>', 'Đinh Công Thành', '0912000018', 'CUSTOMER', 'ACTIVE', NULL, 'INDIVIDUAL', '17 Hoàng Diệu, Quận 4, TP.HCM', '2026-06-14 09:00:00'),
(19, 'weiming@sgracing.sg', '<bcrypt-hash>', 'Tan Wei Ming', '+6591234567', 'CUSTOMER', 'ACTIVE', 'Singapore Racing Partners', 'CLUB', '10 Kranji Way, Singapore', '2026-06-29 09:00:00'),
(20, 'thao.mai@gmail.com', '<bcrypt-hash>', 'Mai Phương Thảo', '0912000020', 'CUSTOMER', 'PENDING', NULL, 'INDIVIDUAL', '23 Pasteur, Quận 1, TP.HCM', '2026-07-14 09:00:00');

-- Sheet system_parameters: 5 rows, Excel rows 5 onward.
INSERT INTO `system_parameters` (`param_code`, `param_value`, `description`) VALUES
('L', '48', 'Tham số L - giá trị mẫu, thay bằng giá trị thực theo nghiệp vụ'),
('D', '7', 'Tham số D - giá trị mẫu, thay bằng giá trị thực theo nghiệp vụ'),
('N', '3', 'Tham số N - giá trị mẫu, thay bằng giá trị thực theo nghiệp vụ'),
('S', '24', 'Tham số S - giá trị mẫu, thay bằng giá trị thực theo nghiệp vụ'),
('T', '72', 'Tham số T - giá trị mẫu, thay bằng giá trị thực theo nghiệp vụ');

-- Sheet document_types: 20 rows, Excel rows 5 onward.
INSERT INTO `document_types` (`id`, `name`, `has_expiry`, `description`) VALUES
(1, 'Hộ chiếu ngựa', 0, 'Giấy tờ định danh ngựa'),
(2, 'Giấy chứng nhận sức khỏe thú y', 1, 'Do bác sĩ thú y cấp, có thời hạn hiệu lực'),
(3, 'Kết quả xét nghiệm EIA (Coggins)', 1, 'Xét nghiệm thiếu máu truyền nhiễm ở ngựa'),
(4, 'Kết quả xét nghiệm viêm động mạch ngựa (EVA)', 1, 'Xét nghiệm EVA'),
(5, 'Giấy chứng nhận tiêm phòng cúm ngựa', 1, 'Lịch sử tiêm phòng cúm ngựa'),
(6, 'Giấy chứng nhận xuất xứ', 0, 'Xác nhận nơi sinh/nguồn gốc'),
(7, 'Giấy chứng nhận quyền sở hữu', 0, 'Chứng minh chủ sở hữu hợp pháp'),
(8, 'Giấy phép xuất khẩu', 1, 'Do cơ quan nước xuất cấp'),
(9, 'Giấy phép nhập khẩu', 1, 'Do cơ quan nước nhập cấp'),
(10, 'Giấy chứng nhận kiểm dịch', 1, 'Cấp sau khi hoàn tất kiểm dịch'),
(11, 'Giấy chứng nhận vi mạch (microchip)', 0, 'Số vi mạch định danh'),
(12, 'Kết quả xét nghiệm bệnh Tị thư (Glanders)', 1, 'Xét nghiệm Glanders'),
(13, 'Kết quả xét nghiệm bệnh Dourine', 1, 'Xét nghiệm Dourine'),
(14, 'Giấy chứng nhận tẩy giun/ký sinh trùng', 1, 'Ghi nhận thuốc và ngày tẩy'),
(15, 'Hợp đồng bảo hiểm vận chuyển', 1, 'Bảo hiểm cho ngựa trong suốt hành trình'),
(16, 'Hợp đồng vận chuyển', 0, 'Hợp đồng giữa khách hàng và WDP'),
(17, 'Tờ khai hải quan', 0, 'Khai báo xuất/nhập khẩu'),
(18, 'Giấy chứng nhận vệ sinh phương tiện', 1, 'Xác nhận khử trùng phương tiện'),
(19, 'Giấy ủy quyền', 0, 'Ủy quyền cho người áp tải/đại diện'),
(20, 'Hồ sơ lịch sử thi đấu', 0, 'Kết quả thi đấu gần đây');

-- Sheet authorities: 20 rows, Excel rows 5 onward.
INSERT INTO `authorities` (`id`, `name`, `authority_type`, `country`) VALUES
(1, 'Cục Thú y', 'QUARANTINE', 'VN'),
(2, 'Tổng cục Hải quan Việt Nam', 'CUSTOMS', 'VN'),
(3, 'Bộ Nông nghiệp và Phát triển nông thôn', 'AGRICULTURE', 'VN'),
(4, 'Animal & Veterinary Service (AVS)', 'QUARANTINE', 'SG'),
(5, 'Singapore Customs', 'CUSTOMS', 'SG'),
(6, 'Singapore Food Agency', 'AGRICULTURE', 'SG'),
(7, 'Agriculture, Fisheries and Conservation Department', 'AGRICULTURE', 'HK'),
(8, 'Hong Kong Customs and Excise Department', 'CUSTOMS', 'HK'),
(9, 'Hong Kong Animal Quarantine Station', 'QUARANTINE', 'HK'),
(10, 'Animal Quarantine Service (MAFF)', 'QUARANTINE', 'JP'),
(11, 'Japan Customs', 'CUSTOMS', 'JP'),
(12, 'Ministry of Agriculture, Forestry and Fisheries', 'AGRICULTURE', 'JP'),
(13, 'Department of Agriculture - Biosecurity', 'QUARANTINE', 'AU'),
(14, 'Australian Border Force', 'CUSTOMS', 'AU'),
(15, 'Department of Agriculture, Fisheries and Forestry', 'AGRICULTURE', 'AU'),
(16, 'Animal and Plant Quarantine Agency (APQA)', 'QUARANTINE', 'KR'),
(17, 'Korea Customs Service', 'CUSTOMS', 'KR'),
(18, 'Department of Veterinary Services Malaysia', 'QUARANTINE', 'MY'),
(19, 'Royal Malaysian Customs Department', 'CUSTOMS', 'MY'),
(20, 'Ministry of Agriculture and Food Security', 'AGRICULTURE', 'MY');

-- Sheet locations: 20 rows, Excel rows 5 onward.
INSERT INTO `locations` (`id`, `name`, `location_type`, `country`, `timezone`, `address`) VALUES
(1, 'Sân bay quốc tế Tân Sơn Nhất', 'AIRPORT', 'VN', 'Asia/Ho_Chi_Minh', 'Trường Sơn, Tân Bình, TP.HCM'),
(2, 'Sân bay quốc tế Nội Bài', 'AIRPORT', 'VN', 'Asia/Ho_Chi_Minh', 'Sóc Sơn, Hà Nội'),
(3, 'Cửa khẩu Mộc Bài', 'BORDER', 'VN', 'Asia/Ho_Chi_Minh', 'Bến Cầu, Tây Ninh'),
(4, 'Trạm kiểm dịch Củ Chi', 'QUARANTINE_STATION', 'VN', 'Asia/Ho_Chi_Minh', 'Tân An Hội, Củ Chi, TP.HCM'),
(5, 'Điểm dừng nghỉ Long Thành', 'REST_STOP', 'VN', 'Asia/Ho_Chi_Minh', 'QL51, Long Thành, Đồng Nai'),
(6, 'Trạm xăng Dầu Giây', 'FUEL_STOP', 'VN', 'Asia/Ho_Chi_Minh', 'QL1A, Thống Nhất, Đồng Nai'),
(7, 'Changi Airport', 'AIRPORT', 'SG', 'Asia/Singapore', 'Airport Blvd, Singapore'),
(8, 'Tuas Checkpoint', 'BORDER', 'SG', 'Asia/Singapore', 'Tuas South Ave, Singapore'),
(9, 'Hong Kong International Airport', 'AIRPORT', 'HK', 'Asia/Hong_Kong', 'Chek Lap Kok, Hong Kong'),
(10, 'Narita International Airport', 'AIRPORT', 'JP', 'Asia/Tokyo', 'Narita, Chiba'),
(11, 'Sydney Kingsford Smith Airport', 'AIRPORT', 'AU', 'Australia/Sydney', 'Mascot NSW'),
(12, 'Melbourne Airport', 'AIRPORT', 'AU', 'Australia/Melbourne', 'Tullamarine VIC'),
(13, 'Incheon International Airport', 'AIRPORT', 'KR', 'Asia/Seoul', 'Jung-gu, Incheon'),
(14, 'Kuala Lumpur International Airport', 'AIRPORT', 'MY', 'Asia/Kuala_Lumpur', 'Sepang, Selangor'),
(15, 'Cửa khẩu Bavet', 'BORDER', 'KH', 'Asia/Phnom_Penh', 'Bavet, Svay Rieng'),
(16, 'Narita Animal Quarantine Station', 'QUARANTINE_STATION', 'JP', 'Asia/Tokyo', 'Narita, Chiba'),
(17, 'Sha Tin Quarantine Stable', 'QUARANTINE_STATION', 'HK', 'Asia/Hong_Kong', 'Sha Tin, Hong Kong'),
(18, 'Điểm dừng nghỉ Bến Lức', 'REST_STOP', 'VN', 'Asia/Ho_Chi_Minh', 'QL1A, Bến Lức, Long An'),
(19, 'Trạm xăng Trảng Bom', 'FUEL_STOP', 'VN', 'Asia/Ho_Chi_Minh', 'QL1A, Trảng Bom, Đồng Nai'),
(20, 'Bukit Kayu Hitam Border', 'BORDER', 'MY', 'Asia/Kuala_Lumpur', 'Kedah, Malaysia');

-- Sheet vehicles: 20 rows, Excel rows 5 onward.
INSERT INTO `vehicles` (`id`, `vehicle_type`, `capacity_stalls`, `plate_or_code`, `is_active`) VALUES
(1, 'TRUCK', 3, '51C-107.13', 1),
(2, 'TRUCK', 4, '51C-114.16', 1),
(3, 'TRUCK', 5, '51C-121.19', 1),
(4, 'TRUCK', 6, '51C-128.22', 1),
(5, 'TRUCK', 2, '51C-135.25', 1),
(6, 'TRUCK', 3, '51C-142.28', 1),
(7, 'TRUCK', 4, '51C-149.31', 1),
(8, 'TRUCK', 5, '51C-156.34', 1),
(9, 'TRUCK', 6, '51C-163.37', 0),
(10, 'TRUCK', 2, '51C-170.40', 1),
(11, 'AIRCRAFT_HOLD', 8, 'B777F-HOLD-01', 1),
(12, 'AIRCRAFT_HOLD', 10, 'B777F-HOLD-02', 1),
(13, 'AIRCRAFT_HOLD', 12, 'B777F-HOLD-03', 1),
(14, 'AIRCRAFT_HOLD', 14, 'B777F-HOLD-04', 1),
(15, 'CRATE', 2, 'CRATE-A01', 1),
(16, 'CRATE', 1, 'CRATE-A02', 1),
(17, 'CRATE', 2, 'CRATE-A03', 1),
(18, 'CRATE', 1, 'CRATE-A04', 1),
(19, 'CRATE', 2, 'CRATE-A05', 1),
(20, 'CRATE', 1, 'CRATE-A06', 0);

-- Sheet carriers: 20 rows, Excel rows 5 onward.
INSERT INTO `carriers` (`id`, `name`, `iata_code`) VALUES
(1, 'Vietnam Airlines Cargo', 'VN'),
(2, 'Singapore Airlines Cargo', 'SQ'),
(3, 'Cathay Cargo', 'CX'),
(4, 'Japan Airlines Cargo', 'JL'),
(5, 'ANA Cargo', 'NH'),
(6, 'Qantas Freight', 'QF'),
(7, 'Korean Air Cargo', 'KE'),
(8, 'Malaysia Airlines Cargo', 'MH'),
(9, 'Emirates SkyCargo', 'EK'),
(10, 'Qatar Airways Cargo', 'QR'),
(11, 'Lufthansa Cargo', 'LH'),
(12, 'Air France KLM Cargo', 'AF'),
(13, 'Turkish Cargo', 'TK'),
(14, 'Etihad Cargo', 'EY'),
(15, 'Thai Airways Cargo', 'TG'),
(16, 'Cargolux', 'CV'),
(17, 'Atlas Air', '5Y'),
(18, 'Asiana Airlines Cargo', 'OZ'),
(19, 'Air Hong Kong', 'LD'),
(20, 'EVA Air Cargo', 'BR');

-- Sheet orders: 24 rows, Excel rows 5 onward.
INSERT INTO `orders` (`id`, `order_code`, `customer_id`, `origin_address`, `origin_country`, `destination_address`, `destination_country`, `desired_departure_date`, `special_requirements`, `status`, `manager_note`, `reviewed_by`, `reviewed_at`, `response_deadline`, `created_at`, `submitted_at`) VALUES
(1, 'ORD-2026-0001', 12, 'Trại ngựa Củ Chi, TP.HCM', 'VN', 'Singapore Turf Club, Kranji', 'SG', '2026-08-25', 'Xe có điều hòa, dừng nghỉ mỗi 4 giờ', 'DELIVERED', 'Hồ sơ hợp lệ, đồng ý vận chuyển', 2, '2026-07-28 10:42:00', '2026-07-29 10:22:00', '2026-07-25 09:07:00', '2026-07-26 10:22:00'),
(2, 'ORD-2026-0002', 13, 'Trường đua Đại Nam, Bình Dương', 'VN', 'Sha Tin Racecourse, Hong Kong', 'HK', '2026-09-05', NULL, 'DELIVERED', 'Hồ sơ hợp lệ, đồng ý vận chuyển', 3, '2026-08-07 10:49:00', '2026-08-08 10:29:00', '2026-08-04 09:14:00', '2026-08-05 10:29:00'),
(3, 'ORD-2026-0003', 15, 'Trại ngựa Long Thành, Đồng Nai', 'VN', 'Nakayama Racecourse, Chiba', 'JP', '2026-09-15', 'Cho ăn cỏ khô, không dùng yến mạch', 'DELIVERED', 'Hồ sơ hợp lệ, đồng ý vận chuyển', 2, '2026-08-16 10:56:00', '2026-08-17 10:36:00', '2026-08-13 09:21:00', '2026-08-14 10:36:00'),
(4, 'ORD-2026-0004', 16, 'Trường đua Phú Thọ, Quận 11, TP.HCM', 'VN', 'Flemington Racecourse, Melbourne', 'AU', '2026-09-28', 'Ngựa dễ stress, tránh ồn', 'DELIVERED', 'Hồ sơ hợp lệ, đồng ý vận chuyển', 3, '2026-08-28 11:03:00', '2026-08-29 10:43:00', '2026-08-25 09:28:00', '2026-08-26 10:43:00'),
(5, 'ORD-2026-0005', 17, 'Singapore Turf Club, Kranji', 'SG', 'Trại ngựa Củ Chi, TP.HCM', 'VN', '2026-10-07', NULL, 'IN_TRANSIT', 'Hồ sơ hợp lệ, đồng ý vận chuyển', 2, '2026-09-10 11:10:00', '2026-09-11 10:50:00', '2026-09-07 09:35:00', '2026-09-08 10:50:00'),
(6, 'ORD-2026-0006', 18, 'Trường đua Đại Nam, Bình Dương', 'VN', 'Seoul Racecourse, Gwacheon', 'KR', '2026-10-08', 'Cần bác sĩ thú y đi kèm', 'IN_TRANSIT', 'Hồ sơ hợp lệ, đồng ý vận chuyển', 3, '2026-09-10 11:17:00', '2026-09-11 10:57:00', '2026-09-07 09:42:00', '2026-09-08 10:57:00'),
(7, 'ORD-2026-0007', 19, 'Trại ngựa Long Thành, Đồng Nai', 'VN', 'Selangor Turf Club, Sungai Besi', 'MY', '2026-10-08', NULL, 'IN_TRANSIT', 'Hồ sơ hợp lệ, đồng ý vận chuyển', 2, '2026-09-09 11:24:00', '2026-09-10 11:04:00', '2026-09-06 09:49:00', '2026-09-07 11:04:00'),
(8, 'ORD-2026-0008', 12, 'Trường đua Phú Thọ, Quận 11, TP.HCM', 'VN', 'Singapore Turf Club, Kranji', 'SG', '2026-10-08', 'Cần chuồng riêng, có người áp tải', 'IN_TRANSIT', 'Hồ sơ hợp lệ, đồng ý vận chuyển', 3, '2026-09-08 11:31:00', '2026-09-09 11:11:00', '2026-09-05 09:56:00', '2026-09-06 11:11:00'),
(9, 'ORD-2026-0009', 13, 'Trại ngựa Củ Chi, TP.HCM', 'VN', 'Sha Tin Racecourse, Hong Kong', 'HK', '2026-10-12', 'Xe có điều hòa, dừng nghỉ mỗi 4 giờ', 'READY', 'Hồ sơ hợp lệ, đồng ý vận chuyển', 2, '2026-09-11 11:38:00', '2026-09-12 11:18:00', '2026-09-08 10:03:00', '2026-09-09 11:18:00'),
(10, 'ORD-2026-0010', 15, 'Sha Tin Racecourse, Hong Kong', 'HK', 'Trường đua Đại Nam, Bình Dương', 'VN', '2026-10-16', NULL, 'READY', 'Hồ sơ hợp lệ, đồng ý vận chuyển', 3, '2026-09-19 11:45:00', '2026-09-20 11:25:00', '2026-09-16 10:10:00', '2026-09-17 11:25:00'),
(11, 'ORD-2026-0011', 16, 'Trại ngựa Long Thành, Đồng Nai', 'VN', 'Nakayama Racecourse, Chiba', 'JP', '2026-10-20', 'Cho ăn cỏ khô, không dùng yến mạch', 'READY', 'Hồ sơ hợp lệ, đồng ý vận chuyển', 2, '2026-09-22 11:52:00', '2026-09-23 11:32:00', '2026-09-19 10:17:00', '2026-09-20 11:32:00'),
(12, 'ORD-2026-0012', 17, 'Trường đua Phú Thọ, Quận 11, TP.HCM', 'VN', 'Flemington Racecourse, Melbourne', 'AU', '2026-10-26', 'Ngựa dễ stress, tránh ồn', 'PREPARING', 'Hồ sơ hợp lệ, đồng ý vận chuyển', 3, '2026-09-27 11:59:00', '2026-09-28 11:39:00', '2026-09-24 10:24:00', '2026-09-25 11:39:00'),
(13, 'ORD-2026-0013', 18, 'Trại ngựa Củ Chi, TP.HCM', 'VN', 'Seoul Racecourse, Gwacheon', 'KR', '2026-10-30', NULL, 'PREPARING', 'Hồ sơ hợp lệ, đồng ý vận chuyển', 2, '2026-09-30 12:06:00', '2026-10-01 11:46:00', '2026-09-27 10:31:00', '2026-09-28 11:46:00'),
(14, 'ORD-2026-0014', 19, 'Trường đua Đại Nam, Bình Dương', 'VN', 'Selangor Turf Club, Sungai Besi', 'MY', '2026-11-03', 'Cần bác sĩ thú y đi kèm', 'PREPARING', 'Hồ sơ hợp lệ, đồng ý vận chuyển', 3, '2026-10-03 12:13:00', '2026-10-04 11:53:00', '2026-09-30 10:38:00', '2026-10-01 11:53:00'),
(15, 'ORD-2026-0015', 12, 'Nakayama Racecourse, Chiba', 'JP', 'Trại ngựa Long Thành, Đồng Nai', 'VN', '2026-11-06', NULL, 'PREPARING', 'Hồ sơ hợp lệ, đồng ý vận chuyển', 2, '2026-10-08 20:00:00', '2026-10-11 12:00:00', '2026-10-07 10:45:00', '2026-10-08 12:00:00'),
(16, 'ORD-2026-0016', 13, 'Trường đua Phú Thọ, Quận 11, TP.HCM', 'VN', 'Singapore Turf Club, Kranji', 'SG', '2026-11-12', 'Cần chuồng riêng, có người áp tải', 'APPROVED', 'Hồ sơ hợp lệ, đồng ý vận chuyển', 3, '2026-10-02 23:27:00', '2026-10-03 23:07:00', '2026-09-29 21:52:00', '2026-09-30 23:07:00'),
(17, 'ORD-2026-0017', 15, 'Trại ngựa Củ Chi, TP.HCM', 'VN', 'Sha Tin Racecourse, Hong Kong', 'HK', '2026-11-18', 'Xe có điều hòa, dừng nghỉ mỗi 4 giờ', 'APPROVED', 'Hồ sơ hợp lệ, đồng ý vận chuyển', 2, '2026-10-03 23:34:00', '2026-10-04 23:14:00', '2026-09-30 21:59:00', '2026-10-01 23:14:00'),
(18, 'ORD-2026-0018', 16, 'Trường đua Đại Nam, Bình Dương', 'VN', 'Nakayama Racecourse, Chiba', 'JP', '2026-11-24', NULL, 'APPROVED', 'Hồ sơ hợp lệ, đồng ý vận chuyển', 3, '2026-10-04 23:41:00', '2026-10-05 23:21:00', '2026-10-01 22:06:00', '2026-10-02 23:21:00'),
(19, 'ORD-2026-0019', 17, 'Trại ngựa Long Thành, Đồng Nai', 'VN', 'Flemington Racecourse, Melbourne', 'AU', '2026-11-30', 'Cho ăn cỏ khô, không dùng yến mạch', 'APPROVED', 'Hồ sơ hợp lệ, đồng ý vận chuyển', 2, '2026-10-05 23:48:00', '2026-10-06 23:28:00', '2026-10-02 22:13:00', '2026-10-03 23:28:00'),
(20, 'ORD-2026-0020', 18, 'Flemington Racecourse, Melbourne', 'AU', 'Trường đua Phú Thọ, Quận 11, TP.HCM', 'VN', '2026-12-05', 'Ngựa dễ stress, tránh ồn', 'PENDING', NULL, NULL, NULL, '2026-10-07 23:35:00', '2026-10-03 22:20:00', '2026-10-04 23:35:00'),
(21, 'ORD-2026-0021', 19, 'Trại ngựa Củ Chi, TP.HCM', 'VN', 'Seoul Racecourse, Gwacheon', 'KR', '2026-12-10', NULL, 'NEED_INFO', 'Vui lòng bổ sung giấy chứng nhận sức khỏe thú y mới nhất', 2, '2026-10-08 00:02:00', '2026-10-08 23:42:00', '2026-10-04 22:27:00', '2026-10-05 23:42:00'),
(22, 'ORD-2026-0022', 12, 'Trường đua Đại Nam, Bình Dương', 'VN', 'Selangor Turf Club, Sungai Besi', 'MY', '2026-11-20', 'Cần bác sĩ thú y đi kèm', 'REJECTED', 'Không đáp ứng yêu cầu kiểm dịch của nước nhận', 3, '2026-10-08 20:00:00', '2026-10-09 23:49:00', '2026-10-05 22:34:00', '2026-10-06 23:49:00'),
(23, 'ORD-2026-0023', 13, 'Trại ngựa Long Thành, Đồng Nai', 'VN', 'Singapore Turf Club, Kranji', 'SG', '2026-10-30', NULL, 'CANCELLED', 'Khách hàng yêu cầu huỷ đơn', 2, '2026-09-30 13:16:00', '2026-10-01 12:56:00', '2026-09-27 11:41:00', '2026-09-28 12:56:00'),
(24, 'ORD-2026-0024', 15, 'Trường đua Phú Thọ, Quận 11, TP.HCM', 'VN', 'Sha Tin Racecourse, Hong Kong', 'HK', '2026-12-20', 'Cần chuồng riêng, có người áp tải', 'DRAFT', NULL, NULL, NULL, NULL, '2026-10-07 22:48:00', NULL);

-- Sheet horses: 24 rows, Excel rows 5 onward.
INSERT INTO `horses` (`id`, `order_id`, `owner_id`, `name`, `passport_no`, `order_status`, `note`, `breed`, `birth_date`, `sex`, `coat_color`) VALUES
(1, 1, 12, 'Thunder Bay', 'HP-VN-2019-00101', 'NORMAL', NULL, 'Thoroughbred', '2019-02-04', 'Cái', 'Đen'),
(2, 2, 13, 'Golden Arrow', 'HP-VN-2020-00102', 'NORMAL', 'Tính tình hiền', 'Arabian', '2020-03-05', 'Đực', 'Xám'),
(3, 3, 15, 'Silver Storm', 'HP-VN-2021-00103', 'NORMAL', NULL, 'Thoroughbred', '2021-04-06', 'Ngựa thiến', 'Nâu sẫm'),
(4, 4, 16, 'Dancing Flame', 'HP-VN-2022-00104', 'NORMAL', 'Cần chuồng riêng', 'Quarter Horse', '2022-05-07', 'Đực', 'Hạt dẻ'),
(5, 5, 17, 'Royal Zephyr', 'HP-SG-2018-00105', 'NORMAL', NULL, 'Thoroughbred', '2018-06-08', 'Cái', 'Trắng'),
(6, 6, 18, 'Midnight Star', 'HP-VN-2019-00106', 'NORMAL', 'Tính tình hiền', 'Thoroughbred', '2019-07-09', 'Đực', 'Bạch kim'),
(7, 7, 19, 'Saigon Glory', 'HP-VN-2020-00107', 'FLAGGED', 'Cần kiểm tra lại giấy xét nghiệm', 'Thoroughbred', '2020-08-10', 'Ngựa thiến', 'Nâu đỏ'),
(8, 8, 12, 'Phoenix Rising', 'HP-VN-2021-00108', 'NORMAL', 'Cần chuồng riêng', 'Arabian', '2021-09-11', 'Đực', 'Đen'),
(9, 9, 13, 'Desert Wind', 'HP-VN-2022-00109', 'NORMAL', NULL, 'Thoroughbred', '2022-10-12', 'Cái', 'Xám'),
(10, 10, 15, 'Ocean Pearl', 'HP-HK-2018-00110', 'NORMAL', 'Tính tình hiền', 'Quarter Horse', '2018-11-13', 'Đực', 'Nâu sẫm'),
(11, 11, 16, 'Black Pegasus', 'HP-VN-2019-00111', 'NORMAL', NULL, 'Thoroughbred', '2019-12-14', 'Ngựa thiến', 'Hạt dẻ'),
(12, 12, 17, 'Crimson Tide', 'HP-VN-2020-00112', 'NORMAL', 'Cần chuồng riêng', 'Thoroughbred', '2020-01-15', 'Đực', 'Trắng'),
(13, 13, 18, 'Emerald Knight', 'HP-VN-2021-00113', 'FLAGGED', 'Cần kiểm tra lại giấy xét nghiệm', 'Thoroughbred', '2021-02-16', 'Cái', 'Bạch kim'),
(14, 14, 19, 'Lucky Dragon', 'HP-VN-2022-00114', 'NORMAL', 'Tính tình hiền', 'Arabian', '2022-03-17', 'Đực', 'Nâu đỏ'),
(15, 15, 12, 'Northern Light', 'HP-JP-2018-00115', 'NORMAL', NULL, 'Thoroughbred', '2018-04-18', 'Ngựa thiến', 'Đen'),
(16, 16, 13, 'Storm Chaser', 'HP-VN-2019-00116', 'NORMAL', 'Cần chuồng riêng', 'Quarter Horse', '2019-05-19', 'Đực', 'Xám'),
(17, 17, 15, 'Velvet Thunder', 'HP-VN-2020-00117', 'NORMAL', NULL, 'Thoroughbred', '2020-06-20', 'Cái', 'Nâu sẫm'),
(18, 18, 16, 'Sunset Rider', 'HP-VN-2021-00118', 'NORMAL', 'Tính tình hiền', 'Thoroughbred', '2021-07-21', 'Đực', 'Hạt dẻ'),
(19, 19, 17, 'Iron Duke', 'HP-VN-2022-00119', 'NORMAL', NULL, 'Thoroughbred', '2022-08-22', 'Ngựa thiến', 'Trắng'),
(20, 20, 18, 'Jade Prince', 'HP-AU-2018-00120', 'NORMAL', 'Cần chuồng riêng', 'Arabian', '2018-09-23', 'Đực', 'Bạch kim'),
(21, 21, 19, 'Mekong Spirit', 'HP-VN-2019-00121', 'NORMAL', NULL, 'Thoroughbred', '2019-10-24', 'Cái', 'Nâu đỏ'),
(22, 22, 12, 'Blue Lagoon', 'HP-VN-2020-00122', 'FLAGGED', 'Đơn bị từ chối, chờ khách hàng bổ sung', 'Quarter Horse', '2020-11-25', 'Đực', 'Đen'),
(23, 23, 13, 'Tiger Lily', 'HP-VN-2021-00123', 'REMOVED', 'Đơn đã huỷ', 'Thoroughbred', '2021-12-26', 'Ngựa thiến', 'Xám'),
(24, 24, 15, 'Winter Sonata', 'HP-VN-2022-00124', 'NORMAL', 'Cần chuồng riêng', 'Thoroughbred', '2022-01-27', 'Đực', 'Nâu sẫm');

-- Sheet quarantine_rules: 20 rows, Excel rows 5 onward.
INSERT INTO `quarantine_rules` (`id`, `origin_country`, `destination_country`, `border_location_id`, `authority_id`, `updated_by`, `updated_at`) VALUES
(1, 'VN', 'SG', 1, 4, 2, '2026-09-02 10:00:00'),
(2, 'VN', 'HK', 1, 9, 3, '2026-09-03 10:00:00'),
(3, 'VN', 'JP', 1, 10, 2, '2026-09-04 10:00:00'),
(4, 'VN', 'AU', 1, 13, 3, '2026-09-05 10:00:00'),
(5, 'VN', 'KR', 1, 16, 2, '2026-09-06 10:00:00'),
(6, 'VN', 'MY', 1, 18, 3, '2026-09-07 10:00:00'),
(7, 'SG', 'VN', 7, 1, 2, '2026-09-08 10:00:00'),
(8, 'HK', 'VN', 9, 1, 3, '2026-09-09 10:00:00'),
(9, 'JP', 'VN', 10, 1, 2, '2026-09-10 10:00:00'),
(10, 'AU', 'VN', 11, 1, 3, '2026-09-11 10:00:00'),
(11, 'KR', 'VN', 13, 1, 2, '2026-09-12 10:00:00'),
(12, 'MY', 'VN', 14, 1, 3, '2026-09-13 10:00:00'),
(13, 'VN', 'TH', 1, NULL, 2, '2026-09-14 10:00:00'),
(14, 'VN', 'KH', 3, NULL, 3, '2026-09-15 10:00:00'),
(15, 'VN', 'LA', 3, NULL, 2, '2026-09-16 10:00:00'),
(16, 'VN', 'ID', 1, NULL, 3, '2026-09-17 10:00:00'),
(17, 'VN', 'PH', 1, NULL, 2, '2026-09-18 10:00:00'),
(18, 'VN', 'AE', 1, NULL, 3, '2026-09-19 10:00:00'),
(19, 'VN', 'GB', 1, NULL, 2, '2026-09-20 10:00:00'),
(20, 'VN', 'FR', 1, NULL, 3, '2026-09-21 10:00:00');

-- Sheet quarantine_rule_doctypes: 20 rows, Excel rows 5 onward.
INSERT INTO `quarantine_rule_doctypes` (`rule_id`, `document_type_id`) VALUES
(1, 1),
(1, 2),
(1, 3),
(1, 5),
(2, 1),
(2, 2),
(2, 4),
(2, 6),
(3, 1),
(3, 2),
(3, 3),
(3, 8),
(4, 1),
(4, 2),
(4, 3),
(4, 10),
(5, 1),
(5, 2),
(5, 4),
(5, 14);

-- Sheet documents: 20 rows, Excel rows 5 onward.
INSERT INTO `documents` (`id`, `horse_id`, `document_type_id`, `status`, `expiry_date`, `invalid_reason`, `reviewed_by`, `reviewed_at`) VALUES
(1, 1, 1, 'VALID', NULL, NULL, 4, '2026-07-28 12:07:00'),
(2, 1, 2, 'VALID', '2027-03-25', NULL, 4, '2026-07-28 12:07:00'),
(3, 2, 1, 'VALID', NULL, NULL, 5, '2026-08-07 12:14:00'),
(4, 2, 2, 'VALID', '2027-04-04', NULL, 5, '2026-08-07 12:14:00'),
(5, 3, 1, 'VALID', NULL, NULL, 4, '2026-08-16 12:21:00'),
(6, 3, 2, 'VALID', '2027-04-14', NULL, 4, '2026-08-16 12:21:00'),
(7, 4, 1, 'VALID', NULL, NULL, 5, '2026-08-28 12:28:00'),
(8, 4, 2, 'VALID', '2027-04-24', NULL, 5, '2026-08-28 12:28:00'),
(9, 5, 1, 'VALID', NULL, NULL, 4, '2026-09-10 12:35:00'),
(10, 5, 2, 'VALID', '2027-05-04', NULL, 4, '2026-09-10 12:35:00'),
(11, 6, 1, 'VALID', NULL, NULL, 5, '2026-09-10 12:42:00'),
(12, 6, 2, 'VALID', '2027-05-14', NULL, 5, '2026-09-10 12:42:00'),
(13, 7, 1, 'VALID', NULL, NULL, 4, '2026-09-09 12:49:00'),
(14, 7, 2, 'SUBMITTED', '2027-01-20', NULL, NULL, NULL),
(15, 8, 1, 'VALID', NULL, NULL, 5, '2026-09-08 12:56:00'),
(16, 8, 2, 'INVALID', '2026-12-01', 'Ảnh chụp mờ, không đọc được ngày hết hạn', 5, '2026-09-08 12:56:00'),
(17, 9, 1, 'SUBMITTED', NULL, NULL, NULL, NULL),
(18, 9, 2, 'EXPIRED', '2026-09-30', NULL, 4, '2026-09-11 13:03:00'),
(19, 10, 1, 'NOT_SUBMITTED', NULL, NULL, NULL, NULL),
(20, 10, 2, 'NOT_SUBMITTED', NULL, NULL, NULL, NULL);

-- Sheet trips: 19 rows, Excel rows 5 onward.
INSERT INTO `trips` (`id`, `order_id`, `plan_status`, `planned_departure_at`, `planned_arrival_at`, `planned_by`, `approved_by`, `approved_at`, `return_reason`) VALUES
(1, 1, 'APPROVED', '2026-08-25 07:00:00', '2026-08-25 15:30:00', 6, 2, '2026-08-18 07:00:00', NULL),
(2, 2, 'APPROVED', '2026-09-05 08:00:00', '2026-09-05 17:30:00', 7, 3, '2026-08-29 08:00:00', NULL),
(3, 3, 'APPROVED', '2026-09-15 06:00:00', '2026-09-15 18:00:00', 6, 2, '2026-09-08 06:00:00', NULL),
(4, 4, 'APPROVED', '2026-09-28 07:00:00', '2026-09-28 21:00:00', 7, 3, '2026-09-21 07:00:00', NULL),
(5, 5, 'APPROVED', '2026-10-07 08:00:00', '2026-10-07 16:30:00', 6, 2, '2026-09-30 08:00:00', NULL),
(6, 6, 'APPROVED', '2026-10-08 06:00:00', '2026-10-08 17:00:00', 7, 3, '2026-10-01 06:00:00', NULL),
(7, 7, 'APPROVED', '2026-10-08 07:00:00', '2026-10-08 15:30:00', 6, 2, '2026-10-01 07:00:00', NULL),
(8, 8, 'APPROVED', '2026-10-08 08:00:00', '2026-10-08 16:30:00', 7, 3, '2026-10-01 08:00:00', NULL),
(9, 9, 'APPROVED', '2026-10-12 06:00:00', '2026-10-12 15:30:00', 6, 2, '2026-10-05 06:00:00', NULL),
(10, 10, 'APPROVED', '2026-10-16 07:00:00', '2026-10-16 16:30:00', 7, 3, '2026-10-07 20:00:00', NULL),
(11, 11, 'APPROVED', '2026-10-20 08:00:00', '2026-10-20 20:00:00', 6, 2, '2026-10-07 20:00:00', NULL),
(12, 12, 'APPROVED', '2026-10-26 06:00:00', '2026-10-26 20:00:00', 7, 3, '2026-10-07 20:00:00', NULL),
(13, 13, 'APPROVED', '2026-10-30 07:00:00', '2026-10-30 18:00:00', 6, 2, '2026-10-07 20:00:00', NULL),
(14, 14, 'APPROVED', '2026-11-03 08:00:00', '2026-11-03 16:30:00', 7, 3, '2026-10-07 20:00:00', NULL),
(15, 15, 'APPROVED', '2026-11-06 06:00:00', '2026-11-06 18:00:00', 6, 2, '2026-10-07 20:00:00', NULL),
(16, 16, 'DRAFT', '2026-11-12 07:00:00', '2026-11-12 15:30:00', 7, NULL, NULL, NULL),
(17, 17, 'PENDING_APPROVAL', '2026-11-18 08:00:00', '2026-11-18 17:30:00', 6, NULL, NULL, NULL),
(18, 18, 'DRAFT', '2026-11-24 06:00:00', '2026-11-24 18:00:00', 7, NULL, NULL, 'Cần đổi phương tiện vì sức chứa chưa đủ'),
(19, 19, 'PENDING_APPROVAL', '2026-11-30 07:00:00', '2026-11-30 21:00:00', 6, NULL, NULL, NULL);

-- Sheet trip_assignments: 22 rows, Excel rows 5 onward.
INSERT INTO `trip_assignments` (`id`, `trip_id`, `user_id`, `role`, `assigned_by`, `assigned_at`) VALUES
(1, 1, 8, 'DRIVER', 6, '2026-08-20 07:00:00'),
(2, 1, 10, 'ESCORT', 6, '2026-08-20 07:00:00'),
(3, 2, 9, 'DRIVER', 7, '2026-08-31 08:00:00'),
(4, 2, 11, 'ESCORT', 7, '2026-08-31 08:00:00'),
(5, 3, 8, 'DRIVER', 6, '2026-09-10 06:00:00'),
(6, 3, 10, 'ESCORT', 6, '2026-09-10 06:00:00'),
(7, 4, 9, 'DRIVER', 7, '2026-09-23 07:00:00'),
(8, 4, 11, 'ESCORT', 7, '2026-09-23 07:00:00'),
(9, 5, 8, 'DRIVER', 6, '2026-10-02 08:00:00'),
(10, 5, 10, 'ESCORT', 6, '2026-10-02 08:00:00'),
(11, 6, 9, 'DRIVER', 7, '2026-10-03 06:00:00'),
(12, 6, 11, 'ESCORT', 7, '2026-10-03 06:00:00'),
(13, 7, 8, 'DRIVER', 6, '2026-10-03 07:00:00'),
(14, 7, 10, 'ESCORT', 6, '2026-10-03 07:00:00'),
(15, 8, 9, 'DRIVER', 7, '2026-10-03 08:00:00'),
(16, 8, 11, 'ESCORT', 7, '2026-10-03 08:00:00'),
(17, 9, 8, 'DRIVER', 6, '2026-10-07 06:00:00'),
(18, 9, 10, 'ESCORT', 6, '2026-10-07 06:00:00'),
(19, 10, 9, 'DRIVER', 7, '2026-10-07 20:00:00'),
(20, 10, 11, 'ESCORT', 7, '2026-10-07 20:00:00'),
(21, 11, 8, 'DRIVER', 6, '2026-10-07 20:00:00'),
(22, 11, 10, 'ESCORT', 6, '2026-10-07 20:00:00');

-- Sheet legs: 20 rows, Excel rows 5 onward.
INSERT INTO `legs` (`id`, `trip_id`, `seq_no`, `from_location_id`, `to_location_id`, `vehicle_id`, `carrier_id`, `planned_departure_at`, `planned_arrival_at`, `status`, `actual_departure_at`, `actual_arrival_at`, `updated_by`, `updated_at`) VALUES
(1, 1, 1, 4, 1, 1, NULL, '2026-08-25 07:00:00', '2026-08-25 10:00:00', 'COMPLETED', '2026-08-25 07:22:00', '2026-08-25 10:22:00', 10, '2026-08-25 10:22:00'),
(2, 1, 2, 1, 7, 12, 2, '2026-08-25 13:00:00', '2026-08-25 15:30:00', 'COMPLETED', '2026-08-25 13:29:00', '2026-08-25 15:59:00', 10, '2026-08-25 15:59:00'),
(3, 2, 1, 4, 1, 2, NULL, '2026-09-05 08:00:00', '2026-09-05 11:00:00', 'COMPLETED', '2026-09-05 08:36:00', '2026-09-05 11:36:00', 11, '2026-09-05 11:36:00'),
(4, 2, 2, 1, 9, 13, 3, '2026-09-05 14:00:00', '2026-09-05 17:30:00', 'COMPLETED', '2026-09-05 14:18:00', '2026-09-05 17:48:00', 11, '2026-09-05 17:48:00'),
(5, 3, 1, 4, 1, 3, NULL, '2026-09-15 06:00:00', '2026-09-15 09:00:00', 'COMPLETED', '2026-09-15 06:25:00', '2026-09-15 09:25:00', 10, '2026-09-15 09:25:00'),
(6, 3, 2, 1, 10, 14, 4, '2026-09-15 12:00:00', '2026-09-15 18:00:00', 'COMPLETED', '2026-09-15 12:32:00', '2026-09-15 18:32:00', 10, '2026-09-15 18:32:00'),
(7, 4, 1, 4, 1, 4, NULL, '2026-09-28 07:00:00', '2026-09-28 10:00:00', 'COMPLETED', '2026-09-28 07:39:00', '2026-09-28 10:39:00', 11, '2026-09-28 10:39:00'),
(8, 4, 2, 1, 11, 11, 6, '2026-09-28 13:00:00', '2026-09-28 21:00:00', 'COMPLETED', '2026-09-28 13:21:00', '2026-09-28 21:21:00', 11, '2026-09-28 21:21:00'),
(9, 5, 1, 7, 1, 12, 2, '2026-10-07 08:00:00', '2026-10-07 11:00:00', 'COMPLETED', '2026-10-07 08:28:00', '2026-10-07 11:28:00', 10, '2026-10-07 11:28:00'),
(10, 5, 2, 1, 4, 5, NULL, '2026-10-07 14:00:00', '2026-10-07 16:30:00', 'MOVING', '2026-10-07 14:35:00', NULL, 10, '2026-10-07 14:35:00'),
(11, 6, 1, 4, 1, 6, NULL, '2026-10-08 06:00:00', '2026-10-08 09:00:00', 'COMPLETED', '2026-10-08 06:17:00', '2026-10-08 09:17:00', 11, '2026-10-08 09:17:00'),
(12, 6, 2, 1, 13, 13, 7, '2026-10-08 12:00:00', '2026-10-08 17:00:00', 'MOVING', '2026-10-08 12:24:00', NULL, 11, '2026-10-08 12:24:00'),
(13, 7, 1, 4, 1, 7, NULL, '2026-10-08 07:00:00', '2026-10-08 10:00:00', 'COMPLETED', '2026-10-08 07:31:00', '2026-10-08 10:31:00', 10, '2026-10-08 10:31:00'),
(14, 7, 2, 1, 14, 14, 8, '2026-10-08 13:00:00', '2026-10-08 15:30:00', 'AT_STOP', '2026-10-08 13:38:00', NULL, 10, '2026-10-08 13:38:00'),
(15, 8, 1, 4, 1, 8, NULL, '2026-10-08 08:00:00', '2026-10-08 11:00:00', 'COMPLETED', '2026-10-08 08:20:00', '2026-10-08 11:20:00', 11, '2026-10-08 11:20:00'),
(16, 8, 2, 1, 7, 11, 2, '2026-10-08 14:00:00', '2026-10-08 16:30:00', 'MOVING', '2026-10-08 14:27:00', NULL, 11, '2026-10-08 14:27:00'),
(17, 9, 1, 4, 1, 9, NULL, '2026-10-12 06:00:00', '2026-10-12 09:00:00', 'NOT_STARTED', NULL, NULL, NULL, NULL),
(18, 9, 2, 1, 9, 12, 3, '2026-10-12 12:00:00', '2026-10-12 15:30:00', 'NOT_STARTED', NULL, NULL, NULL, NULL),
(19, 10, 1, 9, 1, 13, 3, '2026-10-16 07:00:00', '2026-10-16 10:00:00', 'NOT_STARTED', NULL, NULL, NULL, NULL),
(20, 10, 2, 1, 4, 10, NULL, '2026-10-16 13:00:00', '2026-10-16 16:30:00', 'NOT_STARTED', NULL, NULL, NULL, NULL);

-- Sheet leg_milestones: 28 rows, Excel rows 5 onward.
INSERT INTO `leg_milestones` (`id`, `leg_id`, `milestone_type`, `occurred_at`, `recorded_by`) VALUES
(1, 1, 'DEPARTED', '2026-08-25 07:22:00', 10),
(2, 1, 'ARRIVED_AT_STOP', '2026-08-25 10:22:00', 10),
(3, 2, 'DEPARTED', '2026-08-25 13:29:00', 10),
(4, 2, 'DELIVERED', '2026-08-25 15:59:00', 10),
(5, 3, 'DEPARTED', '2026-09-05 08:36:00', 11),
(6, 3, 'ARRIVED_AT_STOP', '2026-09-05 11:36:00', 11),
(7, 4, 'DEPARTED', '2026-09-05 14:18:00', 11),
(8, 4, 'DELIVERED', '2026-09-05 17:48:00', 11),
(9, 5, 'DEPARTED', '2026-09-15 06:25:00', 10),
(10, 5, 'ARRIVED_AT_STOP', '2026-09-15 09:25:00', 10),
(11, 6, 'DEPARTED', '2026-09-15 12:32:00', 10),
(12, 6, 'DELIVERED', '2026-09-15 18:32:00', 10),
(13, 7, 'DEPARTED', '2026-09-28 07:39:00', 11),
(14, 7, 'ARRIVED_AT_STOP', '2026-09-28 10:39:00', 11),
(15, 8, 'DEPARTED', '2026-09-28 13:21:00', 11),
(16, 8, 'DELIVERED', '2026-09-28 21:21:00', 11),
(17, 9, 'DEPARTED', '2026-10-07 08:28:00', 10),
(18, 9, 'ARRIVED_AT_STOP', '2026-10-07 11:28:00', 10),
(19, 10, 'DEPARTED', '2026-10-07 14:35:00', 10),
(20, 11, 'DEPARTED', '2026-10-08 06:17:00', 11),
(21, 11, 'ARRIVED_AT_STOP', '2026-10-08 09:17:00', 11),
(22, 12, 'DEPARTED', '2026-10-08 12:24:00', 11),
(23, 13, 'DEPARTED', '2026-10-08 07:31:00', 10),
(24, 13, 'ARRIVED_AT_STOP', '2026-10-08 10:31:00', 10),
(25, 14, 'DEPARTED', '2026-10-08 13:38:00', 10),
(26, 15, 'DEPARTED', '2026-10-08 08:20:00', 11),
(27, 15, 'ARRIVED_AT_STOP', '2026-10-08 11:20:00', 11),
(28, 16, 'DEPARTED', '2026-10-08 14:27:00', 11);

-- Sheet horse_logs: 20 rows, Excel rows 5 onward.
INSERT INTO `horse_logs` (`id`, `horse_id`, `leg_id`, `condition_status`, `note`, `logged_at`, `created_by`, `corrects_log_id`) VALUES
(1, 1, 1, 'STABLE', 'Ngựa ăn uống bình thường, thể trạng ổn định', '2026-08-25 08:07:00', 10, NULL),
(2, 1, 2, 'STABLE', 'Ngựa ăn uống bình thường, thể trạng ổn định', '2026-08-25 14:14:00', 10, NULL),
(3, 2, 3, 'OFF_FEED', 'Ngựa bỏ ăn một phần, đã bổ sung nước điện giải', '2026-09-05 09:21:00', 11, NULL),
(4, 2, 4, 'STABLE', 'Ngựa ăn uống bình thường, thể trạng ổn định', '2026-09-05 15:03:00', 11, NULL),
(5, 3, 5, 'STRESSED', 'Ngựa bồn chồn, đã giảm tốc độ và cho nghỉ', '2026-09-15 07:10:00', 10, NULL),
(6, 3, 6, 'STABLE', 'Ngựa ăn uống bình thường, thể trạng ổn định', '2026-09-15 13:17:00', 10, NULL),
(7, 4, 7, 'CLIMATE_CHANGE', 'Thay đổi khí hậu, ngựa ra mồ hôi nhiều', '2026-09-28 08:24:00', 11, NULL),
(8, 4, 8, 'STABLE', 'Ngựa ăn uống bình thường, thể trạng ổn định', '2026-09-28 14:06:00', 11, NULL),
(9, 5, 9, 'STABLE', 'Ngựa ăn uống bình thường, thể trạng ổn định', '2026-10-07 09:13:00', 10, NULL),
(10, 5, 10, 'STABLE', 'Ngựa ăn uống bình thường, thể trạng ổn định', '2026-10-07 15:20:00', 10, NULL),
(11, 6, 11, 'OFF_FEED', 'Ngựa bỏ ăn một phần, đã bổ sung nước điện giải', '2026-10-08 07:02:00', 11, NULL),
(12, 6, 12, 'STABLE', 'Ngựa ăn uống bình thường, thể trạng ổn định', '2026-10-08 13:09:00', 11, NULL),
(13, 7, 13, 'STRESSED', 'Ngựa bồn chồn, đã giảm tốc độ và cho nghỉ', '2026-10-08 08:16:00', 10, NULL),
(14, 7, 14, 'STABLE', 'Ngựa ăn uống bình thường, thể trạng ổn định', '2026-10-08 14:23:00', 10, NULL),
(15, 8, 15, 'CLIMATE_CHANGE', 'Thay đổi khí hậu, ngựa ra mồ hôi nhiều', '2026-10-08 09:05:00', 11, NULL),
(16, 8, 16, 'STABLE', 'Ngựa ăn uống bình thường, thể trạng ổn định', '2026-10-08 15:12:00', 11, NULL),
(17, 5, 10, 'STABLE', 'Đính chính: Ngựa ăn uống bình thường, thể trạng ổn định', '2026-10-07 16:35:00', 10, 10),
(18, 6, 12, 'CLIMATE_CHANGE', 'Thay đổi khí hậu, ngựa ra mồ hôi nhiều', '2026-10-08 14:24:00', 11, NULL),
(19, 7, 14, 'OFF_FEED', 'Ngựa bỏ ăn một phần, đã bổ sung nước điện giải', '2026-10-08 15:38:00', 10, NULL),
(20, 8, 16, 'STRESSED', 'Ngựa bồn chồn, đã giảm tốc độ và cho nghỉ', '2026-10-08 16:27:00', 11, NULL);

-- Sheet incidents: 20 rows, Excel rows 5 onward.
INSERT INTO `incidents` (`id`, `trip_id`, `leg_id`, `horse_id`, `incident_type`, `description`, `urgency`, `status`, `reported_by`, `reported_at`, `received_by`, `handling_note`, `closed_at`) VALUES
(1, 1, 1, NULL, 'VEHICLE_BREAKDOWN', 'Xe gặp sự cố kỹ thuật, dừng bên đường chờ hỗ trợ', 'HIGH', 'CLOSED', 8, '2026-08-25 07:52:00', 6, 'Đã liên hệ hỗ trợ và điều chỉnh lịch trình', '2026-08-25 09:52:00'),
(2, 2, 3, NULL, 'LONG_TRAFFIC_JAM', 'Kẹt xe kéo dài khoảng 45 phút trên quốc lộ', 'NORMAL', 'CLOSED', 9, '2026-09-05 09:09:00', 7, 'Đã liên hệ hỗ trợ và điều chỉnh lịch trình', '2026-09-05 11:09:00'),
(3, 3, 5, 3, 'HORSE_MEDICAL', 'Ngựa có dấu hiệu đau bụng nhẹ, cần bác sĩ thú y kiểm tra', 'HIGH', 'CLOSED', 8, '2026-09-15 07:01:00', 6, 'Đã liên hệ hỗ trợ và điều chỉnh lịch trình', '2026-09-15 09:01:00'),
(4, 4, 7, NULL, 'LONG_TRAFFIC_JAM', 'Kẹt xe kéo dài khoảng 45 phút trên quốc lộ', 'NORMAL', 'CLOSED', 9, '2026-09-28 08:18:00', 7, 'Đã liên hệ hỗ trợ và điều chỉnh lịch trình', '2026-09-28 10:18:00'),
(5, 5, 9, NULL, 'VEHICLE_BREAKDOWN', 'Xe gặp sự cố kỹ thuật, dừng bên đường chờ hỗ trợ', 'HIGH', 'ACKNOWLEDGED', 8, '2026-10-07 09:10:00', 6, 'Đã liên hệ hỗ trợ và điều chỉnh lịch trình', NULL),
(6, 6, 11, NULL, 'VEHICLE_BREAKDOWN', 'Xe gặp sự cố kỹ thuật, dừng bên đường chờ hỗ trợ', 'HIGH', 'CLOSED', 9, '2026-10-08 07:02:00', 7, 'Đã liên hệ hỗ trợ và điều chỉnh lịch trình', '2026-10-08 09:02:00'),
(7, 7, 13, NULL, 'LONG_TRAFFIC_JAM', 'Kẹt xe kéo dài khoảng 45 phút trên quốc lộ', 'NORMAL', 'NEW', 8, '2026-10-08 08:19:00', NULL, NULL, NULL),
(8, 8, 15, 8, 'HORSE_MEDICAL', 'Ngựa có dấu hiệu đau bụng nhẹ, cần bác sĩ thú y kiểm tra', 'HIGH', 'ACKNOWLEDGED', 9, '2026-10-08 09:11:00', 7, 'Đã liên hệ hỗ trợ và điều chỉnh lịch trình', NULL),
(9, 1, 2, NULL, 'LONG_TRAFFIC_JAM', 'Kẹt xe kéo dài khoảng 45 phút trên quốc lộ', 'NORMAL', 'CLOSED', 8, '2026-08-25 14:23:00', 6, 'Đã liên hệ hỗ trợ và điều chỉnh lịch trình', '2026-08-25 16:23:00'),
(10, 2, 4, NULL, 'VEHICLE_BREAKDOWN', 'Xe gặp sự cố kỹ thuật, dừng bên đường chờ hỗ trợ', 'HIGH', 'CLOSED', 9, '2026-09-05 15:15:00', 7, 'Đã liên hệ hỗ trợ và điều chỉnh lịch trình', '2026-09-05 17:15:00'),
(11, 3, 6, NULL, 'VEHICLE_BREAKDOWN', 'Xe gặp sự cố kỹ thuật, dừng bên đường chờ hỗ trợ', 'HIGH', 'CLOSED', 8, '2026-09-15 13:32:00', 6, 'Đã liên hệ hỗ trợ và điều chỉnh lịch trình', '2026-09-15 15:32:00'),
(12, 4, 8, NULL, 'LONG_TRAFFIC_JAM', 'Kẹt xe kéo dài khoảng 45 phút trên quốc lộ', 'NORMAL', 'CLOSED', 9, '2026-09-28 14:24:00', 7, 'Đã liên hệ hỗ trợ và điều chỉnh lịch trình', '2026-09-28 16:24:00'),
(13, 5, 10, 5, 'HORSE_MEDICAL', 'Ngựa có dấu hiệu đau bụng nhẹ, cần bác sĩ thú y kiểm tra', 'HIGH', 'NEW', 8, '2026-10-07 15:41:00', NULL, NULL, NULL),
(14, 6, 12, NULL, 'LONG_TRAFFIC_JAM', 'Kẹt xe kéo dài khoảng 45 phút trên quốc lộ', 'NORMAL', 'ACKNOWLEDGED', 9, '2026-10-08 13:33:00', 7, 'Đã liên hệ hỗ trợ và điều chỉnh lịch trình', NULL),
(15, 7, 14, NULL, 'VEHICLE_BREAKDOWN', 'Xe gặp sự cố kỹ thuật, dừng bên đường chờ hỗ trợ', 'HIGH', 'CLOSED', 8, '2026-10-08 14:50:00', 6, 'Đã liên hệ hỗ trợ và điều chỉnh lịch trình', '2026-10-08 16:50:00'),
(16, 8, 16, NULL, 'VEHICLE_BREAKDOWN', 'Xe gặp sự cố kỹ thuật, dừng bên đường chờ hỗ trợ', 'HIGH', 'NEW', 9, '2026-10-08 15:42:00', NULL, NULL, NULL),
(17, 1, 1, NULL, 'LONG_TRAFFIC_JAM', 'Kẹt xe kéo dài khoảng 45 phút trên quốc lộ', 'NORMAL', 'CLOSED', 8, '2026-08-25 08:40:00', 6, 'Đã liên hệ hỗ trợ và điều chỉnh lịch trình', '2026-08-25 10:40:00'),
(18, 2, 3, 2, 'HORSE_MEDICAL', 'Ngựa có dấu hiệu đau bụng nhẹ, cần bác sĩ thú y kiểm tra', 'HIGH', 'CLOSED', 9, '2026-09-05 09:57:00', 7, 'Đã liên hệ hỗ trợ và điều chỉnh lịch trình', '2026-09-05 11:57:00'),
(19, 3, 5, NULL, 'LONG_TRAFFIC_JAM', 'Kẹt xe kéo dài khoảng 45 phút trên quốc lộ', 'NORMAL', 'CLOSED', 8, '2026-09-15 07:49:00', 6, 'Đã liên hệ hỗ trợ và điều chỉnh lịch trình', '2026-09-15 09:49:00'),
(20, 4, 7, NULL, 'VEHICLE_BREAKDOWN', 'Xe gặp sự cố kỹ thuật, dừng bên đường chờ hỗ trợ', 'HIGH', 'CLOSED', 9, '2026-09-28 09:06:00', 7, 'Đã liên hệ hỗ trợ và điều chỉnh lịch trình', '2026-09-28 11:06:00');

-- Sheet alerts: 20 rows, Excel rows 5 onward.
INSERT INTO `alerts` (`id`, `trip_id`, `alert_type`, `content`, `sent_by`, `sent_at`) VALUES
(1, 1, 'TRAFFIC', 'Ùn tắc trên tuyến dự kiến, cân nhắc đi đường vòng', 6, '2026-08-25 05:00:00'),
(2, 2, 'WEATHER', 'Dự báo mưa lớn trên tuyến, giảm tốc độ', 7, '2026-09-05 06:00:00'),
(3, 3, 'BORDER', 'Cửa khẩu/sân bay tăng cường kiểm tra, chuẩn bị đủ giấy tờ', 6, '2026-09-15 04:00:00'),
(4, 4, 'TRAFFIC', 'Ùn tắc trên tuyến dự kiến, cân nhắc đi đường vòng', 7, '2026-09-28 05:00:00'),
(5, 5, 'WEATHER', 'Dự báo mưa lớn trên tuyến, giảm tốc độ', 6, '2026-10-07 06:00:00'),
(6, 6, 'BORDER', 'Cửa khẩu/sân bay tăng cường kiểm tra, chuẩn bị đủ giấy tờ', 7, '2026-10-08 04:00:00'),
(7, 7, 'TRAFFIC', 'Ùn tắc trên tuyến dự kiến, cân nhắc đi đường vòng', 6, '2026-10-08 05:00:00'),
(8, 8, 'WEATHER', 'Dự báo mưa lớn trên tuyến, giảm tốc độ', 7, '2026-10-08 06:00:00'),
(9, 9, 'BORDER', 'Cửa khẩu/sân bay tăng cường kiểm tra, chuẩn bị đủ giấy tờ', 6, '2026-10-08 11:00:00'),
(10, 10, 'TRAFFIC', 'Ùn tắc trên tuyến dự kiến, cân nhắc đi đường vòng', 7, '2026-10-08 10:00:00'),
(11, 11, 'WEATHER', 'Dự báo mưa lớn trên tuyến, giảm tốc độ', 6, '2026-10-08 09:00:00'),
(12, 1, 'BORDER', 'Cửa khẩu/sân bay tăng cường kiểm tra, chuẩn bị đủ giấy tờ', 6, '2026-08-25 05:00:00'),
(13, 2, 'TRAFFIC', 'Ùn tắc trên tuyến dự kiến, cân nhắc đi đường vòng', 7, '2026-09-05 06:00:00'),
(14, 3, 'WEATHER', 'Dự báo mưa lớn trên tuyến, giảm tốc độ', 6, '2026-09-15 04:00:00'),
(15, 4, 'BORDER', 'Cửa khẩu/sân bay tăng cường kiểm tra, chuẩn bị đủ giấy tờ', 7, '2026-09-28 05:00:00'),
(16, 5, 'TRAFFIC', 'Ùn tắc trên tuyến dự kiến, cân nhắc đi đường vòng', 6, '2026-10-07 06:00:00'),
(17, 6, 'WEATHER', 'Dự báo mưa lớn trên tuyến, giảm tốc độ', 7, '2026-10-08 03:00:00'),
(18, 7, 'BORDER', 'Cửa khẩu/sân bay tăng cường kiểm tra, chuẩn bị đủ giấy tờ', 6, '2026-10-08 02:00:00'),
(19, 8, 'TRAFFIC', 'Ùn tắc trên tuyến dự kiến, cân nhắc đi đường vòng', 7, '2026-10-08 01:00:00'),
(20, 9, 'WEATHER', 'Dự báo mưa lớn trên tuyến, giảm tốc độ', 6, '2026-10-08 00:00:00');

-- Sheet attachments: 24 rows, Excel rows 5 onward.
INSERT INTO `attachments` (`id`, `original_name`, `file_type`, `size_bytes`, `storage_path`, `uploaded_by`, `uploaded_at`, `horse_log_id`, `incident_id`) VALUES
(1, 'ho-chieu-ngua-thunder-bay-v1.pdf', 'PDF', 1480704, 'uploads/2026/07/ho-chieu-ngua-thunder-bay-v1.pdf', 12, '2026-07-27 09:07:00', NULL, NULL),
(2, 'giay-suc-khoe-thunder-bay-v1.jpg', 'JPG', 754688, 'uploads/2026/07/giay-suc-khoe-thunder-bay-v1.jpg', 12, '2026-07-27 09:07:00', NULL, NULL),
(3, 'ho-chieu-ngua-golden-arrow-v1.pdf', 'PDF', 1778688, 'uploads/2026/08/ho-chieu-ngua-golden-arrow-v1.pdf', 13, '2026-08-06 09:14:00', NULL, NULL),
(4, 'giay-suc-khoe-golden-arrow-v1.png', 'PNG', 324608, 'uploads/2026/08/giay-suc-khoe-golden-arrow-v1.png', 13, '2026-08-06 09:14:00', NULL, NULL),
(5, 'ho-chieu-ngua-silver-storm-v1.pdf', 'PDF', 425984, 'uploads/2026/08/ho-chieu-ngua-silver-storm-v1.pdf', 15, '2026-08-15 09:21:00', NULL, NULL),
(6, 'giay-suc-khoe-silver-storm-v1.pdf', 'PDF', 2369536, 'uploads/2026/08/giay-suc-khoe-silver-storm-v1.pdf', 15, '2026-08-15 09:21:00', NULL, NULL),
(7, 'ho-chieu-ngua-dancing-flame-v1.jpg', 'JPG', 517120, 'uploads/2026/08/ho-chieu-ngua-dancing-flame-v1.jpg', 16, '2026-08-27 09:28:00', NULL, NULL),
(8, 'giay-suc-khoe-dancing-flame-v1.pdf', 'PDF', 1655808, 'uploads/2026/08/giay-suc-khoe-dancing-flame-v1.pdf', 16, '2026-08-27 09:28:00', NULL, NULL),
(9, 'ho-chieu-ngua-royal-zephyr-v1.png', 'PNG', 365568, 'uploads/2026/09/ho-chieu-ngua-royal-zephyr-v1.png', 17, '2026-09-09 09:35:00', NULL, NULL),
(10, 'giay-suc-khoe-royal-zephyr-v1.pdf', 'PDF', 2250752, 'uploads/2026/09/giay-suc-khoe-royal-zephyr-v1.pdf', 17, '2026-09-09 09:35:00', NULL, NULL),
(11, 'ho-chieu-ngua-midnight-star-v1.pdf', 'PDF', 1022976, 'uploads/2026/09/ho-chieu-ngua-midnight-star-v1.pdf', 18, '2026-09-09 09:42:00', NULL, NULL),
(12, 'giay-suc-khoe-midnight-star-v1.jpg', 'JPG', 279552, 'uploads/2026/09/giay-suc-khoe-midnight-star-v1.jpg', 18, '2026-09-09 09:42:00', NULL, NULL),
(13, 'ho-chieu-ngua-saigon-glory-v1.pdf', 'PDF', 483328, 'uploads/2026/09/ho-chieu-ngua-saigon-glory-v1.pdf', 19, '2026-09-08 09:49:00', NULL, NULL),
(14, 'giay-suc-khoe-saigon-glory-v1.png', 'PNG', 1941504, 'uploads/2026/09/giay-suc-khoe-saigon-glory-v1.png', 19, '2026-09-08 09:49:00', NULL, NULL),
(15, 'ho-chieu-ngua-phoenix-rising-v1.pdf', 'PDF', 1875968, 'uploads/2026/09/ho-chieu-ngua-phoenix-rising-v1.pdf', 12, '2026-09-07 09:56:00', NULL, NULL),
(16, 'giay-suc-khoe-phoenix-rising-v1.pdf', 'PDF', 415744, 'uploads/2026/09/giay-suc-khoe-phoenix-rising-v1.pdf', 12, '2026-09-07 09:56:00', NULL, NULL),
(17, 'ho-chieu-ngua-desert-wind-v1.jpg', 'JPG', 1131520, 'uploads/2026/09/ho-chieu-ngua-desert-wind-v1.jpg', 13, '2026-09-10 10:03:00', NULL, NULL),
(18, 'giay-suc-khoe-desert-wind-v1.pdf', 'PDF', 502784, 'uploads/2026/09/giay-suc-khoe-desert-wind-v1.pdf', 13, '2026-09-10 10:03:00', NULL, NULL),
(19, 'giay-suc-khoe-thunder-bay-v2.png', 'PNG', 2434048, 'uploads/2026/08/giay-suc-khoe-thunder-bay-v2.png', 12, '2026-08-03 09:07:00', NULL, NULL),
(20, 'giay-suc-khoe-golden-arrow-v2.pdf', 'PDF', 1902592, 'uploads/2026/08/giay-suc-khoe-golden-arrow-v2.pdf', 13, '2026-08-13 09:14:00', NULL, NULL),
(21, 'giay-phep-thunder-bay.pdf', 'PDF', 163840, 'uploads/2026/07/giay-phep-thunder-bay.pdf', 4, '2026-07-31 10:07:00', NULL, NULL),
(22, 'giay-phep-thunder-bay.pdf', 'PDF', 695296, 'uploads/2026/07/giay-phep-thunder-bay.pdf', 5, '2026-07-31 11:07:00', NULL, NULL),
(23, 'giay-phep-silver-storm.pdf', 'PDF', 231424, 'uploads/2026/08/giay-phep-silver-storm.pdf', 4, '2026-08-19 14:21:00', NULL, NULL),
(24, 'giay-phep-royal-zephyr.pdf', 'PDF', 335872, 'uploads/2026/09/giay-phep-royal-zephyr.pdf', 4, '2026-09-13 18:35:00', NULL, NULL);

-- Sheet document_versions: 20 rows, Excel rows 5 onward.
INSERT INTO `document_versions` (`id`, `document_id`, `version_no`, `attachment_id`, `uploaded_by`, `uploaded_at`) VALUES
(1, 1, 1, 1, 12, '2026-07-27 09:07:00'),
(2, 2, 1, 2, 12, '2026-07-27 09:07:00'),
(3, 3, 1, 3, 13, '2026-08-06 09:14:00'),
(4, 4, 1, 4, 13, '2026-08-06 09:14:00'),
(5, 5, 1, 5, 15, '2026-08-15 09:21:00'),
(6, 6, 1, 6, 15, '2026-08-15 09:21:00'),
(7, 7, 1, 7, 16, '2026-08-27 09:28:00'),
(8, 8, 1, 8, 16, '2026-08-27 09:28:00'),
(9, 9, 1, 9, 17, '2026-09-09 09:35:00'),
(10, 10, 1, 10, 17, '2026-09-09 09:35:00'),
(11, 11, 1, 11, 18, '2026-09-09 09:42:00'),
(12, 12, 1, 12, 18, '2026-09-09 09:42:00'),
(13, 13, 1, 13, 19, '2026-09-08 09:49:00'),
(14, 14, 1, 14, 19, '2026-09-08 09:49:00'),
(15, 15, 1, 15, 12, '2026-09-07 09:56:00'),
(16, 16, 1, 16, 12, '2026-09-07 09:56:00'),
(17, 17, 1, 17, 13, '2026-09-10 10:03:00'),
(18, 18, 1, 18, 13, '2026-09-10 10:03:00'),
(19, 2, 2, 19, 12, '2026-08-03 09:07:00'),
(20, 4, 2, 20, 13, '2026-08-13 09:14:00');

-- Sheet dossiers: 20 rows, Excel rows 5 onward.
INSERT INTO `dossiers` (`id`, `horse_id`, `authority_id`, `status`, `submitted_at`, `receipt_code`, `result_at`, `result`, `rejection_reason`, `permit_attachment_id`, `specialist_id`) VALUES
(1, 1, 4, 'APPROVED', '2026-07-28 10:07:00', 'RC-2026-000001', '2026-07-31 10:07:00', 'Đạt - đã cấp giấy phép', NULL, 21, 4),
(2, 1, 5, 'APPROVED', '2026-07-28 11:07:00', 'RC-2026-000002', '2026-07-31 11:07:00', 'Đạt - đã cấp giấy phép', NULL, 22, 5),
(3, 2, 9, 'SUBMITTED', '2026-08-07 12:14:00', 'RC-2026-000003', NULL, NULL, NULL, NULL, 4),
(4, 2, 8, 'REVIEWING', '2026-08-07 13:14:00', 'RC-2026-000004', NULL, NULL, NULL, NULL, 5),
(5, 3, 10, 'APPROVED', '2026-08-16 14:21:00', 'RC-2026-000005', '2026-08-19 14:21:00', 'Đạt - đã cấp giấy phép', NULL, 23, 4),
(6, 3, 11, 'NEED_INFO', '2026-08-16 15:21:00', 'RC-2026-000006', NULL, 'Yêu cầu bổ sung hồ sơ', NULL, NULL, 5),
(7, 4, 13, 'REJECTED', '2026-08-28 16:28:00', 'RC-2026-000007', '2026-08-31 16:28:00', 'Không đạt', 'Thiếu kết quả xét nghiệm EIA hợp lệ', NULL, 4),
(8, 4, 14, 'SUBMITTED', '2026-08-28 17:28:00', 'RC-2026-000008', NULL, NULL, NULL, NULL, 5),
(9, 5, 1, 'APPROVED', '2026-09-10 18:35:00', 'RC-2026-000009', '2026-09-13 18:35:00', 'Đạt - đã cấp giấy phép', NULL, 24, 4),
(10, 5, 2, 'NOT_SUBMITTED', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(11, 6, 16, 'REVIEWING', '2026-09-10 20:42:00', 'RC-2026-000011', NULL, NULL, NULL, NULL, 4),
(12, 6, 17, 'SUBMITTED', '2026-09-10 21:42:00', 'RC-2026-000012', NULL, NULL, NULL, NULL, 5),
(13, 7, 18, 'NOT_SUBMITTED', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(14, 7, 19, 'NEED_INFO', '2026-09-09 23:49:00', 'RC-2026-000014', NULL, 'Yêu cầu bổ sung hồ sơ', NULL, NULL, 5),
(15, 8, 4, 'SUBMITTED', '2026-09-09 00:56:00', 'RC-2026-000015', NULL, NULL, NULL, NULL, 4),
(16, 8, 5, 'REVIEWING', '2026-09-09 01:56:00', 'RC-2026-000016', NULL, NULL, NULL, NULL, 5),
(17, 9, 9, 'NOT_SUBMITTED', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(18, 9, 8, 'SUBMITTED', '2026-09-12 04:03:00', 'RC-2026-000018', NULL, NULL, NULL, NULL, 5),
(19, 10, 1, 'NOT_SUBMITTED', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(20, 10, 2, 'REVIEWING', '2026-09-20 06:10:00', 'RC-2026-000020', NULL, NULL, NULL, NULL, 5);

-- Sheet notifications: 20 rows, Excel rows 5 onward.
INSERT INTO `notifications` (`id`, `recipient_id`, `event_type`, `content`, `related_type`, `related_id`, `channel`, `is_read`, `created_at`) VALUES
(1, 12, 'ORDER_APPROVED', 'Đơn ORD-2026-0001 đã được duyệt', 'ORDER', 1, 'EMAIL', 1, '2026-07-28 10:43:00'),
(2, 13, 'ORDER_APPROVED', 'Đơn ORD-2026-0002 đã được duyệt', 'ORDER', 2, 'SMS', 1, '2026-08-07 10:50:00'),
(3, 15, 'ORDER_APPROVED', 'Đơn ORD-2026-0003 đã được duyệt', 'ORDER', 3, 'IN_APP', 1, '2026-08-16 10:57:00'),
(4, 16, 'ORDER_APPROVED', 'Đơn ORD-2026-0004 đã được duyệt', 'ORDER', 4, 'EMAIL', 1, '2026-08-28 11:04:00'),
(5, 17, 'ORDER_APPROVED', 'Đơn ORD-2026-0005 đã được duyệt', 'ORDER', 5, 'SMS', 1, '2026-09-10 11:11:00'),
(6, 18, 'ORDER_APPROVED', 'Đơn ORD-2026-0006 đã được duyệt', 'ORDER', 6, 'IN_APP', 1, '2026-09-10 11:18:00'),
(7, 19, 'ORDER_APPROVED', 'Đơn ORD-2026-0007 đã được duyệt', 'ORDER', 7, 'EMAIL', 1, '2026-09-09 11:25:00'),
(8, 12, 'ORDER_APPROVED', 'Đơn ORD-2026-0008 đã được duyệt', 'ORDER', 8, 'SMS', 1, '2026-09-08 11:32:00'),
(9, 19, 'ORDER_NEED_INFO', 'Đơn ORD-2026-0021 cần bổ sung thông tin', 'ORDER', 21, 'IN_APP', 0, '2026-10-08 00:03:00'),
(10, 12, 'ORDER_REJECTED', 'Đơn ORD-2026-0022 bị từ chối', 'ORDER', 22, 'EMAIL', 0, '2026-10-08 20:01:00'),
(11, 12, 'DOCUMENT_INVALID', 'Giấy tờ của ngựa Phoenix Rising không hợp lệ', 'DOCUMENT', 16, 'SMS', 1, '2026-09-08 12:57:00'),
(12, 12, 'DOSSIER_APPROVED', 'Hồ sơ #1 đã được cơ quan chấp thuận', 'DOSSIER', 1, 'IN_APP', 1, '2026-07-31 10:08:00'),
(13, 12, 'DOSSIER_APPROVED', 'Hồ sơ #2 đã được cơ quan chấp thuận', 'DOSSIER', 2, 'EMAIL', 1, '2026-07-31 11:08:00'),
(14, 17, 'TRIP_DEPARTED', 'Chuyến của đơn ORD-2026-0005 đã khởi hành', 'TRIP', 5, 'SMS', 0, '2026-10-07 08:28:00'),
(15, 18, 'TRIP_DEPARTED', 'Chuyến của đơn ORD-2026-0006 đã khởi hành', 'TRIP', 6, 'IN_APP', 0, '2026-10-08 06:17:00'),
(16, 19, 'TRIP_DEPARTED', 'Chuyến của đơn ORD-2026-0007 đã khởi hành', 'TRIP', 7, 'EMAIL', 0, '2026-10-08 07:31:00'),
(17, 12, 'TRIP_DEPARTED', 'Chuyến của đơn ORD-2026-0008 đã khởi hành', 'TRIP', 8, 'SMS', 0, '2026-10-08 08:20:00'),
(18, 2, 'INCIDENT_REPORTED', 'Có sự cố mới trên chuyến #1', 'INCIDENT', 1, 'IN_APP', 1, '2026-08-25 07:52:00'),
(19, 2, 'INCIDENT_REPORTED', 'Có sự cố mới trên chuyến #2', 'INCIDENT', 2, 'EMAIL', 1, '2026-09-05 09:09:00'),
(20, 8, 'ALERT', 'Cảnh báo mới cho chuyến của bạn', 'ALERT', 1, 'SMS', 1, '2026-08-25 05:01:00');

-- Sheet audit_logs: 20 rows, Excel rows 5 onward.
INSERT INTO `audit_logs` (`id`, `actor_id`, `occurred_at`, `entity_type`, `entity_id`, `action`, `old_value`, `new_value`, `reason`) VALUES
(1, 2, '2026-07-28 10:42:00', 'ORDER', 1, 'STATUS_CHANGE', 'PENDING', 'APPROVED', 'Hồ sơ đầy đủ'),
(2, 3, '2026-08-07 10:49:00', 'ORDER', 2, 'STATUS_CHANGE', 'PENDING', 'APPROVED', 'Hồ sơ đầy đủ'),
(3, 2, '2026-08-16 10:56:00', 'ORDER', 3, 'STATUS_CHANGE', 'PENDING', 'APPROVED', 'Hồ sơ đầy đủ'),
(4, 3, '2026-08-28 11:03:00', 'ORDER', 4, 'STATUS_CHANGE', 'PENDING', 'APPROVED', 'Hồ sơ đầy đủ'),
(5, 2, '2026-09-10 11:10:00', 'ORDER', 5, 'STATUS_CHANGE', 'PENDING', 'APPROVED', 'Hồ sơ đầy đủ'),
(6, 3, '2026-09-10 11:17:00', 'ORDER', 6, 'STATUS_CHANGE', 'PENDING', 'APPROVED', 'Hồ sơ đầy đủ'),
(7, 2, '2026-09-09 11:24:00', 'ORDER', 7, 'STATUS_CHANGE', 'PENDING', 'APPROVED', 'Hồ sơ đầy đủ'),
(8, 3, '2026-09-08 11:31:00', 'ORDER', 8, 'STATUS_CHANGE', 'PENDING', 'APPROVED', 'Hồ sơ đầy đủ'),
(9, 2, '2026-10-08 00:02:00', 'ORDER', 21, 'STATUS_CHANGE', 'PENDING', 'NEED_INFO', 'Thiếu giấy chứng nhận sức khỏe'),
(10, 3, '2026-10-08 20:00:00', 'ORDER', 22, 'STATUS_CHANGE', 'PENDING', 'REJECTED', 'Không đáp ứng yêu cầu kiểm dịch'),
(11, 4, '2026-07-28 12:07:00', 'DOCUMENT', 1, 'STATUS_CHANGE', 'SUBMITTED', 'VALID', NULL),
(12, 4, '2026-07-28 12:07:00', 'DOCUMENT', 2, 'STATUS_CHANGE', 'SUBMITTED', 'VALID', NULL),
(13, 5, '2026-08-07 12:14:00', 'DOCUMENT', 3, 'STATUS_CHANGE', 'SUBMITTED', 'VALID', NULL),
(14, 5, '2026-08-07 12:14:00', 'DOCUMENT', 4, 'STATUS_CHANGE', 'SUBMITTED', 'VALID', NULL),
(15, 4, '2026-08-16 12:21:00', 'DOCUMENT', 5, 'STATUS_CHANGE', 'SUBMITTED', 'VALID', NULL),
(16, 4, '2026-07-31 10:07:00', 'DOSSIER', 1, 'STATUS_CHANGE', 'REVIEWING', 'APPROVED', 'Cơ quan đã cấp phép'),
(17, 5, '2026-07-31 11:07:00', 'DOSSIER', 2, 'STATUS_CHANGE', 'REVIEWING', 'APPROVED', 'Cơ quan đã cấp phép'),
(18, 4, '2026-08-19 14:21:00', 'DOSSIER', 5, 'STATUS_CHANGE', 'REVIEWING', 'APPROVED', 'Cơ quan đã cấp phép'),
(19, 2, '2026-08-18 07:00:00', 'TRIP', 1, 'PLAN_APPROVED', 'PENDING_APPROVAL', 'APPROVED', 'Kế hoạch hợp lệ'),
(20, 3, '2026-08-29 08:00:00', 'TRIP', 2, 'PLAN_APPROVED', 'PENDING_APPROVAL', 'APPROVED', 'Kế hoạch hợp lệ');
  COMMIT;
END;
//
DELIMITER ;
CALL import_wdp_excel_20261008();
DROP PROCEDURE import_wdp_excel_20261008;
SET SESSION sql_mode = @wdp_previous_sql_mode;

SELECT 'users' AS table_name, COUNT(*) AS row_count FROM `users`
UNION ALL SELECT 'system_parameters' AS table_name, COUNT(*) AS row_count FROM `system_parameters`
UNION ALL SELECT 'document_types' AS table_name, COUNT(*) AS row_count FROM `document_types`
UNION ALL SELECT 'authorities' AS table_name, COUNT(*) AS row_count FROM `authorities`
UNION ALL SELECT 'locations' AS table_name, COUNT(*) AS row_count FROM `locations`
UNION ALL SELECT 'vehicles' AS table_name, COUNT(*) AS row_count FROM `vehicles`
UNION ALL SELECT 'carriers' AS table_name, COUNT(*) AS row_count FROM `carriers`
UNION ALL SELECT 'orders' AS table_name, COUNT(*) AS row_count FROM `orders`
UNION ALL SELECT 'horses' AS table_name, COUNT(*) AS row_count FROM `horses`
UNION ALL SELECT 'quarantine_rules' AS table_name, COUNT(*) AS row_count FROM `quarantine_rules`
UNION ALL SELECT 'quarantine_rule_doctypes' AS table_name, COUNT(*) AS row_count FROM `quarantine_rule_doctypes`
UNION ALL SELECT 'documents' AS table_name, COUNT(*) AS row_count FROM `documents`
UNION ALL SELECT 'trips' AS table_name, COUNT(*) AS row_count FROM `trips`
UNION ALL SELECT 'trip_assignments' AS table_name, COUNT(*) AS row_count FROM `trip_assignments`
UNION ALL SELECT 'legs' AS table_name, COUNT(*) AS row_count FROM `legs`
UNION ALL SELECT 'leg_milestones' AS table_name, COUNT(*) AS row_count FROM `leg_milestones`
UNION ALL SELECT 'horse_logs' AS table_name, COUNT(*) AS row_count FROM `horse_logs`
UNION ALL SELECT 'incidents' AS table_name, COUNT(*) AS row_count FROM `incidents`
UNION ALL SELECT 'alerts' AS table_name, COUNT(*) AS row_count FROM `alerts`
UNION ALL SELECT 'attachments' AS table_name, COUNT(*) AS row_count FROM `attachments`
UNION ALL SELECT 'document_versions' AS table_name, COUNT(*) AS row_count FROM `document_versions`
UNION ALL SELECT 'dossiers' AS table_name, COUNT(*) AS row_count FROM `dossiers`
UNION ALL SELECT 'notifications' AS table_name, COUNT(*) AS row_count FROM `notifications`
UNION ALL SELECT 'audit_logs' AS table_name, COUNT(*) AS row_count FROM `audit_logs`;
