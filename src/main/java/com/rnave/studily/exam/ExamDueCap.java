package com.rnave.studily.exam;

import java.time.Instant;
import java.time.ZoneId;

public final class ExamDueCap {

    private ExamDueCap() {
    }

    public static Instant apply(Instant dueAt, Instant now, Instant examAt, ZoneId zone) {
        if (examAt == null || !examAt.isAfter(now)) {
            return dueAt;
        }
        Instant dayBefore = examAt.atZone(zone).toLocalDate().minusDays(1).atStartOfDay(zone).toInstant();
        if (!dueAt.isAfter(dayBefore)) {
            return dueAt;
        }
        return dayBefore.isBefore(now) ? now : dayBefore;
    }
}
