package com.rnave.studily.notification;

public enum NotificationType {
    DEADLINE_REMINDER(21_600),
    CLASS_REMINDER(2_700),
    EVENT_TODAY(21_600),
    ITEM_WEEK_AHEAD(86_400),
    EXAM_TODAY(21_600);

    private final int pushTtlSeconds;

    NotificationType(int pushTtlSeconds) {
        this.pushTtlSeconds = pushTtlSeconds;
    }

    public int pushTtlSeconds() {
        return pushTtlSeconds;
    }
}
