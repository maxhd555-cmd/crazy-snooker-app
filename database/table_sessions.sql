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
);

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
);

CREATE TABLE IF NOT EXISTS near_end_scheduler_config (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  schedule_task_uid VARCHAR(65) NULL,
  alert_window_minutes INT NOT NULL DEFAULT 10,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_near_end_scheduler_task_uid (schedule_task_uid)
);

INSERT INTO near_end_scheduler_config (id, schedule_task_uid, alert_window_minutes)
VALUES (1, NULL, 10)
ON DUPLICATE KEY UPDATE id = VALUES(id);

INSERT INTO club_tables (id, label, status, customer_name, expected_end_at)
VALUES
  ('t1', 'โต๊ะ 01 VIP', 'occupied', 'คุณธนา', NULL),
  ('t2', 'โต๊ะ 02', 'available', NULL, NULL),
  ('t3', 'โต๊ะ 03', 'occupied', 'คุณวิชัย', NULL),
  ('t4', 'โต๊ะ 04', 'reserved', 'คุณมณี', NULL),
  ('t5', 'โต๊ะ 05', 'maintenance', NULL, NULL)
ON DUPLICATE KEY UPDATE
  label = VALUES(label);
