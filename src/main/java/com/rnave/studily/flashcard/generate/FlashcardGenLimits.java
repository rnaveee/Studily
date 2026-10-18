package com.rnave.studily.flashcard.generate;

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
public class FlashcardGenLimits {

    private final CourseParseUsageRepository usageRepository;
    private final CurrentUser currentUser;
    private final UserTimeZones timeZones;
    private final int monthlyLimit;
    private final double dailyBudgetUsd;
    private final double monthlyBudgetUsd;

    public FlashcardGenLimits(CourseParseUsageRepository usageRepository,
                              CurrentUser currentUser,
                              UserTimeZones timeZones,
                              @Value("${app.flashcards.gen.monthly-limit}") int monthlyLimit,
                              @Value("${app.flashcards.gen.daily-budget-usd}") double dailyBudgetUsd,
                              @Value("${app.flashcards.gen.monthly-budget-usd}") double monthlyBudgetUsd) {
        this.usageRepository = usageRepository;
        this.currentUser = currentUser;
        this.timeZones = timeZones;
        this.monthlyLimit = monthlyLimit;
        this.dailyBudgetUsd = dailyBudgetUsd;
        this.monthlyBudgetUsd = monthlyBudgetUsd;
    }

    public int monthlyLimit() {
        return monthlyLimit;
    }

    public int remaining() {
        ZonedDateTime now = ZonedDateTime.now(timeZones.zoneFor(currentUser.entity()));
        long used = usageRepository.countByUserIdAndFeatureAndSucceededTrueAndCreatedAtGreaterThanEqual(
                currentUser.id(), AiFeature.FLASHCARDS, AiBudget.monthStart(now));
        return (int) Math.max(0, monthlyLimit - used);
    }

    public boolean paused() {
        return spentThisMonth() >= monthlyBudgetUsd || spentToday() >= dailyBudgetUsd;
    }

    public void check(int documents) {
        if (spentThisMonth() >= monthlyBudgetUsd) {
            throw new TooManyRequestsException(
                    "Making flashcards from documents is paused until the 1st. You can still add cards by hand.");
        }
        if (spentToday() >= dailyBudgetUsd) {
            throw new TooManyRequestsException(
                    "Making flashcards from documents is paused for today. Try again tomorrow.");
        }
        int left = remaining();
        if (left <= 0) {
            throw new TooManyRequestsException("You've used all " + monthlyLimit
                    + " documents for this month. They reset on the 1st.");
        }
        if (documents > left) {
            throw new TooManyRequestsException("You have " + left + (left == 1 ? " document" : " documents")
                    + " left this month. Remove some files and try again.");
        }
    }

    double spentToday() {
        return AiBudget.usd(usageRepository.spendSince(AiBudget.dayStart(timeZones.fallback()), AiFeature.FLASHCARDS));
    }

    double spentThisMonth() {
        return AiBudget.usd(usageRepository.spendSince(
                AiBudget.monthStart(ZonedDateTime.now(timeZones.fallback())), AiFeature.FLASHCARDS));
    }
}
