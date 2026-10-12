CREATE TABLE users (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email                  VARCHAR(100) NOT NULL,
  password_hash          VARCHAR(255) NOT NULL,
  full_name              VARCHAR(100) NOT NULL,
  phone                  VARCHAR(20) NULL,
  role                   ENUM('ADMIN','MANAGER','SPECIALIST','COORDINATOR','DRIVER_ESCORT','CUSTOMER') NOT NULL,
  account_status         ENUM('ACTIVE','LOCKED','PENDING') NOT NULL,
  organization_name      VARCHAR(150) NULL,
  customer_type          ENUM('CLUB','INDIVIDUAL') NULL,
  address                VARCHAR(255) NULL,
  created_at             DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Người dùng: 5 vai nội bộ (Admin, Manager, Specialist, Coordinator, Driver/Escort) và Customer (gộp hồ sơ khách hàng)';

CREATE TABLE system_parameters (
  param_code             VARCHAR(10) NOT NULL,
  param_value            VARCHAR(50) NULL,
  description            VARCHAR(255) NULL,
  PRIMARY KEY (param_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tham số hệ thống (L, D, N, S, T...)';

CREATE TABLE orders (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_code             VARCHAR(20) NOT NULL,
  customer_id            BIGINT UNSIGNED NOT NULL COMMENT 'FK -> users.id',
  origin_address         VARCHAR(255) NOT NULL,
  origin_country         CHAR(2) NOT NULL,
  destination_address    VARCHAR(255) NOT NULL,
  destination_country    CHAR(2) NOT NULL,
  desired_departure_date DATE NOT NULL,
  special_requirements   TEXT NULL,
  status                 ENUM('DRAFT','PENDING','NEED_INFO','REJECTED','APPROVED','PREPARING','READY','IN_TRANSIT','DELIVERED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  manager_note           TEXT NULL,
  reviewed_by            BIGINT UNSIGNED NULL COMMENT 'FK -> users.id',
  reviewed_at            DATETIME NULL,
  response_deadline      DATETIME NULL,
  created_at             DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  submitted_at           DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_order_code (order_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Đơn vận chuyển';

CREATE TABLE horses (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id               BIGINT UNSIGNED NOT NULL COMMENT 'FK -> orders.id',
  owner_id               BIGINT UNSIGNED NOT NULL COMMENT 'FK -> users.id',
  name                   VARCHAR(100) NOT NULL,
  passport_no            VARCHAR(50) NOT NULL,
  order_status           ENUM('NORMAL','FLAGGED','REMOVED') NOT NULL DEFAULT 'NORMAL',
  note                   VARCHAR(255) NULL,
  breed                  VARCHAR(50) NULL,
  birth_date             DATE NULL,
  sex                    VARCHAR(10) NULL,
  coat_color             VARCHAR(30) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_horses_passport_no (passport_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Ngựa; mỗi ngựa thuộc đúng một đơn';

CREATE TABLE document_types (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name                   VARCHAR(100) NOT NULL,
  has_expiry             BOOLEAN NOT NULL DEFAULT 0,
  description            VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_document_types_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Danh mục loại giấy tờ';

CREATE TABLE authorities (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name                   VARCHAR(150) NOT NULL,
  authority_type         ENUM('AGRICULTURE','CUSTOMS','QUARANTINE') NOT NULL,
  country                CHAR(2) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_authorities_name_country (name, country)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cơ quan chức năng (không đăng nhập)';

CREATE TABLE quarantine_rules (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  origin_country         CHAR(2) NOT NULL,
  destination_country    CHAR(2) NOT NULL,
  border_location_id     BIGINT UNSIGNED NULL COMMENT 'FK -> locations.id',
  authority_id           BIGINT UNSIGNED NULL COMMENT 'FK -> authorities.id',
  updated_by             BIGINT UNSIGNED NOT NULL COMMENT 'FK -> users.id',
  updated_at             DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_quarantine_rules_pair (origin_country, destination_country, border_location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Quy định kiểm dịch theo cặp quốc gia';

CREATE TABLE quarantine_rule_doctypes (
  rule_id                BIGINT UNSIGNED NOT NULL COMMENT 'FK -> quarantine_rules.id',
  document_type_id       BIGINT UNSIGNED NOT NULL COMMENT 'FK -> document_types.id',
  PRIMARY KEY (rule_id, document_type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng trung gian: quy định - loại giấy tờ';

CREATE TABLE documents (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  horse_id               BIGINT UNSIGNED NOT NULL COMMENT 'FK -> horses.id',
  document_type_id       BIGINT UNSIGNED NOT NULL COMMENT 'FK -> document_types.id',
  status                 ENUM('NOT_SUBMITTED','SUBMITTED','VALID','INVALID','EXPIRED') NOT NULL DEFAULT 'NOT_SUBMITTED',
  expiry_date            DATE NULL,
  invalid_reason         VARCHAR(255) NULL,
  reviewed_by            BIGINT UNSIGNED NULL COMMENT 'FK -> users.id',
  reviewed_at            DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_documents_horse_id_document_type_id (horse_id, document_type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Giấy tờ của từng ngựa (checklist)';

CREATE TABLE document_versions (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  document_id            BIGINT UNSIGNED NOT NULL COMMENT 'FK -> documents.id',
  version_no             INT NOT NULL,
  attachment_id          BIGINT UNSIGNED NOT NULL COMMENT 'FK -> attachments.id',
  uploaded_by            BIGINT UNSIGNED NOT NULL COMMENT 'FK -> users.id',
  uploaded_at            DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_document_versions_attachment_id (attachment_id),
  UNIQUE KEY uq_document_versions_document_id_version_no (document_id, version_no),
  CONSTRAINT ck_document_versions_version_no CHECK (version_no >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Phiên bản upload của giấy tờ';

CREATE TABLE dossiers (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  horse_id               BIGINT UNSIGNED NOT NULL COMMENT 'FK -> horses.id',
  authority_id           BIGINT UNSIGNED NOT NULL COMMENT 'FK -> authorities.id',
  status                 ENUM('NOT_SUBMITTED','SUBMITTED','REVIEWING','NEED_INFO','APPROVED','REJECTED') NOT NULL DEFAULT 'NOT_SUBMITTED',
  submitted_at           DATETIME NULL,
  receipt_code           VARCHAR(50) NULL,
  result_at              DATETIME NULL,
  result                 VARCHAR(255) NULL,
  rejection_reason       VARCHAR(255) NULL,
  permit_attachment_id   BIGINT UNSIGNED NULL COMMENT 'FK -> attachments.id',
  specialist_id          BIGINT UNSIGNED NULL COMMENT 'FK -> users.id',
  PRIMARY KEY (id),
  UNIQUE KEY uq_dossiers_permit_attachment_id (permit_attachment_id),
  UNIQUE KEY uq_dossiers_horse_id_authority_id (horse_id, authority_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Hồ sơ nộp cơ quan, theo ngựa và cơ quan';

CREATE TABLE vehicles (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  vehicle_type           ENUM('TRUCK','AIRCRAFT_HOLD','CRATE') NOT NULL,
  capacity_stalls        INT NOT NULL,
  plate_or_code          VARCHAR(30) NOT NULL,
  is_active              BOOLEAN NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vehicles_plate_or_code (plate_or_code),
  CONSTRAINT ck_vehicles_capacity CHECK (capacity_stalls > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Phương tiện';

CREATE TABLE locations (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name                   VARCHAR(150) NOT NULL,
  location_type          ENUM('BORDER','QUARANTINE_STATION','REST_STOP','AIRPORT','FUEL_STOP') NOT NULL,
  country                CHAR(2) NOT NULL,
  timezone               VARCHAR(50) NOT NULL,
  address                VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_locations_name_country (name, country)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Danh mục điểm (cửa khẩu, trạm, sân bay...)';

CREATE TABLE carriers (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name                   VARCHAR(100) NOT NULL,
  iata_code              VARCHAR(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_carriers_iata_code (iata_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Hãng hàng không';

CREATE TABLE trips (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id               BIGINT UNSIGNED NOT NULL COMMENT 'FK -> orders.id',
  plan_status            ENUM('DRAFT','PENDING_APPROVAL','APPROVED') NOT NULL DEFAULT 'DRAFT',
  planned_departure_at   DATETIME NULL,
  planned_arrival_at     DATETIME NULL,
  planned_by             BIGINT UNSIGNED NOT NULL COMMENT 'FK -> users.id',
  approved_by            BIGINT UNSIGNED NULL COMMENT 'FK -> users.id',
  approved_at            DATETIME NULL,
  return_reason          VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_trips_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Chuyến, sinh ra từ đơn đã duyệt';

CREATE TABLE trip_assignments (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  trip_id                BIGINT UNSIGNED NOT NULL COMMENT 'FK -> trips.id',
  user_id                BIGINT UNSIGNED NOT NULL COMMENT 'FK -> users.id',
  role                   ENUM('DRIVER','ESCORT') NOT NULL,
  assigned_by            BIGINT UNSIGNED NOT NULL COMMENT 'FK -> users.id',
  assigned_at            DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_trip_assignments_trip_id_user_id (trip_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Phân công Driver/Escort cho chuyến';

CREATE TABLE legs (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  trip_id                BIGINT UNSIGNED NOT NULL COMMENT 'FK -> trips.id',
  seq_no                 INT NOT NULL,
  from_location_id       BIGINT UNSIGNED NOT NULL COMMENT 'FK -> locations.id',
  to_location_id         BIGINT UNSIGNED NOT NULL COMMENT 'FK -> locations.id',
  vehicle_id             BIGINT UNSIGNED NULL COMMENT 'FK -> vehicles.id',
  carrier_id             BIGINT UNSIGNED NULL COMMENT 'FK -> carriers.id',
  planned_departure_at   DATETIME NOT NULL,
  planned_arrival_at     DATETIME NOT NULL,
  status                 ENUM('NOT_STARTED','MOVING','AT_STOP','COMPLETED') NOT NULL DEFAULT 'NOT_STARTED',
  actual_departure_at    DATETIME NULL,
  actual_arrival_at      DATETIME NULL,
  updated_by             BIGINT UNSIGNED NULL COMMENT 'FK -> users.id',
  updated_at             DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_legs_trip_id_seq_no (trip_id, seq_no),
  CONSTRAINT ck_legs_seq_no CHECK (seq_no >= 1),
  CONSTRAINT ck_legs_planned_time CHECK (planned_arrival_at >= planned_departure_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Chặng của chuyến';

CREATE TABLE leg_milestones (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  leg_id                 BIGINT UNSIGNED NOT NULL COMMENT 'FK -> legs.id',
  milestone_type         ENUM('DEPARTED','ARRIVED_AT_STOP','CUSTOMS_CLEARED','DELIVERED') NOT NULL,
  occurred_at            DATETIME NOT NULL,
  recorded_by            BIGINT UNSIGNED NOT NULL COMMENT 'FK -> users.id',
  PRIMARY KEY (id),
  UNIQUE KEY uq_leg_milestones_leg_id_milestone_type (leg_id, milestone_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Mốc sự kiện của chặng';

CREATE TABLE horse_logs (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  horse_id               BIGINT UNSIGNED NOT NULL COMMENT 'FK -> horses.id',
  leg_id                 BIGINT UNSIGNED NOT NULL COMMENT 'FK -> legs.id',
  condition_status       ENUM('STABLE','OFF_FEED','STRESSED','CLIMATE_CHANGE') NOT NULL,
  note                   TEXT NULL,
  logged_at              DATETIME NOT NULL,
  created_by             BIGINT UNSIGNED NOT NULL COMMENT 'FK -> users.id',
  corrects_log_id        BIGINT UNSIGNED NULL COMMENT 'FK -> horse_logs.id',
  PRIMARY KEY (id),
  KEY idx_horse_logs_horse_logged_at (horse_id, logged_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Nhật ký tình trạng ngựa (chỉ thêm mới)';

CREATE TABLE incidents (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  trip_id                BIGINT UNSIGNED NOT NULL COMMENT 'FK -> trips.id',
  leg_id                 BIGINT UNSIGNED NULL COMMENT 'FK -> legs.id',
  horse_id               BIGINT UNSIGNED NULL COMMENT 'FK -> horses.id',
  incident_type          ENUM('VEHICLE_BREAKDOWN','LONG_TRAFFIC_JAM','HORSE_MEDICAL') NOT NULL,
  description            TEXT NOT NULL,
  urgency                ENUM('NORMAL','HIGH') NOT NULL DEFAULT 'NORMAL',
  status                 ENUM('NEW','ACKNOWLEDGED','CLOSED') NOT NULL DEFAULT 'NEW',
  reported_by            BIGINT UNSIGNED NOT NULL COMMENT 'FK -> users.id',
  reported_at            DATETIME NOT NULL,
  received_by            BIGINT UNSIGNED NULL COMMENT 'FK -> users.id',
  handling_note          TEXT NULL,
  closed_at              DATETIME NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Sự cố';

CREATE TABLE alerts (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  trip_id                BIGINT UNSIGNED NOT NULL COMMENT 'FK -> trips.id',
  alert_type             ENUM('TRAFFIC','WEATHER','BORDER') NOT NULL,
  content                TEXT NOT NULL,
  sent_by                BIGINT UNSIGNED NOT NULL COMMENT 'FK -> users.id',
  sent_at                DATETIME NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cảnh báo thủ công';

CREATE TABLE attachments (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  original_name          VARCHAR(255) NOT NULL,
  file_type              ENUM('PDF','JPG','PNG') NOT NULL,
  size_bytes             BIGINT UNSIGNED NOT NULL,
  storage_path           VARCHAR(500) NOT NULL,
  uploaded_by            BIGINT UNSIGNED NOT NULL COMMENT 'FK -> users.id',
  uploaded_at            DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  horse_log_id           BIGINT UNSIGNED NULL COMMENT 'FK -> horse_logs.id',
  incident_id            BIGINT UNSIGNED NULL COMMENT 'FK -> incidents.id',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tệp đính kèm; thân tệp lưu ngoài CSDL';

CREATE TABLE notifications (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  recipient_id           BIGINT UNSIGNED NOT NULL COMMENT 'FK -> users.id',
  event_type             VARCHAR(50) NOT NULL,
  content                VARCHAR(500) NOT NULL,
  related_type           VARCHAR(30) NULL,
  related_id             BIGINT UNSIGNED NULL,
  channel                ENUM('IN_APP','EMAIL','SMS') NULL,
  is_read                BOOLEAN NOT NULL DEFAULT 0,
  created_at             DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (id),
  KEY idx_notifications_recipient_read (recipient_id, is_read, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Thông báo';

CREATE TABLE audit_logs (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id               BIGINT UNSIGNED NOT NULL COMMENT 'FK -> users.id',
  occurred_at            DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  entity_type            VARCHAR(30) NOT NULL,
  entity_id              BIGINT UNSIGNED NOT NULL,
  action                 VARCHAR(50) NOT NULL,
  old_value              TEXT NULL,
  new_value              TEXT NULL,
  reason                 VARCHAR(255) NULL,
  PRIMARY KEY (id),
  KEY idx_audit_logs_entity (entity_type, entity_id),
  KEY idx_audit_logs_occurred_at (occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Nhật ký kiểm toán (chỉ thêm mới)';

ALTER TABLE orders
  ADD CONSTRAINT fk_orders_customer_id FOREIGN KEY (customer_id) REFERENCES users (id),
  ADD CONSTRAINT fk_orders_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users (id);

ALTER TABLE horses
  ADD CONSTRAINT fk_horses_order_id FOREIGN KEY (order_id) REFERENCES orders (id),
  ADD CONSTRAINT fk_horses_owner_id FOREIGN KEY (owner_id) REFERENCES users (id);

ALTER TABLE quarantine_rules
  ADD CONSTRAINT fk_quarantine_rules_border_location_id FOREIGN KEY (border_location_id) REFERENCES locations (id),
  ADD CONSTRAINT fk_quarantine_rules_authority_id FOREIGN KEY (authority_id) REFERENCES authorities (id),
  ADD CONSTRAINT fk_quarantine_rules_updated_by FOREIGN KEY (updated_by) REFERENCES users (id);

ALTER TABLE quarantine_rule_doctypes
  ADD CONSTRAINT fk_qrd_rule_id FOREIGN KEY (rule_id) REFERENCES quarantine_rules (id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_qrd_document_type_id FOREIGN KEY (document_type_id) REFERENCES document_types (id);

ALTER TABLE documents
  ADD CONSTRAINT fk_documents_horse_id FOREIGN KEY (horse_id) REFERENCES horses (id),
  ADD CONSTRAINT fk_documents_document_type_id FOREIGN KEY (document_type_id) REFERENCES document_types (id),
  ADD CONSTRAINT fk_documents_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users (id);

ALTER TABLE document_versions
  ADD CONSTRAINT fk_document_versions_document_id FOREIGN KEY (document_id) REFERENCES documents (id),
  ADD CONSTRAINT fk_document_versions_attachment_id FOREIGN KEY (attachment_id) REFERENCES attachments (id),
  ADD CONSTRAINT fk_document_versions_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users (id);

ALTER TABLE dossiers
  ADD CONSTRAINT fk_dossiers_horse_id FOREIGN KEY (horse_id) REFERENCES horses (id),
  ADD CONSTRAINT fk_dossiers_authority_id FOREIGN KEY (authority_id) REFERENCES authorities (id),
  ADD CONSTRAINT fk_dossiers_permit_attachment_id FOREIGN KEY (permit_attachment_id) REFERENCES attachments (id),
  ADD CONSTRAINT fk_dossiers_specialist_id FOREIGN KEY (specialist_id) REFERENCES users (id);

ALTER TABLE trips
  ADD CONSTRAINT fk_trips_order_id FOREIGN KEY (order_id) REFERENCES orders (id),
  ADD CONSTRAINT fk_trips_planned_by FOREIGN KEY (planned_by) REFERENCES users (id),
  ADD CONSTRAINT fk_trips_approved_by FOREIGN KEY (approved_by) REFERENCES users (id);

ALTER TABLE trip_assignments
  ADD CONSTRAINT fk_trip_assignments_trip_id FOREIGN KEY (trip_id) REFERENCES trips (id),
  ADD CONSTRAINT fk_trip_assignments_user_id FOREIGN KEY (user_id) REFERENCES users (id),
  ADD CONSTRAINT fk_trip_assignments_assigned_by FOREIGN KEY (assigned_by) REFERENCES users (id);

ALTER TABLE legs
  ADD CONSTRAINT fk_legs_trip_id FOREIGN KEY (trip_id) REFERENCES trips (id),
  ADD CONSTRAINT fk_legs_from_location_id FOREIGN KEY (from_location_id) REFERENCES locations (id),
  ADD CONSTRAINT fk_legs_to_location_id FOREIGN KEY (to_location_id) REFERENCES locations (id),
  ADD CONSTRAINT fk_legs_vehicle_id FOREIGN KEY (vehicle_id) REFERENCES vehicles (id),
  ADD CONSTRAINT fk_legs_carrier_id FOREIGN KEY (carrier_id) REFERENCES carriers (id),
  ADD CONSTRAINT fk_legs_updated_by FOREIGN KEY (updated_by) REFERENCES users (id);

ALTER TABLE leg_milestones
  ADD CONSTRAINT fk_leg_milestones_leg_id FOREIGN KEY (leg_id) REFERENCES legs (id),
  ADD CONSTRAINT fk_leg_milestones_recorded_by FOREIGN KEY (recorded_by) REFERENCES users (id);

ALTER TABLE horse_logs
  ADD CONSTRAINT fk_horse_logs_horse_id FOREIGN KEY (horse_id) REFERENCES horses (id),
  ADD CONSTRAINT fk_horse_logs_leg_id FOREIGN KEY (leg_id) REFERENCES legs (id),
  ADD CONSTRAINT fk_horse_logs_created_by FOREIGN KEY (created_by) REFERENCES users (id),
  ADD CONSTRAINT fk_horse_logs_corrects_log_id FOREIGN KEY (corrects_log_id) REFERENCES horse_logs (id);

ALTER TABLE incidents
  ADD CONSTRAINT fk_incidents_trip_id FOREIGN KEY (trip_id) REFERENCES trips (id),
  ADD CONSTRAINT fk_incidents_leg_id FOREIGN KEY (leg_id) REFERENCES legs (id),
  ADD CONSTRAINT fk_incidents_horse_id FOREIGN KEY (horse_id) REFERENCES horses (id),
  ADD CONSTRAINT fk_incidents_reported_by FOREIGN KEY (reported_by) REFERENCES users (id),
  ADD CONSTRAINT fk_incidents_received_by FOREIGN KEY (received_by) REFERENCES users (id);

ALTER TABLE alerts
  ADD CONSTRAINT fk_alerts_trip_id FOREIGN KEY (trip_id) REFERENCES trips (id),
  ADD CONSTRAINT fk_alerts_sent_by FOREIGN KEY (sent_by) REFERENCES users (id);

ALTER TABLE attachments
  ADD CONSTRAINT fk_attachments_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users (id),
  ADD CONSTRAINT fk_attachments_horse_log_id FOREIGN KEY (horse_log_id) REFERENCES horse_logs (id),
  ADD CONSTRAINT fk_attachments_incident_id FOREIGN KEY (incident_id) REFERENCES incidents (id);

ALTER TABLE notifications
  ADD CONSTRAINT fk_notifications_recipient_id FOREIGN KEY (recipient_id) REFERENCES users (id);

ALTER TABLE audit_logs
  ADD CONSTRAINT fk_audit_logs_actor_id FOREIGN KEY (actor_id) REFERENCES users (id);