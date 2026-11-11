-- Cấu trúc database wdp trên Aiven, dump lúc 15:39 ngày 10/11/2026 (chỉ cấu trúc, không có dữ liệu).
-- Đã bỏ hai lệnh GTID_PURGED và SQL_LOG_BIN chỉ dùng cho server gốc.
-- MySQL dump 10.13  Distrib 8.0.36, for Linux (x86_64)
--
-- Host: mysql-ea32cfc-ninhquocbao69-8189.f.aivencloud.com    Database: wdp
-- ------------------------------------------------------
-- Server version	8.4.11

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
--


--
-- Table structure for table `account_avatars`
--

DROP TABLE IF EXISTS `account_avatars`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `account_avatars` (
  `user_id` bigint unsigned NOT NULL,
  `image` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_avatar_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `alerts`
--

DROP TABLE IF EXISTS `alerts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `alerts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `trip_id` bigint unsigned NOT NULL COMMENT 'FK -> trips.id',
  `alert_type` enum('TRAFFIC','WEATHER','BORDER') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `sent_by` bigint unsigned NOT NULL COMMENT 'FK -> users.id',
  `sent_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_alerts_trip_id` (`trip_id`),
  KEY `fk_alerts_sent_by` (`sent_by`),
  CONSTRAINT `fk_alerts_sent_by` FOREIGN KEY (`sent_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_alerts_trip_id` FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cảnh báo thủ công';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `attachments`
--

DROP TABLE IF EXISTS `attachments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attachments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `original_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_type` enum('PDF','JPG','PNG') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `size_bytes` bigint unsigned NOT NULL,
  `storage_path` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `uploaded_by` bigint unsigned NOT NULL COMMENT 'FK -> users.id',
  `uploaded_at` datetime NOT NULL DEFAULT (utc_timestamp()),
  `horse_log_id` bigint unsigned DEFAULT NULL COMMENT 'FK -> horse_logs.id',
  `incident_id` bigint unsigned DEFAULT NULL COMMENT 'FK -> incidents.id',
  `care_activity_id` bigint unsigned DEFAULT NULL COMMENT 'FK -> horse_care_activities.id',
  `caption` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Nhãn ảnh',
  PRIMARY KEY (`id`),
  KEY `fk_attachments_uploaded_by` (`uploaded_by`),
  KEY `fk_attachments_horse_log_id` (`horse_log_id`),
  KEY `fk_attachments_incident_id` (`incident_id`),
  KEY `fk_attachments_care_activity_id` (`care_activity_id`),
  CONSTRAINT `fk_attachments_care_activity_id` FOREIGN KEY (`care_activity_id`) REFERENCES `horse_care_activities` (`id`),
  CONSTRAINT `fk_attachments_horse_log_id` FOREIGN KEY (`horse_log_id`) REFERENCES `horse_logs` (`id`),
  CONSTRAINT `fk_attachments_incident_id` FOREIGN KEY (`incident_id`) REFERENCES `incidents` (`id`),
  CONSTRAINT `fk_attachments_uploaded_by` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=177 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tệp đính kèm; thân tệp lưu ngoài CSDL';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `actor_id` bigint unsigned DEFAULT NULL,
  `occurred_at` datetime NOT NULL DEFAULT (utc_timestamp()),
  `entity_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` bigint unsigned NOT NULL,
  `action` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `old_value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `new_value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_audit_logs_entity` (`entity_type`,`entity_id`),
  KEY `idx_audit_logs_occurred_at` (`occurred_at`),
  KEY `fk_audit_logs_actor_id` (`actor_id`),
  CONSTRAINT `fk_audit_logs_actor_id` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=458 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Nhật ký kiểm toán (chỉ thêm mới)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `authorities`
--

DROP TABLE IF EXISTS `authorities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `authorities` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `authority_type` enum('AGRICULTURE','CUSTOMS','QUARANTINE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `country` char(2) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_authorities_name_country` (`name`,`country`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cơ quan chức năng (không đăng nhập)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `carriers`
--

DROP TABLE IF EXISTS `carriers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `carriers` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `iata_code` varchar(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_carriers_iata_code` (`iata_code`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Hãng hàng không';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `crew_profiles`
--

DROP TABLE IF EXISTS `crew_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `crew_profiles` (
  `user_id` bigint unsigned NOT NULL,
  `crew_type` enum('DRIVER','ESCORT') COLLATE utf8mb4_unicode_ci NOT NULL,
  `work_status` enum('AVAILABLE','RESERVED','IN_TRIP') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'AVAILABLE',
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_crew_profiles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `customer_horse_profiles`
--

DROP TABLE IF EXISTS `customer_horse_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_horse_profiles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `owner_id` bigint unsigned NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `passport_no` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payload` json NOT NULL,
  `revision` int NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_customer_profile_passport` (`passport_no`),
  KEY `ix_customer_profiles_owner` (`owner_id`),
  CONSTRAINT `fk_customer_profile_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=68 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `customer_profile_files`
--

DROP TABLE IF EXISTS `customer_profile_files`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_profile_files` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `profile_id` bigint unsigned NOT NULL,
  `kind` enum('PHOTO','DOCUMENT') COLLATE utf8mb4_unicode_ci NOT NULL,
  `slot` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `original_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_type` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `size_bytes` bigint NOT NULL,
  `storage_path` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_customer_profile_file` (`profile_id`,`kind`,`slot`),
  CONSTRAINT `fk_customer_profile_file` FOREIGN KEY (`profile_id`) REFERENCES `customer_horse_profiles` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `delivery_exceptions`
--

DROP TABLE IF EXISTS `delivery_exceptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `delivery_exceptions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint unsigned NOT NULL COMMENT 'FK -> orders.id',
  `reason` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Lý do quản lý cho giao khi còn nợ',
  `due_at` datetime DEFAULT NULL COMMENT 'Hạn khách trả phần còn nợ',
  `status` enum('APPROVED','OPENED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'APPROVED',
  `approved_by` bigint unsigned NOT NULL COMMENT 'Quản lý duyệt',
  `approved_at` datetime NOT NULL,
  `opened_by` bigint unsigned DEFAULT NULL COMMENT 'Người mở cho tài xế',
  `opened_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_delivery_exceptions_order` (`order_id`),
  KEY `fk_delivery_exceptions_approved_by` (`approved_by`),
  KEY `fk_delivery_exceptions_opened_by` (`opened_by`),
  CONSTRAINT `fk_delivery_exceptions_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_delivery_exceptions_opened_by` FOREIGN KEY (`opened_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_delivery_exceptions_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Ngoại lệ giao ngựa khi chưa trả đủ';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `document_types`
--

DROP TABLE IF EXISTS `document_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `document_types` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `has_expiry` tinyint(1) NOT NULL DEFAULT '0',
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_document_types_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Danh mục loại giấy tờ';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `document_versions`
--

DROP TABLE IF EXISTS `document_versions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `document_versions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `document_id` bigint unsigned NOT NULL COMMENT 'FK -> documents.id',
  `version_no` int NOT NULL,
  `attachment_id` bigint unsigned NOT NULL COMMENT 'FK -> attachments.id',
  `uploaded_by` bigint unsigned NOT NULL COMMENT 'FK -> users.id',
  `uploaded_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_document_versions_attachment_id` (`attachment_id`),
  UNIQUE KEY `uq_document_versions_document_id_version_no` (`document_id`,`version_no`),
  KEY `fk_document_versions_uploaded_by` (`uploaded_by`),
  CONSTRAINT `fk_document_versions_attachment_id` FOREIGN KEY (`attachment_id`) REFERENCES `attachments` (`id`),
  CONSTRAINT `fk_document_versions_document_id` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`),
  CONSTRAINT `fk_document_versions_uploaded_by` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`),
  CONSTRAINT `ck_document_versions_version_no` CHECK ((`version_no` >= 1))
) ENGINE=InnoDB AUTO_INCREMENT=170 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Phiên bản upload của giấy tờ';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `documents`
--

DROP TABLE IF EXISTS `documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `documents` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `horse_id` bigint unsigned NOT NULL COMMENT 'FK -> horses.id',
  `document_type_id` bigint unsigned NOT NULL COMMENT 'FK -> document_types.id',
  `status` enum('NOT_SUBMITTED','SUBMITTED','VALID','INVALID','EXPIRED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NOT_SUBMITTED',
  `expiry_date` date DEFAULT NULL,
  `invalid_reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reviewed_by` bigint unsigned DEFAULT NULL COMMENT 'FK -> users.id',
  `reviewed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_documents_horse_id_document_type_id` (`horse_id`,`document_type_id`),
  KEY `fk_documents_document_type_id` (`document_type_id`),
  KEY `fk_documents_reviewed_by` (`reviewed_by`),
  CONSTRAINT `fk_documents_document_type_id` FOREIGN KEY (`document_type_id`) REFERENCES `document_types` (`id`),
  CONSTRAINT `fk_documents_horse_id` FOREIGN KEY (`horse_id`) REFERENCES `horses` (`id`),
  CONSTRAINT `fk_documents_reviewed_by` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=137 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Giấy tờ của từng ngựa (checklist)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dossiers`
--

DROP TABLE IF EXISTS `dossiers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dossiers` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `horse_id` bigint unsigned NOT NULL COMMENT 'FK -> horses.id',
  `authority_id` bigint unsigned NOT NULL COMMENT 'FK -> authorities.id',
  `status` enum('NOT_SUBMITTED','SUBMITTED','REVIEWING','NEED_INFO','APPROVED','REJECTED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NOT_SUBMITTED',
  `submitted_at` datetime DEFAULT NULL,
  `receipt_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `result_at` datetime DEFAULT NULL,
  `result` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rejection_reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `permit_attachment_id` bigint unsigned DEFAULT NULL COMMENT 'FK -> attachments.id',
  `specialist_id` bigint unsigned DEFAULT NULL COMMENT 'FK -> users.id',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_dossiers_horse_id_authority_id` (`horse_id`,`authority_id`),
  UNIQUE KEY `uq_dossiers_permit_attachment_id` (`permit_attachment_id`),
  KEY `fk_dossiers_authority_id` (`authority_id`),
  KEY `fk_dossiers_specialist_id` (`specialist_id`),
  CONSTRAINT `fk_dossiers_authority_id` FOREIGN KEY (`authority_id`) REFERENCES `authorities` (`id`),
  CONSTRAINT `fk_dossiers_horse_id` FOREIGN KEY (`horse_id`) REFERENCES `horses` (`id`),
  CONSTRAINT `fk_dossiers_permit_attachment_id` FOREIGN KEY (`permit_attachment_id`) REFERENCES `attachments` (`id`),
  CONSTRAINT `fk_dossiers_specialist_id` FOREIGN KEY (`specialist_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Hồ sơ nộp cơ quan, theo ngựa và cơ quan';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `horse_care_activities`
--

DROP TABLE IF EXISTS `horse_care_activities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `horse_care_activities` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `trip_id` bigint unsigned NOT NULL COMMENT 'FK -> trips.id',
  `leg_id` bigint unsigned DEFAULT NULL COMMENT 'FK -> legs.id (chặng lúc ghi)',
  `horse_id` bigint unsigned DEFAULT NULL COMMENT 'FK -> horses.id; NULL = cả đoàn (chỉ REST)',
  `activity_type` enum('FEED','WATER','REST') COLLATE utf8mb4_unicode_ci NOT NULL,
  `feed_description` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Khẩu phần (FEED)',
  `amount_liters` decimal(5,1) DEFAULT NULL COMMENT 'Lượng nước (WATER)',
  `duration_minutes` smallint unsigned DEFAULT NULL COMMENT 'Thời gian nghỉ (REST)',
  `note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `performed_at` datetime NOT NULL COMMENT 'Giờ thực hiện (UTC)',
  `created_by` bigint unsigned NOT NULL COMMENT 'FK -> users.id',
  `created_at` datetime NOT NULL DEFAULT (utc_timestamp()),
  `corrects_activity_id` bigint unsigned DEFAULT NULL COMMENT 'Bản ghi được đính chính',
  `client_request_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mã do máy sinh để chống gửi trùng (G2)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_care_client_request` (`created_by`,`client_request_id`),
  KEY `idx_care_trip_time` (`trip_id`,`performed_at`),
  KEY `idx_care_horse_time` (`horse_id`,`performed_at`),
  KEY `fk_care_leg_id` (`leg_id`),
  KEY `fk_care_created_by` (`created_by`),
  KEY `fk_care_corrects` (`corrects_activity_id`),
  CONSTRAINT `fk_care_corrects` FOREIGN KEY (`corrects_activity_id`) REFERENCES `horse_care_activities` (`id`),
  CONSTRAINT `fk_care_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_care_horse` FOREIGN KEY (`horse_id`) REFERENCES `horses` (`id`),
  CONSTRAINT `fk_care_leg` FOREIGN KEY (`leg_id`) REFERENCES `legs` (`id`),
  CONSTRAINT `fk_care_trip` FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`),
  CONSTRAINT `ck_care_feed` CHECK (((`activity_type` <> _utf8mb4'FEED') or ((`amount_liters` is null) and (`duration_minutes` is null)))),
  CONSTRAINT `ck_care_horse` CHECK (((`activity_type` = _utf8mb4'REST') or (`horse_id` is not null))),
  CONSTRAINT `ck_care_rest` CHECK (((`activity_type` <> _utf8mb4'REST') or ((`duration_minutes` is not null) and (`duration_minutes` between 1 and 720) and (`feed_description` is null) and (`amount_liters` is null)))),
  CONSTRAINT `ck_care_water` CHECK (((`activity_type` <> _utf8mb4'WATER') or ((`amount_liters` is not null) and (`amount_liters` between 0.1 and 200) and (`feed_description` is null) and (`duration_minutes` is null))))
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Nhật ký hoạt động chăm sóc ngựa (chỉ thêm mới)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `horse_logs`
--

DROP TABLE IF EXISTS `horse_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `horse_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `horse_id` bigint unsigned NOT NULL COMMENT 'FK -> horses.id',
  `leg_id` bigint unsigned NOT NULL COMMENT 'FK -> legs.id',
  `condition_status` enum('STABLE','OFF_FEED','STRESSED','CLIMATE_CHANGE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `body_temp_c` decimal(3,1) DEFAULT NULL COMMENT 'Nhiệt độ (°C)',
  `heart_rate_bpm` smallint unsigned DEFAULT NULL COMMENT 'Nhịp tim (lần/phút)',
  `appetite` enum('NORMAL','REDUCED','REFUSED') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Ăn uống',
  `customer_note` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Ghi chú gửi khách (tách khỏi note nội bộ)',
  `report_status` enum('DRAFT','SENT') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'NULL = nhật ký cũ, không phải báo cáo',
  `send_to_customer` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Gửi thông báo tới khách khi gửi báo cáo',
  `sent_at` datetime DEFAULT NULL COMMENT 'Lúc gửi báo cáo (UTC)',
  `customer_viewed_at` datetime DEFAULT NULL COMMENT 'Lúc khách mở báo cáo lần đầu (UTC)',
  `logged_at` datetime NOT NULL,
  `created_by` bigint unsigned NOT NULL COMMENT 'FK -> users.id',
  `corrects_log_id` bigint unsigned DEFAULT NULL COMMENT 'FK -> horse_logs.id',
  `client_request_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mã do máy sinh để chống gửi trùng (G2)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_horse_logs_client_request` (`created_by`,`client_request_id`),
  KEY `idx_horse_logs_horse_logged_at` (`horse_id`,`logged_at`),
  KEY `fk_horse_logs_leg_id` (`leg_id`),
  KEY `fk_horse_logs_created_by` (`created_by`),
  KEY `fk_horse_logs_corrects_log_id` (`corrects_log_id`),
  KEY `idx_horse_logs_report` (`horse_id`,`report_status`,`logged_at`),
  CONSTRAINT `fk_horse_logs_corrects_log_id` FOREIGN KEY (`corrects_log_id`) REFERENCES `horse_logs` (`id`),
  CONSTRAINT `fk_horse_logs_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_horse_logs_horse_id` FOREIGN KEY (`horse_id`) REFERENCES `horses` (`id`),
  CONSTRAINT `fk_horse_logs_leg_id` FOREIGN KEY (`leg_id`) REFERENCES `legs` (`id`),
  CONSTRAINT `ck_horse_logs_hr` CHECK (((`heart_rate_bpm` is null) or (`heart_rate_bpm` between 10 and 200))),
  CONSTRAINT `ck_horse_logs_sent` CHECK (((`report_status` is null) or (`report_status` = _utf8mb4'DRAFT') or (`sent_at` is not null))),
  CONSTRAINT `ck_horse_logs_temp` CHECK (((`body_temp_c` is null) or (`body_temp_c` between 30.0 and 45.0))),
  CONSTRAINT `ck_horse_logs_viewed` CHECK (((`customer_viewed_at` is null) or (`report_status` = _utf8mb4'SENT')))
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Nhật ký tình trạng ngựa (chỉ thêm mới)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `horses`
--

DROP TABLE IF EXISTS `horses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `horses` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint unsigned NOT NULL COMMENT 'FK -> orders.id',
  `owner_id` bigint unsigned NOT NULL COMMENT 'FK -> users.id',
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `passport_no` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `order_status` enum('NORMAL','FLAGGED','REMOVED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NORMAL',
  `note` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `breed` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `sex` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `coat_color` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_horses_order_id` (`order_id`),
  KEY `fk_horses_owner_id` (`owner_id`),
  KEY `ix_horses_passport_no` (`passport_no`),
  CONSTRAINT `fk_horses_order_id` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  CONSTRAINT `fk_horses_owner_id` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=55 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Ngựa; mỗi ngựa thuộc đúng một đơn';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `incident_responses`
--

DROP TABLE IF EXISTS `incident_responses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `incident_responses` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `incident_id` bigint unsigned NOT NULL COMMENT 'FK -> incidents.id',
  `kind` enum('RESPONSE','RESOLVED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `wait_minutes` smallint unsigned DEFAULT NULL COMMENT 'Thời gian chờ dự kiến (phút), 1-1440',
  `sent_by` bigint unsigned NOT NULL COMMENT 'FK -> users.id',
  `sent_at` datetime NOT NULL DEFAULT (utc_timestamp()),
  PRIMARY KEY (`id`),
  KEY `idx_incident_responses_incident` (`incident_id`,`sent_at`),
  KEY `fk_incident_responses_sent_by` (`sent_by`),
  CONSTRAINT `fk_incident_responses_incident` FOREIGN KEY (`incident_id`) REFERENCES `incidents` (`id`),
  CONSTRAINT `fk_incident_responses_sent_by` FOREIGN KEY (`sent_by`) REFERENCES `users` (`id`),
  CONSTRAINT `ck_incident_responses_wait` CHECK (((`wait_minutes` is null) or (`wait_minutes` between 1 and 1440)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Phản hồi xử lý sự cố của điều phối viên';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `incidents`
--

DROP TABLE IF EXISTS `incidents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `incidents` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `trip_id` bigint unsigned NOT NULL COMMENT 'FK -> trips.id',
  `leg_id` bigint unsigned DEFAULT NULL COMMENT 'FK -> legs.id',
  `horse_id` bigint unsigned DEFAULT NULL COMMENT 'FK -> horses.id',
  `incident_type` enum('VEHICLE_BREAKDOWN','LONG_TRAFFIC_JAM','HORSE_MEDICAL','DELIVERY_ISSUE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `urgency` enum('NORMAL','HIGH') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NORMAL',
  `severity` enum('RED','ORANGE','YELLOW') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mức độ do tài xế chọn',
  `sub_type` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mã loại con, danh sách trong packages/shared',
  `damage_target` enum('VEHICLE','HORSE','BOTH') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Hư hại liên quan tới',
  `latitude` decimal(9,6) DEFAULT NULL COMMENT 'Vĩ độ WGS84 lúc báo',
  `longitude` decimal(9,6) DEFAULT NULL COMMENT 'Kinh độ WGS84 lúc báo',
  `location_text` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mô tả vị trí (reverse geocode)',
  `status` enum('NEW','ACKNOWLEDGED','CLOSED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NEW',
  `reported_by` bigint unsigned NOT NULL COMMENT 'FK -> users.id',
  `reported_at` datetime NOT NULL,
  `received_by` bigint unsigned DEFAULT NULL COMMENT 'FK -> users.id',
  `handling_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `closed_at` datetime DEFAULT NULL,
  `client_request_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mã do máy sinh để chống gửi trùng (G2)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_incidents_client_request` (`reported_by`,`client_request_id`),
  KEY `fk_incidents_trip_id` (`trip_id`),
  KEY `fk_incidents_leg_id` (`leg_id`),
  KEY `fk_incidents_horse_id` (`horse_id`),
  KEY `fk_incidents_reported_by` (`reported_by`),
  KEY `fk_incidents_received_by` (`received_by`),
  CONSTRAINT `fk_incidents_horse_id` FOREIGN KEY (`horse_id`) REFERENCES `horses` (`id`),
  CONSTRAINT `fk_incidents_leg_id` FOREIGN KEY (`leg_id`) REFERENCES `legs` (`id`),
  CONSTRAINT `fk_incidents_received_by` FOREIGN KEY (`received_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_incidents_reported_by` FOREIGN KEY (`reported_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_incidents_trip_id` FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`),
  CONSTRAINT `ck_incidents_lat` CHECK (((`latitude` is null) or (`latitude` between -(90) and 90))),
  CONSTRAINT `ck_incidents_latlng_pair` CHECK (((`latitude` is null) = (`longitude` is null))),
  CONSTRAINT `ck_incidents_lng` CHECK (((`longitude` is null) or (`longitude` between -(180) and 180)))
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Sự cố';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `leg_milestones`
--

DROP TABLE IF EXISTS `leg_milestones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leg_milestones` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `leg_id` bigint unsigned NOT NULL COMMENT 'FK -> legs.id',
  `milestone_type` enum('DEPARTED','ARRIVED_AT_STOP','CUSTOMS_CLEARED','DELIVERED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `occurred_at` datetime NOT NULL,
  `recorded_by` bigint unsigned NOT NULL COMMENT 'FK -> users.id',
  `actual_recipient_name` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Người nhận thực tế khi khác người nhận trên đơn',
  `actual_recipient_phone` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_leg_milestones_leg_id_milestone_type` (`leg_id`,`milestone_type`),
  KEY `fk_leg_milestones_recorded_by` (`recorded_by`),
  CONSTRAINT `fk_leg_milestones_leg_id` FOREIGN KEY (`leg_id`) REFERENCES `legs` (`id`),
  CONSTRAINT `fk_leg_milestones_recorded_by` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=54 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Mốc sự kiện của chặng';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `leg_waypoint_checkins`
--

DROP TABLE IF EXISTS `leg_waypoint_checkins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leg_waypoint_checkins` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `leg_id` bigint unsigned NOT NULL COMMENT 'FK -> legs.id',
  `waypoint_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'id điểm trong trips.route_plan.waypoints',
  `waypoint_label` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tên điểm tại thời điểm check-in',
  `occurred_at` datetime NOT NULL,
  `recorded_by` bigint unsigned NOT NULL COMMENT 'FK -> users.id',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_leg_waypoint_checkins` (`leg_id`,`waypoint_id`),
  KEY `fk_leg_waypoint_checkins_user` (`recorded_by`),
  CONSTRAINT `fk_leg_waypoint_checkins_leg` FOREIGN KEY (`leg_id`) REFERENCES `legs` (`id`),
  CONSTRAINT `fk_leg_waypoint_checkins_user` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Check-in điểm nghỉ giữa đường';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `legs`
--

DROP TABLE IF EXISTS `legs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `legs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `trip_id` bigint unsigned NOT NULL COMMENT 'FK -> trips.id',
  `seq_no` int NOT NULL,
  `from_location_id` bigint unsigned DEFAULT NULL COMMENT 'FK -> locations.id; NULL khi dùng trips.route_plan',
  `to_location_id` bigint unsigned DEFAULT NULL COMMENT 'FK -> locations.id; NULL khi dùng trips.route_plan',
  `vehicle_id` bigint unsigned DEFAULT NULL COMMENT 'FK -> vehicles.id',
  `carrier_id` bigint unsigned DEFAULT NULL COMMENT 'FK -> carriers.id',
  `planned_departure_at` datetime NOT NULL,
  `planned_arrival_at` datetime NOT NULL,
  `status` enum('NOT_STARTED','MOVING','AT_STOP','COMPLETED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NOT_STARTED',
  `actual_departure_at` datetime DEFAULT NULL,
  `actual_arrival_at` datetime DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL COMMENT 'FK -> users.id',
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_legs_trip_id_seq_no` (`trip_id`,`seq_no`),
  KEY `fk_legs_from_location_id` (`from_location_id`),
  KEY `fk_legs_to_location_id` (`to_location_id`),
  KEY `fk_legs_vehicle_id` (`vehicle_id`),
  KEY `fk_legs_carrier_id` (`carrier_id`),
  KEY `fk_legs_updated_by` (`updated_by`),
  CONSTRAINT `fk_legs_carrier_id` FOREIGN KEY (`carrier_id`) REFERENCES `carriers` (`id`),
  CONSTRAINT `fk_legs_from_location_id` FOREIGN KEY (`from_location_id`) REFERENCES `locations` (`id`),
  CONSTRAINT `fk_legs_to_location_id` FOREIGN KEY (`to_location_id`) REFERENCES `locations` (`id`),
  CONSTRAINT `fk_legs_trip_id` FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`),
  CONSTRAINT `fk_legs_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_legs_vehicle_id` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`),
  CONSTRAINT `ck_legs_planned_time` CHECK ((`planned_arrival_at` >= `planned_departure_at`)),
  CONSTRAINT `ck_legs_seq_no` CHECK ((`seq_no` >= 1))
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Chặng của chuyến';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `location_routes`
--

DROP TABLE IF EXISTS `location_routes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `location_routes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `from_location_id` bigint unsigned NOT NULL COMMENT 'FK -> locations.id',
  `to_location_id` bigint unsigned NOT NULL COMMENT 'FK -> locations.id',
  `mode` enum('ROAD','AIR','STRAIGHT') COLLATE utf8mb4_unicode_ci NOT NULL,
  `coordinates` json NOT NULL COMMENT '[[lng,lat],...] WGS84',
  `distance_m` int unsigned DEFAULT NULL,
  `duration_s` int unsigned DEFAULT NULL,
  `fetched_at` datetime NOT NULL DEFAULT (utc_timestamp()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_location_routes_pair_mode` (`from_location_id`,`to_location_id`,`mode`),
  KEY `idx_location_routes_to` (`to_location_id`),
  CONSTRAINT `fk_location_routes_from_location_id` FOREIGN KEY (`from_location_id`) REFERENCES `locations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_location_routes_to_location_id` FOREIGN KEY (`to_location_id`) REFERENCES `locations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ck_location_routes_coordinates` CHECK ((json_type(`coordinates`) = _utf8mb4'ARRAY'))
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cache hình học tuyến theo cặp địa điểm';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `locations`
--

DROP TABLE IF EXISTS `locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `locations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `location_type` enum('BORDER','QUARANTINE_STATION','REST_STOP','AIRPORT','FUEL_STOP') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `country` char(2) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `timezone` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `latitude` decimal(9,6) DEFAULT NULL COMMENT 'Vĩ độ WGS84',
  `longitude` decimal(9,6) DEFAULT NULL COMMENT 'Kinh độ WGS84',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_locations_name_country` (`name`,`country`),
  CONSTRAINT `ck_locations_coords_pair` CHECK (((`latitude` is null) = (`longitude` is null))),
  CONSTRAINT `ck_locations_lat` CHECK (((`latitude` is null) or (`latitude` between -(90) and 90))),
  CONSTRAINT `ck_locations_lng` CHECK (((`longitude` is null) or (`longitude` between -(180) and 180)))
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Danh mục điểm (cửa khẩu, trạm, sân bay...)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `migrations`
--

DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `migrations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `timestamp` bigint NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `recipient_id` bigint unsigned NOT NULL COMMENT 'FK -> users.id',
  `event_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `related_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `related_id` bigint unsigned DEFAULT NULL,
  `channel` enum('IN_APP','EMAIL','SMS') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT (utc_timestamp()),
  PRIMARY KEY (`id`),
  KEY `idx_notifications_recipient_read` (`recipient_id`,`is_read`,`created_at`),
  CONSTRAINT `fk_notifications_recipient_id` FOREIGN KEY (`recipient_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=532 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Thông báo';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `order_quotes`
--

DROP TABLE IF EXISTS `order_quotes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_quotes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint unsigned NOT NULL,
  `pricing_version_id` bigint unsigned NOT NULL,
  `revision` int unsigned NOT NULL DEFAULT '1',
  `status` enum('DRAFT','APPROVED','NEED_REVISION') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `input` json NOT NULL,
  `items` json NOT NULL,
  `subtotal` bigint unsigned NOT NULL,
  `adjustment` bigint NOT NULL DEFAULT '0',
  `adjustment_reason` varchar(2000) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vat_percent` decimal(5,2) NOT NULL DEFAULT '0.00',
  `vat_amount` bigint unsigned NOT NULL,
  `total` bigint unsigned NOT NULL,
  `deposit` bigint unsigned NOT NULL,
  `deposit_percent` decimal(5,2) NOT NULL,
  `validity_hours` smallint unsigned NOT NULL,
  `expires_at` datetime(3) DEFAULT NULL,
  `created_by` bigint unsigned NOT NULL,
  `approved_by` bigint unsigned DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT (utc_timestamp(3)),
  `approved_at` datetime(3) DEFAULT NULL,
  `review_note` varchar(2000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_quote_order` (`order_id`,`id`),
  KEY `ix_quote_status` (`status`,`approved_at`),
  KEY `pricing_version_id` (`pricing_version_id`),
  KEY `created_by` (`created_by`),
  KEY `approved_by` (`approved_by`),
  CONSTRAINT `order_quotes_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  CONSTRAINT `order_quotes_ibfk_2` FOREIGN KEY (`pricing_version_id`) REFERENCES `pricing_versions` (`id`),
  CONSTRAINT `order_quotes_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `order_quotes_ibfk_4` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `order_receipts`
--

DROP TABLE IF EXISTS `order_receipts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_receipts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint unsigned NOT NULL,
  `quote_id` bigint unsigned NOT NULL,
  `amount` bigint unsigned NOT NULL,
  `method` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'BANK_TRANSFER',
  `source` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MANUAL',
  `session_id` bigint unsigned DEFAULT NULL,
  `reference` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `received_at` datetime(3) NOT NULL,
  `recorded_by` bigint unsigned NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT (utc_timestamp(3)),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_receipt_reference` (`reference`),
  KEY `ix_receipt_order` (`order_id`,`received_at`),
  KEY `quote_id` (`quote_id`),
  KEY `recorded_by` (`recorded_by`),
  KEY `fk_receipt_session` (`session_id`),
  CONSTRAINT `fk_receipt_session` FOREIGN KEY (`session_id`) REFERENCES `payment_sessions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `order_receipts_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  CONSTRAINT `order_receipts_ibfk_2` FOREIGN KEY (`quote_id`) REFERENCES `order_quotes` (`id`),
  CONSTRAINT `order_receipts_ibfk_3` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` bigint unsigned NOT NULL COMMENT 'FK -> users.id',
  `origin_address` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `origin_country` char(2) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `destination_address` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `destination_country` char(2) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `desired_departure_date` date DEFAULT NULL,
  `special_requirements` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `status` enum('DRAFT','PENDING','NEED_INFO','REJECTED','APPROVED','PREPARING','READY','IN_TRANSIT','DELIVERED','CANCELLED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `manager_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `reviewed_by` bigint unsigned DEFAULT NULL COMMENT 'FK -> users.id',
  `reviewed_at` datetime DEFAULT NULL,
  `response_deadline` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT (utc_timestamp()),
  `submitted_at` datetime DEFAULT NULL,
  `draft_payload` json DEFAULT NULL,
  `client_request_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `requirements_snapshot` json DEFAULT NULL,
  `booking_details` json DEFAULT NULL,
  `recipient_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Người nhận tại điểm đến',
  `recipient_phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'SĐT người nhận',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_orders_order_code` (`order_code`),
  UNIQUE KEY `uq_orders_client_request` (`customer_id`,`client_request_id`),
  KEY `fk_orders_reviewed_by` (`reviewed_by`),
  CONSTRAINT `fk_orders_customer_id` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_orders_reviewed_by` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=50 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Đơn vận chuyển';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payment_sessions`
--

DROP TABLE IF EXISTS `payment_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_sessions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `session_code` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `order_id` bigint unsigned NOT NULL,
  `quote_id` bigint unsigned NOT NULL,
  `customer_id` bigint unsigned NOT NULL,
  `payment_type` enum('DEPOSIT','BALANCE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_method` enum('BANK_TRANSFER','E_WALLET','CARD') COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` bigint unsigned NOT NULL,
  `status` enum('PENDING','SUCCESS','FAILED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `failure_reason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT (utc_timestamp(3)),
  `completed_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payment_session_code` (`session_code`),
  KEY `ix_pay_session_order` (`order_id`,`status`),
  KEY `quote_id` (`quote_id`),
  KEY `customer_id` (`customer_id`),
  CONSTRAINT `payment_sessions_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  CONSTRAINT `payment_sessions_ibfk_2` FOREIGN KEY (`quote_id`) REFERENCES `order_quotes` (`id`),
  CONSTRAINT `payment_sessions_ibfk_3` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=77 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pricing_publish_lock`
--

DROP TABLE IF EXISTS `pricing_publish_lock`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pricing_publish_lock` (
  `id` tinyint unsigned NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pricing_versions`
--

DROP TABLE IF EXISTS `pricing_versions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pricing_versions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` text COLLATE utf8mb4_unicode_ci,
  `status` enum('DRAFT','PUBLISHED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `revision` int unsigned NOT NULL DEFAULT '1',
  `config` json NOT NULL,
  `effective_from` datetime(3) DEFAULT NULL,
  `published_at` datetime(3) DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `published_by` bigint unsigned DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT (utc_timestamp(3)),
  `updated_at` datetime(3) NOT NULL DEFAULT (utc_timestamp(3)),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pricing_effective` (`effective_from`),
  KEY `ix_pricing_current` (`status`,`effective_from`,`id`),
  KEY `fk_pricing_creator` (`created_by`),
  KEY `fk_pricing_updater` (`updated_by`),
  KEY `fk_pricing_publisher` (`published_by`),
  CONSTRAINT `fk_pricing_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_pricing_publisher` FOREIGN KEY (`published_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_pricing_updater` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `specialist_assessments`
--

DROP TABLE IF EXISTS `specialist_assessments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `specialist_assessments` (
  `order_id` bigint unsigned NOT NULL,
  `specialist_id` bigint unsigned NOT NULL,
  `status` enum('IN_REVIEW','NEED_INFO','APPROVED','REJECTED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'IN_REVIEW',
  `note` varchar(2000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `accepted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `concluded_at` datetime DEFAULT NULL,
  `revision` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`order_id`),
  KEY `ix_assessment_specialist` (`specialist_id`,`status`),
  CONSTRAINT `fk_assessment_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  CONSTRAINT `fk_assessment_specialist` FOREIGN KEY (`specialist_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `system_parameters`
--

DROP TABLE IF EXISTS `system_parameters`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_parameters` (
  `param_code` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `param_value` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`param_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tham số hệ thống (L, D, N, S, T...)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `trip_assignments`
--

DROP TABLE IF EXISTS `trip_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `trip_assignments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `trip_id` bigint unsigned NOT NULL COMMENT 'FK -> trips.id',
  `user_id` bigint unsigned NOT NULL COMMENT 'FK -> users.id',
  `role` enum('DRIVER','ESCORT') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `assigned_by` bigint unsigned NOT NULL COMMENT 'FK -> users.id',
  `assigned_at` datetime NOT NULL,
  `trip_vehicle_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_trip_assignments_trip_id_user_id` (`trip_id`,`user_id`),
  KEY `fk_trip_assignments_user_id` (`user_id`),
  KEY `fk_trip_assignments_assigned_by` (`assigned_by`),
  KEY `fk_assignment_trip_vehicle` (`trip_vehicle_id`,`trip_id`),
  CONSTRAINT `fk_assignment_trip_vehicle` FOREIGN KEY (`trip_vehicle_id`, `trip_id`) REFERENCES `trip_vehicles` (`id`, `trip_id`),
  CONSTRAINT `fk_trip_assignments_assigned_by` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_trip_assignments_trip_id` FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`),
  CONSTRAINT `fk_trip_assignments_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=60 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Phân công Driver/Escort cho chuyến';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `trip_positions`
--

DROP TABLE IF EXISTS `trip_positions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `trip_positions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `trip_id` bigint unsigned NOT NULL COMMENT 'FK -> trips.id',
  `leg_id` bigint unsigned DEFAULT NULL COMMENT 'FK -> legs.id (chặng lúc gửi)',
  `user_id` bigint unsigned NOT NULL COMMENT 'FK -> users.id (người gửi)',
  `latitude` decimal(9,6) NOT NULL,
  `longitude` decimal(9,6) NOT NULL,
  `accuracy_m` int unsigned DEFAULT NULL,
  `speed_mps` decimal(5,2) DEFAULT NULL,
  `heading_deg` smallint unsigned DEFAULT NULL,
  `recorded_at` datetime NOT NULL COMMENT 'Giờ trên thiết bị (UTC)',
  `received_at` datetime NOT NULL DEFAULT (utc_timestamp()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_trip_positions_point` (`trip_id`,`user_id`,`recorded_at`),
  KEY `idx_trip_positions_trip_time` (`trip_id`,`recorded_at`),
  KEY `idx_trip_positions_recorded` (`recorded_at`),
  KEY `idx_trip_positions_leg` (`leg_id`),
  KEY `idx_trip_positions_user` (`user_id`),
  CONSTRAINT `fk_trip_positions_leg_id` FOREIGN KEY (`leg_id`) REFERENCES `legs` (`id`),
  CONSTRAINT `fk_trip_positions_trip_id` FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`),
  CONSTRAINT `fk_trip_positions_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `ck_trip_positions_heading` CHECK (((`heading_deg` is null) or (`heading_deg` < 360))),
  CONSTRAINT `ck_trip_positions_lat` CHECK ((`latitude` between -(90) and 90)),
  CONSTRAINT `ck_trip_positions_lng` CHECK ((`longitude` between -(180) and 180)),
  CONSTRAINT `ck_trip_positions_speed` CHECK (((`speed_mps` is null) or (`speed_mps` >= 0)))
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Vị trí GPS tài xế (tự xóa sau thời hạn lưu)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `trip_vehicles`
--

DROP TABLE IF EXISTS `trip_vehicles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `trip_vehicles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `trip_id` bigint unsigned NOT NULL,
  `vehicle_id` bigint unsigned NOT NULL,
  `horse_count` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_trip_vehicle` (`trip_id`,`vehicle_id`),
  UNIQUE KEY `uq_trip_vehicle_owner` (`id`,`trip_id`),
  KEY `vehicle_id` (`vehicle_id`),
  CONSTRAINT `trip_vehicles_ibfk_1` FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`),
  CONSTRAINT `trip_vehicles_ibfk_2` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `trips`
--

DROP TABLE IF EXISTS `trips`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `trips` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint unsigned NOT NULL COMMENT 'FK -> orders.id',
  `plan_status` enum('DRAFT','PENDING_APPROVAL','APPROVED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `planned_departure_at` datetime DEFAULT NULL,
  `planned_arrival_at` datetime DEFAULT NULL,
  `planned_by` bigint unsigned NOT NULL COMMENT 'FK -> users.id',
  `approved_by` bigint unsigned DEFAULT NULL COMMENT 'FK -> users.id',
  `approved_at` datetime DEFAULT NULL,
  `return_reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `route_plan` json DEFAULT NULL,
  `route_plan_revision` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_trips_order_id` (`order_id`),
  KEY `fk_trips_planned_by` (`planned_by`),
  KEY `fk_trips_approved_by` (`approved_by`),
  CONSTRAINT `fk_trips_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_trips_order_id` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  CONSTRAINT `fk_trips_planned_by` FOREIGN KEY (`planned_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Chuyến, sinh ra từ đơn đã duyệt';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `full_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('ADMIN','MANAGER','SPECIALIST','COORDINATOR','DRIVER_ESCORT','CUSTOMER') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `account_status` enum('ACTIVE','LOCKED','PENDING') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `organization_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customer_type` enum('CLUB','INDIVIDUAL') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT (utc_timestamp()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=2070 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Người dùng: 5 vai nội bộ (Admin, Manager, Specialist, Coordinator, Driver/Escort) và Customer (gộp hồ sơ khách hàng)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `vehicles`
--

DROP TABLE IF EXISTS `vehicles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vehicles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `vehicle_type` enum('LIGHT','MEDIUM','HEAVY') COLLATE utf8mb4_unicode_ci NOT NULL,
  `capacity_stalls` int NOT NULL,
  `license_plate` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('AVAILABLE','RESERVED','IN_TRANSIT') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'AVAILABLE',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vehicles_license_plate` (`license_plate`),
  CONSTRAINT `ck_vehicles_type_capacity` CHECK ((((`vehicle_type` = _utf8mb4'LIGHT') and (`capacity_stalls` = 2)) or ((`vehicle_type` = _utf8mb4'MEDIUM') and (`capacity_stalls` between 4 and 6)) or ((`vehicle_type` = _utf8mb4'HEAVY') and (`capacity_stalls` = 9))))
) ENGINE=InnoDB AUTO_INCREMENT=1024 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-10 15:39:05
