CREATE TABLE IF NOT EXISTS feedback_internal_notes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  feedback_id BIGINT UNSIGNED NOT NULL,
  note_body TEXT NOT NULL,
  author_context VARCHAR(100) NOT NULL DEFAULT 'ผู้ดูแลระบบ',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_feedback_internal_notes_feedback_created (feedback_id, created_at)
);
