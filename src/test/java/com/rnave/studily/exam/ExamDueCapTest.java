package com.rnave.studily.exam;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

class ExamDueCapTest {

    private static final ZoneId ZONE = ZoneId.of("America/Toronto");
    private static final Instant NOW = Instant.parse("2026-10-20T14:00:00Z");
    private static final Instant EXAM = Instant.parse("2026-10-25T18:00:00Z");
    private static final Instant DAY_BEFORE_START = Instant.parse("2026-10-24T04:00:00Z");

    @Test
    void capsADueDateInsideTheFinalDaysToTheStartOfTheDayBeforeTheExam() {
        Instant due = Instant.parse("2026-10-25T10:00:00Z");

        assertThat(ExamDueCap.apply(due, NOW, EXAM, ZONE)).isEqualTo(DAY_BEFORE_START);
    }

    @Test
    void leavesAnEarlierDueDateAlone() {
        Instant due = Instant.parse("2026-10-22T10:00:00Z");

        assertThat(ExamDueCap.apply(due, NOW, EXAM, ZONE)).isEqualTo(due);
    }

    @Test
    void pullsADueDateAfterTheExamBackToTheDayBefore() {
        Instant due = Instant.parse("2026-11-20T10:00:00Z");

        assertThat(ExamDueCap.apply(due, NOW, EXAM, ZONE)).isEqualTo(DAY_BEFORE_START);
    }

    @Test
    void doesNothingWithoutAnUpcomingExam() {
        Instant due = Instant.parse("2026-10-25T10:00:00Z");

        assertThat(ExamDueCap.apply(due, NOW, null, ZONE)).isEqualTo(due);
        assertThat(ExamDueCap.apply(due, NOW, NOW.minusSeconds(60), ZONE)).isEqualTo(due);
    }

    @Test
    void neverSchedulesEarlierThanNow() {
        Instant now = Instant.parse("2026-10-24T15:00:00Z");
        Instant due = Instant.parse("2026-10-25T10:00:00Z");

        assertThat(ExamDueCap.apply(due, now, EXAM, ZONE)).isEqualTo(now);
    }

    @Test
    void usesTheUsersTimeZoneForTheDayBoundary() {
        Instant due = Instant.parse("2026-10-25T10:00:00Z");

        Instant tokyo = ExamDueCap.apply(due, NOW, EXAM, ZoneId.of("Asia/Tokyo"));

        assertThat(tokyo).isEqualTo(Instant.parse("2026-10-24T15:00:00Z"));
    }
}
