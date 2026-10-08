package com.rnave.studily.progress;

import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.function.Predicate;

import static java.util.Map.entry;

public final class BadgeRules {

    public interface Stats {
        int level();

        int streakBest();

        long friends();

        long schoolmateFriends();

        Instant joinedAt();

        Instant ogCutoff();

        Instant now();

        boolean completedSession();

        long studyMinutes();

        long completedRuns();
    }

    private static final Map<String, Predicate<Stats>> RULES = Map.ofEntries(
            entry("level_1", s -> s.level() >= 1),
            entry("level_5", s -> s.level() >= 5),
            entry("level_10", s -> s.level() >= 10),
            entry("level_20", s -> s.level() >= 20),
            entry("level_30", s -> s.level() >= 30),
            entry("level_50", s -> s.level() >= 50),
            entry("level_75", s -> s.level() >= 75),
            entry("level_100", s -> s.level() >= 100),
            entry("friends_5", s -> s.friends() >= 5),
            entry("friends_10", s -> s.friends() >= 10),
            entry("friends_20", s -> s.friends() >= 20),
            entry("friends_50", s -> s.friends() >= 50),
            entry("schoolmates_10", s -> s.schoolmateFriends() >= 10),
            entry("og", s -> s.joinedAt().isBefore(s.ogCutoff())),
            entry("member_1m", s -> memberFor(s, 1)),
            entry("member_6m", s -> memberFor(s, 6)),
            entry("member_1y", s -> memberFor(s, 12)),
            entry("first_session", Stats::completedSession),
            entry("streak_7", s -> s.streakBest() >= 7),
            entry("streak_30", s -> s.streakBest() >= 30),
            entry("hours_10", s -> s.studyMinutes() >= 600),
            entry("hours_100", s -> s.studyMinutes() >= 6000),
            entry("runs_10", s -> s.completedRuns() >= 10),
            entry("runs_100", s -> s.completedRuns() >= 100));

    private BadgeRules() {
    }

    public static boolean has(String code) {
        return RULES.containsKey(code);
    }

    public static boolean earned(String code, Stats stats) {
        Predicate<Stats> rule = RULES.get(code);
        return rule != null && rule.test(stats);
    }

    private static boolean memberFor(Stats s, int months) {
        Instant anniversary = s.joinedAt().atZone(ZoneOffset.UTC).plusMonths(months).toInstant();
        return !anniversary.isAfter(s.now());
    }
}
