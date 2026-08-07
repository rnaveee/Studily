ALTER TABLE calendar_events ADD COLUMN external_uid VARCHAR(255);

CREATE UNIQUE INDEX ux_calendar_events_user_external_uid
    ON calendar_events (user_id, external_uid)
    WHERE external_uid IS NOT NULL;
