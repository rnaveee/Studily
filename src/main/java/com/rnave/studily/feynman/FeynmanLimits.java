package com.rnave.studily.feynman;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.TooManyRequestsException;
import com.rnave.studily.parse.AiBudget;
import com.rnave.studily.parse.AiFeature;
import com.rnave.studily.parse.CourseParseUsageRepository;
import com.rnave.studily.user.UserTimeZones;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.ZonedDateTime;

@Component
public class FeynmanLimits {

    private final CourseParseUsageRepository usageRepository;
    private final CurrentUser currentUser;
    private final UserTimeZones timeZones;
    private final int dailyTurns;
    private final double dailyBudgetUsd;
    private final double monthlyBudgetUsd;

    public FeynmanLimits(CourseParseUsageRepository usageRepository,
                         CurrentUser currentUser,
                         UserTimeZones timeZones,
                         @Value("${app.feynman.daily-turns}") int dailyTurns,
                         @Value("${app.feynman.daily-budget-usd}") double dailyBudgetUsd,
                         @Value("${app.feynman.monthly-budget-usd}") double monthlyBudgetUsd) {
        this.usageRepository = usageRepository;
        this.currentUser = currentUser;
        this.timeZones = timeZones;
        this.dailyTurns = dailyTurns;
        this.dailyBudgetUsd = dailyBudgetUsd;
        this.monthlyBudgetUsd = monthlyBudgetUsd;
    }

    public int remainingToday() {
        long used = usageRepository.countByUserIdAndFeatureAndSucceededTrueAndCreatedAtGreaterThanEqual(
                currentUser.id(), AiFeature.FEYNMAN, AiBudget.dayStart(timeZones.zoneFor(currentUser.entity())));
        return (int) Math.max(0, dailyTurns - used);
    }

    public boolean paused() {
        return spentThisMonth() >= monthlyBudgetUsd || spentToday() >= dailyBudgetUsd;
    }

    public void check() {
        if (spentThisMonth() >= monthlyBudgetUsd) {
            throw new TooManyRequestsException("StudilyBot is resting until the 1st. Your sessions are saved.");
        }
        if (spentToday() >= dailyBudgetUsd) {
            throw new TooManyRequestsException("StudilyBot is resting for today. Try again tomorrow.");
        }
        if (remainingToday() <= 0) {
            throw new TooManyRequestsException("You've sent StudilyBot " + dailyTurns
                    + " messages today. Try again tomorrow.");
        }
    }

    double spentToday() {
        return AiBudget.usd(usageRepository.spendSince(AiBudget.dayStart(timeZones.fallback()), AiFeature.FEYNMAN));
    }

    double spentThisMonth() {
        return AiBudget.usd(usageRepository.spendSince(
                AiBudget.monthStart(ZonedDateTime.now(timeZones.fallback())), AiFeature.FEYNMAN));
    }
}
