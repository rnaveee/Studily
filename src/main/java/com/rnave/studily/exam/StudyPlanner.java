package com.rnave.studily.exam;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

public final class StudyPlanner {

    private StudyPlanner() {
    }

    public record Day(LocalDate date, int cards, List<Long> todoIds, boolean today) {
    }

    public record Plan(long daysLeft, int remainingCards, List<Day> days) {

        public int todayCards() {
            return days.isEmpty() ? 0 : days.get(0).cards();
        }

        public List<Long> todayTodoIds() {
            return days.isEmpty() ? List.of() : days.get(0).todoIds();
        }
    }

    public static long daysLeft(LocalDate today, LocalDate examDate) {
        return ChronoUnit.DAYS.between(today, examDate);
    }

    public static Plan plan(int remainingCards, List<Long> todoIds, LocalDate today, LocalDate examDate) {
        long daysLeft = daysLeft(today, examDate);
        int cards = Math.max(0, remainingCards);
        if (daysLeft < 0) {
            return new Plan(daysLeft, cards, List.of());
        }
        int studyDays = (int) Math.max(1, daysLeft);

        int baseCards = cards / studyDays;
        int extraCards = cards % studyDays;
        int baseTodos = todoIds.size() / studyDays;
        int extraTodos = todoIds.size() % studyDays;

        List<Day> days = new ArrayList<>(studyDays);
        int cursor = 0;
        for (int i = 0; i < studyDays; i++) {
            int cardCount = baseCards + (i < extraCards ? 1 : 0);
            int todoCount = baseTodos + (i < extraTodos ? 1 : 0);
            List<Long> dayTodos = new ArrayList<>(todoIds.subList(cursor, cursor + todoCount));
            cursor += todoCount;
            days.add(new Day(today.plusDays(i), cardCount, dayTodos, i == 0));
        }
        return new Plan(daysLeft, cards, days);
    }
}
