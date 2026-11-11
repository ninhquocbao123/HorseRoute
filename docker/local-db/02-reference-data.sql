-- Dữ liệu nền mà migration của code tự tạo: danh sách migration đã chạy, 3 loại giấy tờ bắt buộc, tham số hệ thống, bảng giá mặc định.
-- Sinh từ database trống dựng bằng pnpm db:setup ngày 11/11/2026.

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

LOCK TABLES `migrations` WRITE;
/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
INSERT INTO `migrations` (`id`, `timestamp`, `name`) VALUES (1,1700000000000,'Init1700000000000'),(2,1800000001000,'OrderDrafts1800000001000'),(3,1800000002000,'SystemAudit1800000002000'),(4,1800000003000,'DropFirebaseUid1800000003000'),(5,1800000004000,'OrderRequirements1800000004000'),(6,1800000005000,'LocationCoordinates1800000005000'),(7,1800000006000,'TrackMap1800000006000'),(8,1800000007000,'PricingVersions1800000007000'),(9,1800000007000,'DriverIncidentDetails1800000007000'),(10,1800000008000,'ManagerQuotes1800000008000'),(11,1800000008000,'HotlineParam1800000008000'),(12,1800000009000,'VmaxParam1800000009000'),(13,1800000009000,'CustomerProfiles1800000009000'),(14,1800000010000,'SpecialistAssessments1800000010000'),(15,1800000010000,'RouteCacheFull1800000010000'),(16,1800000011000,'RemoveQuarantineRules1800000011000'),(17,1800000012000,'PaymentSimulation1800000012000'),(18,1800000013000,'TripRoutePlan1800000013000'),(19,1800000013000,'EscortHorseCare1800000013000'),(20,1800000015000,'TripFleet1800000015000'),(21,1800000016000,'RepresentativeTripLeg1800000016000'),(22,1800000017000,'LegWaypointCheckins1800000017000'),(23,1800000018000,'CareActivityPhotos1800000018000'),(24,1800000019000,'IncidentResponses1800000019000'),(25,1800000090000,'AccountAvatars1800000090000'),(26,1800000091000,'CrewReservations1800000091000'),(27,1800000092000,'ClientRequestIds1800000092000'),(28,1800000093000,'DeliveryExceptions1800000093000');
/*!40000 ALTER TABLE `migrations` ENABLE KEYS */;
UNLOCK TABLES;

LOCK TABLES `document_types` WRITE;
/*!40000 ALTER TABLE `document_types` DISABLE KEYS */;
INSERT INTO `document_types` (`id`, `name`, `has_expiry`, `description`) VALUES (1,'Hộ chiếu ngựa',0,'Giấy tờ bắt buộc cho mỗi ngựa'),(2,'Giấy chứng nhận tiêm phòng cúm ngựa',1,'Giấy tờ bắt buộc cho mỗi ngựa'),(3,'Kết quả xét nghiệm EIA (Coggins)',1,'Giấy tờ bắt buộc cho mỗi ngựa');
/*!40000 ALTER TABLE `document_types` ENABLE KEYS */;
UNLOCK TABLES;

LOCK TABLES `system_parameters` WRITE;
/*!40000 ALTER TABLE `system_parameters` DISABLE KEYS */;
INSERT INTO `system_parameters` (`param_code`, `param_value`, `description`) VALUES ('HOTLINE','1900 1080','Số cứu hộ 24/7 hiển thị ở màn báo sự cố'),('VMAX','80','Giới hạn tốc độ (km/h) hiển thị ở màn tài xế');
/*!40000 ALTER TABLE `system_parameters` ENABLE KEYS */;
UNLOCK TABLES;

LOCK TABLES `pricing_versions` WRITE;
/*!40000 ALTER TABLE `pricing_versions` DISABLE KEYS */;
INSERT INTO `pricing_versions` (`id`, `title`, `note`, `status`, `revision`, `config`, `effective_from`, `published_at`, `created_by`, `updated_by`, `published_by`, `created_at`, `updated_at`) VALUES (1,'Bảng giá khởi tạo từ HTML v7','Mức giá gốc từ bản HTML v7. Cước cơ bản chưa gồm nhân sự, nhiên liệu và cữ nước; dự toán sẽ cộng riêng các khoản này.','PUBLISHED',1,'{\"fees\": {\"crewPerDay\": 1890000, \"fuelPer100Km\": 992000, \"water1hPerHorse\": 100000, \"water2hPerHorse\": 50000, \"sportFeedPerHorse\": 500000, \"extraStallPerHorse\": 1500000, \"premiumFeedPerHorse\": 300000, \"internationalPerTrip\": 300000}, \"currency\": \"VND\", \"insurance\": {\"OTHER\": 8000000, \"ARABIAN\": 16000000, \"APPALOOSA\": 10000000, \"WARMBLOOD\": 18000000, \"THOROUGHBRED\": 20000000, \"QUARTER_HORSE\": 12000000}, \"distanceRates\": [{\"km\": 50, \"heavy\": 8579000, \"light\": 4515000, \"medium\": 6321000}, {\"km\": 150, \"heavy\": 13766000, \"light\": 7245000, \"medium\": 10143000}, {\"km\": 300, \"heavy\": 21546000, \"light\": 11340000, \"medium\": 15876000}, {\"km\": 600, \"heavy\": 33516000, \"light\": 17640000, \"medium\": 24696000}, {\"km\": 1000, \"heavy\": 45486000, \"light\": 23940000, \"medium\": 33516000}, {\"km\": 1500, \"heavy\": 60449000, \"light\": 31815000, \"medium\": 44541000}], \"depositPercent\": 30, \"quoteValidityHours\": 24}','2026-11-11 12:59:13.007','2026-11-11 12:59:13.007',NULL,NULL,NULL,'2026-11-11 12:59:13.007','2026-11-11 12:59:13.007');
/*!40000 ALTER TABLE `pricing_versions` ENABLE KEYS */;
UNLOCK TABLES;

LOCK TABLES `pricing_publish_lock` WRITE;
/*!40000 ALTER TABLE `pricing_publish_lock` DISABLE KEYS */;
INSERT INTO `pricing_publish_lock` (`id`) VALUES (1);
/*!40000 ALTER TABLE `pricing_publish_lock` ENABLE KEYS */;
UNLOCK TABLES;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

