package com.rnave.studily.bot;

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
public class BotLimits {

    private final CourseParseUsageRepository usageRepository;
    private final BotMessageRepository messages;
    private final CurrentUser currentUser;
    private final UserTimeZones timeZones;
    private final int chatDailyTurns;
    private final double chatDailyBudgetUsd;
    private final double chatMonthlyBudgetUsd;
    private final int practiceDailyTurns;
    private final double practiceDailyBudgetUsd;
    private final double practiceMonthlyBudgetUsd;

    public BotLimits(CourseParseUsageRepository usageRepository,
                     BotMessageRepository messages,
                     CurrentUser currentUser,
                     UserTimeZones timeZones,
                     @Value("${app.bot.chat.daily-turns}") int chatDailyTurns,
                     @Value("${app.bot.chat.daily-budget-usd}") double chatDailyBudgetUsd,
                     @Value("${app.bot.chat.monthly-budget-usd}") double chatMonthlyBudgetUsd,
                     @Value("${app.bot.practice.daily-turns}") int practiceDailyTurns,
                     @Value("${app.bot.practice.daily-budget-usd}") double practiceDailyBudgetUsd,
                     @Value("${app.bot.practice.monthly-budget-usd}") double practiceMonthlyBudgetUsd) {
        this.usageRepository = usageRepository;
        this.messages = messages;
        this.currentUser = currentUser;
        this.timeZones = timeZones;
        this.chatDailyTurns = chatDailyTurns;
        this.chatDailyBudgetUsd = chatDailyBudgetUsd;
        this.chatMonthlyBudgetUsd = chatMonthlyBudgetUsd;
        this.practiceDailyTurns = practiceDailyTurns;
        this.practiceDailyBudgetUsd = practiceDailyBudgetUsd;
        this.practiceMonthlyBudgetUsd = practiceMonthlyBudgetUsd;
    }

    public int remainingToday(BotMode mode) {
        long used = messages.countUserMessagesSince(currentUser.id(), mode,
                AiBudget.dayStart(timeZones.zoneFor(currentUser.entity())));
        return (int) Math.max(0, dailyTurns(mode) - used);
    }

    public boolean paused(BotMode mode) {
        return spentThisMonth(mode) >= monthlyBudget(mode) || spentToday(mode) >= dailyBudget(mode);
    }

    public void check(BotMode mode) {
        if (spentThisMonth(mode) >= monthlyBudget(mode)) {
            throw new TooManyRequestsException("StudilyBot is resting until the 1st. Your chats are saved.");
        }
        if (spentToday(mode) >= dailyBudget(mode)) {
            throw new TooManyRequestsException("StudilyBot is resting for today. Try again tomorrow.");
        }
        if (remainingToday(mode) <= 0) {
            throw new TooManyRequestsException("You've sent StudilyBot " + dailyTurns(mode)
                    + " messages in this mode today. Try again tomorrow.");
        }
    }

    public static AiFeature feature(BotMode mode) {
        return mode == BotMode.PRACTICE ? AiFeature.BOT_PRACTICE : AiFeature.BOT_CHAT;
    }

    double spentToday(BotMode mode) {
        return AiBudget.usd(usageRepository.spendSince(AiBudget.dayStart(timeZones.fallback()), feature(mode)));
    }

    double spentThisMonth(BotMode mode) {
        return AiBudget.usd(usageRepository.spendSince(
                AiBudget.monthStart(ZonedDateTime.now(timeZones.fallback())), feature(mode)));
    }

    private int dailyTurns(BotMode mode) {
        return mode == BotMode.PRACTICE ? practiceDailyTurns : chatDailyTurns;
    }

    private double dailyBudget(BotMode mode) {
        return mode == BotMode.PRACTICE ? practiceDailyBudgetUsd : chatDailyBudgetUsd;
    }

    private double monthlyBudget(BotMode mode) {
        return mode == BotMode.PRACTICE ? practiceMonthlyBudgetUsd : chatMonthlyBudgetUsd;
    }
}
