ALTER TABLE meeting_blocks ADD COLUMN location VARCHAR(255);

UPDATE meeting_blocks
SET location = (SELECT c.location FROM courses c WHERE c.id = meeting_blocks.course_id)
WHERE location IS NULL;
