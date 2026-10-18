package com.rnave.studily.parse;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

public final class AiBudget {

    private AiBudget() {
    }

    public static double usd(List<CourseParseUsageRepository.ModelSpend> spend) {
        return spend.stream()
                .mapToDouble(s -> ParsePricing.usd(s.getModel(),
                        s.getInputTokens() == null ? 0 : s.getInputTokens(),
                        s.getOutputTokens() == null ? 0 : s.getOutputTokens()))
                .sum();
    }

    public static Instant dayStart(ZoneId zone) {
        return ZonedDateTime.now(zone).toLocalDate().atStartOfDay(zone).toInstant();
    }

    public static Instant monthStart(ZonedDateTime now) {
        return now.toLocalDate().withDayOfMonth(1).atStartOfDay(now.getZone()).toInstant();
    }
}
