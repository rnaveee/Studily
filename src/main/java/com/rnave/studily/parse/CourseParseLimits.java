package com.rnave.studily.parse;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.TooManyRequestsException;
import com.rnave.studily.user.UserTimeZones;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;

@Component
public class CourseParseLimits {

    private final CourseParseUsageRepository usageRepository;
    private final CurrentUser currentUser;
    private final UserTimeZones timeZones;
    private final int monthlyLimit;
    private final double dailyBudgetUsd;
    private final Instant quotaResetAt;

    public CourseParseLimits(CourseParseUsageRepository usageRepository,
                             CurrentUser currentUser,
                             UserTimeZones timeZones,
                             @Value("${app.parse.monthly-limit}") int monthlyLimit,
                             @Value("${app.parse.daily-budget-usd}") double dailyBudgetUsd,
                             @Value("${app.parse.quota-reset-at:}") String quotaResetAt) {
        this.usageRepository = usageRepository;
        this.currentUser = currentUser;
        this.timeZones = timeZones;
        this.monthlyLimit = monthlyLimit;
        this.dailyBudgetUsd = dailyBudgetUsd;
        this.quotaResetAt = quotaResetAt == null || quotaResetAt.isBlank()
                ? Instant.EPOCH
                : Instant.parse(quotaResetAt.strip());
    }

    public int monthlyLimit() {
        return monthlyLimit;
    }

    public int remaining() {
        ZoneId zone = timeZones.zoneFor(currentUser.entity());
        Instant monthStart = monthStart(ZonedDateTime.now(zone));
        Instant since = quotaResetAt.isAfter(monthStart) ? quotaResetAt : monthStart;
        long used = usageRepository.countByUserIdAndCreatedAtGreaterThanEqual(currentUser.id(), since);
        return (int) Math.max(0, monthlyLimit - used);
    }

    public boolean paused() {
        return spentToday() >= dailyBudgetUsd;
    }

    public void check() {
        if (paused()) {
            throw new TooManyRequestsException(
                    "Automatic course creation is paused for today. Add this course manually or try again tomorrow.");
        }
        if (remaining() <= 0) {
            throw new TooManyRequestsException(
                    "You have used all " + monthlyLimit + " automatic imports for this month. "
                            + "They reset on the 1st; until then you can add this course manually.");
        }
    }

    double spentToday() {
        Instant since = ZonedDateTime.now(timeZones.fallback()).toLocalDate()
                .atStartOfDay(timeZones.fallback()).toInstant();
        return usageRepository.spendSince(since).stream()
                .mapToDouble(s -> ParsePricing.usd(s.getModel(),
                        s.getInputTokens() == null ? 0 : s.getInputTokens(),
                        s.getOutputTokens() == null ? 0 : s.getOutputTokens()))
                .sum();
    }

    static Instant monthStart(ZonedDateTime now) {
        return now.toLocalDate().withDayOfMonth(1).atStartOfDay(now.getZone()).toInstant();
    }
}
