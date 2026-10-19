ALTER TABLE notifications ALTER COLUMN message TYPE TEXT;

CREATE INDEX IF NOT EXISTS idx_academic_items_course_due ON academic_items (course_id, due_at);
CREATE INDEX IF NOT EXISTS idx_academic_items_due ON academic_items (due_at);
CREATE INDEX IF NOT EXISTS idx_courses_user ON courses (user_id);
CREATE INDEX IF NOT EXISTS idx_courses_semester ON courses (semester_id);
CREATE INDEX IF NOT EXISTS idx_meeting_blocks_course ON meeting_blocks (course_id);
CREATE INDEX IF NOT EXISTS idx_notes_course ON notes (course_id);
CREATE INDEX IF NOT EXISTS idx_semesters_user ON semesters (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON calendar_events (start_at);
