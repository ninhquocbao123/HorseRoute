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
SET @MYSQLDUMP_TEMP_LOG_BIN = @@SESSION.SQL_LOG_BIN;
SET @@SESSION.SQL_LOG_BIN= 0;

--
-- GTID state at the beginning of the backup 
--

SET @@GLOBAL.GTID_PURGED=/*!80000 '+'*/ '0894cc84-c624-11f1-b437-461552f05ead:1-683';

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
  PRIMARY KEY (`id`),
  KEY `fk_attachments_uploaded_by` (`uploaded_by`),
  KEY `fk_attachments_horse_log_id` (`horse_log_id`),
  KEY `fk_attachments_incident_id` (`incident_id`),
  CONSTRAINT `fk_attachments_horse_log_id` FOREIGN KEY (`horse_log_id`) REFERENCES `horse_logs` (`id`),
  CONSTRAINT `fk_attachments_incident_id` FOREIGN KEY (`incident_id`) REFERENCES `incidents` (`id`),
  CONSTRAINT `fk_attachments_uploaded_by` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=112 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tệp đính kèm; thân tệp lưu ngoài CSDL';
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
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Nhật ký kiểm toán (chỉ thêm mới)';
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
) ENGINE=InnoDB AUTO_INCREMENT=106 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Phiên bản upload của giấy tờ';
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
) ENGINE=InnoDB AUTO_INCREMENT=38 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Giấy tờ của từng ngựa (checklist)';
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
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Hồ sơ nộp cơ quan, theo ngựa và cơ quan';
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
  `logged_at` datetime NOT NULL,
  `created_by` bigint unsigned NOT NULL COMMENT 'FK -> users.id',
  `corrects_log_id` bigint unsigned DEFAULT NULL COMMENT 'FK -> horse_logs.id',
  PRIMARY KEY (`id`),
  KEY `idx_horse_logs_horse_logged_at` (`horse_id`,`logged_at`),
  KEY `fk_horse_logs_leg_id` (`leg_id`),
  KEY `fk_horse_logs_created_by` (`created_by`),
  KEY `fk_horse_logs_corrects_log_id` (`corrects_log_id`),
  CONSTRAINT `fk_horse_logs_corrects_log_id` FOREIGN KEY (`corrects_log_id`) REFERENCES `horse_logs` (`id`),
  CONSTRAINT `fk_horse_logs_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_horse_logs_horse_id` FOREIGN KEY (`horse_id`) REFERENCES `horses` (`id`),
  CONSTRAINT `fk_horse_logs_leg_id` FOREIGN KEY (`leg_id`) REFERENCES `legs` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Nhật ký tình trạng ngựa (chỉ thêm mới)';
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
  UNIQUE KEY `uq_horses_passport_no` (`passport_no`),
  KEY `fk_horses_order_id` (`order_id`),
  KEY `fk_horses_owner_id` (`owner_id`),
  CONSTRAINT `fk_horses_order_id` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  CONSTRAINT `fk_horses_owner_id` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Ngựa; mỗi ngựa thuộc đúng một đơn';
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
  `incident_type` enum('VEHICLE_BREAKDOWN','LONG_TRAFFIC_JAM','HORSE_MEDICAL') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `urgency` enum('NORMAL','HIGH') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NORMAL',
  `status` enum('NEW','ACKNOWLEDGED','CLOSED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NEW',
  `reported_by` bigint unsigned NOT NULL COMMENT 'FK -> users.id',
  `reported_at` datetime NOT NULL,
  `received_by` bigint unsigned DEFAULT NULL COMMENT 'FK -> users.id',
  `handling_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `closed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_incidents_trip_id` (`trip_id`),
  KEY `fk_incidents_leg_id` (`leg_id`),
  KEY `fk_incidents_horse_id` (`horse_id`),
  KEY `fk_incidents_reported_by` (`reported_by`),
  KEY `fk_incidents_received_by` (`received_by`),
  CONSTRAINT `fk_incidents_horse_id` FOREIGN KEY (`horse_id`) REFERENCES `horses` (`id`),
  CONSTRAINT `fk_incidents_leg_id` FOREIGN KEY (`leg_id`) REFERENCES `legs` (`id`),
  CONSTRAINT `fk_incidents_received_by` FOREIGN KEY (`received_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_incidents_reported_by` FOREIGN KEY (`reported_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_incidents_trip_id` FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Sự cố';
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
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_leg_milestones_leg_id_milestone_type` (`leg_id`,`milestone_type`),
  KEY `fk_leg_milestones_recorded_by` (`recorded_by`),
  CONSTRAINT `fk_leg_milestones_leg_id` FOREIGN KEY (`leg_id`) REFERENCES `legs` (`id`),
  CONSTRAINT `fk_leg_milestones_recorded_by` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Mốc sự kiện của chặng';
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
  `from_location_id` bigint unsigned NOT NULL COMMENT 'FK -> locations.id',
  `to_location_id` bigint unsigned NOT NULL COMMENT 'FK -> locations.id',
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
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Chặng của chuyến';
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
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_locations_name_country` (`name`,`country`)
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
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
) ENGINE=InnoDB AUTO_INCREMENT=52 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Thông báo';
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
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_orders_order_code` (`order_code`),
  UNIQUE KEY `uq_orders_client_request` (`customer_id`,`client_request_id`),
  KEY `fk_orders_reviewed_by` (`reviewed_by`),
  CONSTRAINT `fk_orders_customer_id` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_orders_reviewed_by` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Đơn vận chuyển';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `quarantine_rule_doctypes`
--

DROP TABLE IF EXISTS `quarantine_rule_doctypes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quarantine_rule_doctypes` (
  `rule_id` bigint unsigned NOT NULL COMMENT 'FK -> quarantine_rules.id',
  `document_type_id` bigint unsigned NOT NULL COMMENT 'FK -> document_types.id',
  PRIMARY KEY (`rule_id`,`document_type_id`),
  KEY `fk_qrd_document_type_id` (`document_type_id`),
  CONSTRAINT `fk_qrd_document_type_id` FOREIGN KEY (`document_type_id`) REFERENCES `document_types` (`id`),
  CONSTRAINT `fk_qrd_rule_id` FOREIGN KEY (`rule_id`) REFERENCES `quarantine_rules` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng trung gian: quy định - loại giấy tờ';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `quarantine_rules`
--

DROP TABLE IF EXISTS `quarantine_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quarantine_rules` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `origin_country` char(2) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `destination_country` char(2) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `border_location_id` bigint unsigned DEFAULT NULL COMMENT 'FK -> locations.id',
  `authority_id` bigint unsigned DEFAULT NULL COMMENT 'FK -> authorities.id',
  `updated_by` bigint unsigned NOT NULL COMMENT 'FK -> users.id',
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_quarantine_rules_pair` (`origin_country`,`destination_country`,`border_location_id`),
  KEY `fk_quarantine_rules_border_location_id` (`border_location_id`),
  KEY `fk_quarantine_rules_authority_id` (`authority_id`),
  KEY `fk_quarantine_rules_updated_by` (`updated_by`),
  CONSTRAINT `fk_quarantine_rules_authority_id` FOREIGN KEY (`authority_id`) REFERENCES `authorities` (`id`),
  CONSTRAINT `fk_quarantine_rules_border_location_id` FOREIGN KEY (`border_location_id`) REFERENCES `locations` (`id`),
  CONSTRAINT `fk_quarantine_rules_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Quy định kiểm dịch theo cặp quốc gia';
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
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_trip_assignments_trip_id_user_id` (`trip_id`,`user_id`),
  KEY `fk_trip_assignments_user_id` (`user_id`),
  KEY `fk_trip_assignments_assigned_by` (`assigned_by`),
  CONSTRAINT `fk_trip_assignments_assigned_by` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_trip_assignments_trip_id` FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`),
  CONSTRAINT `fk_trip_assignments_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Phân công Driver/Escort cho chuyến';
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
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_trips_order_id` (`order_id`),
  KEY `fk_trips_planned_by` (`planned_by`),
  KEY `fk_trips_approved_by` (`approved_by`),
  CONSTRAINT `fk_trips_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_trips_order_id` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  CONSTRAINT `fk_trips_planned_by` FOREIGN KEY (`planned_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Chuyến, sinh ra từ đơn đã duyệt';
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
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Người dùng: 5 vai nội bộ (Admin, Manager, Specialist, Coordinator, Driver/Escort) và Customer (gộp hồ sơ khách hàng)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `crew_profiles`
--

DROP TABLE IF EXISTS `crew_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `crew_profiles` (
  `user_id` bigint unsigned NOT NULL,
  `crew_type` enum('DRIVER','ESCORT') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `work_status` enum('AVAILABLE','IN_TRIP') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'AVAILABLE',
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_crew_profiles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Hồ sơ tài xế/người hộ tống';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `vehicles`
--

DROP TABLE IF EXISTS `vehicles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vehicles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `vehicle_type` enum('LIGHT','MEDIUM','HEAVY') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `capacity_stalls` int NOT NULL,
  `license_plate` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('AVAILABLE','RESERVED','IN_TRANSIT') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'AVAILABLE',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vehicles_license_plate` (`license_plate`),
  CONSTRAINT `ck_vehicles_capacity` CHECK ((`capacity_stalls` > 0))
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Phương tiện';
/*!40101 SET character_set_client = @saved_cs_client */;
SET @@SESSION.SQL_LOG_BIN = @MYSQLDUMP_TEMP_LOG_BIN;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-17 11:31:01
