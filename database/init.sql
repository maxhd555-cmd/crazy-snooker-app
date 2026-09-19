-- ============================================================
-- Crazy Snooker App — schema รวมสำหรับ import ขึ้น Aiven MySQL
-- รันไฟล์นี้ไฟล์เดียวจบ (รวมทุกตาราง + ข้อมูลเริ่มต้น)
-- ============================================================

-- โต๊ะสนุ๊กเกอร์ + สถานะ real-time
CREATE TABLE IF NOT EXISTS club_tables (
  id VARCHAR(64) PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'available',
  customer_name VARCHAR(100) NULL,
  expected_end_at DATETIME NULL,
  near_end_alerted_for DATETIME NULL,
  near_end_alerted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_club_tables_near_end (status, expected_end_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- คิวแจ้งเตือนใกล้หมดเวลา (idempotent — กันส่งซ้ำ)
CREATE TABLE IF NOT EXISTS near_end_alerts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  table_id VARCHAR(64) NOT NULL,
  expected_end_at DATETIME NOT NULL,
  remaining_minutes INT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  attempt_count INT NOT NULL DEFAULT 0,
  attempted_at DATETIME NULL,
  delivered_at DATETIME NULL,
  last_error VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_near_end_alerts_table_end (table_id, expected_end_at),
  INDEX idx_near_end_alerts_dispatch (status, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- การตั้งค่า cron ภายนอกที่ยิง /api/scheduled/near-end-alerts
CREATE TABLE IF NOT EXISTS near_end_scheduler_config (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  schedule_task_uid VARCHAR(65) NULL,
  alert_window_minutes INT NOT NULL DEFAULT 10,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_near_end_scheduler_task_uid (schedule_task_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO near_end_scheduler_config (id, schedule_task_uid, alert_window_minutes)
VALUES (1, NULL, 10)
ON DUPLICATE KEY UPDATE id = VALUES(id);

-- ข้อเสนอแนะ/แจ้งปัญหาจากหน้า Help
CREATE TABLE IF NOT EXISTS feedback_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  category VARCHAR(32) NOT NULL,
  message TEXT NOT NULL,
  contact VARCHAR(320) NULL,
  current_view VARCHAR(64) NOT NULL DEFAULT 'unknown',
  status VARCHAR(32) NOT NULL DEFAULT 'new',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_feedback_reports_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- บันทึกภายในของแอดมินต่อรายงาน
CREATE TABLE IF NOT EXISTS feedback_internal_notes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  feedback_id BIGINT UNSIGNED NOT NULL,
  note_body TEXT NOT NULL,
  author_context VARCHAR(100) NOT NULL DEFAULT 'ผู้ดูแลระบบ',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_feedback_internal_notes_feedback_created (feedback_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ข้อมูลโต๊ะเริ่มต้น (ปรับ label ตามร้านจริงได้)
INSERT INTO club_tables (id, label, status, customer_name, expected_end_at)
VALUES
  ('t1', 'โต๊ะ 01 VIP', 'occupied', 'คุณธนา', NULL),
  ('t2', 'โต๊ะ 02', 'available', NULL, NULL),
  ('t3', 'โต๊ะ 03', 'occupied', 'คุณวิชัย', NULL),
  ('t4', 'โต๊ะ 04', 'reserved', 'คุณมณี', NULL),
  ('t5', 'โต๊ะ 05', 'maintenance', NULL, NULL)
ON DUPLICATE KEY UPDATE label = VALUES(label);
