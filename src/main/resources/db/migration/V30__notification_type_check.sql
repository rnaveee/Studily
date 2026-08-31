ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
        'DEADLINE_REMINDER',
        'CLASS_REMINDER',
        'EVENT_TODAY',
        'ITEM_WEEK_AHEAD',
        'EXAM_TODAY',
        'ANNOUNCEMENT'));
