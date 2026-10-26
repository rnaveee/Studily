package com.rnave.studily.exam;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class StudyPlannerTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 20);

    @Test
    void spreadsCardsOverTheDaysBeforeTheExam() {
        StudyPlanner.Plan plan = StudyPlanner.plan(10, List.of(), TODAY, TODAY.plusDays(4));

        assertThat(plan.daysLeft()).isEqualTo(4);
        assertThat(plan.days()).hasSize(4);
        assertThat(plan.days()).extracting(StudyPlanner.Day::cards).containsExactly(3, 3, 2, 2);
        assertThat(plan.days().stream().mapToInt(StudyPlanner.Day::cards).sum()).isEqualTo(10);
        assertThat(plan.todayCards()).isEqualTo(3);
        assertThat(plan.days().get(0).today()).isTrue();
        assertThat(plan.days().get(3).date()).isEqualTo(TODAY.plusDays(3));
    }

    @Test
    void todaysTargetIsTheCeilingOfCardsOverDays() {
        assertThat(StudyPlanner.plan(24, List.of(), TODAY, TODAY.plusDays(5)).todayCards()).isEqualTo(5);
        assertThat(StudyPlanner.plan(25, List.of(), TODAY, TODAY.plusDays(5)).todayCards()).isEqualTo(5);
        assertThat(StudyPlanner.plan(26, List.of(), TODAY, TODAY.plusDays(5)).todayCards()).isEqualTo(6);
    }

    @Test
    void examTomorrowIsOneStudyDay() {
        StudyPlanner.Plan plan = StudyPlanner.plan(9, List.of(1L, 2L), TODAY, TODAY.plusDays(1));

        assertThat(plan.days()).hasSize(1);
        assertThat(plan.todayCards()).isEqualTo(9);
        assertThat(plan.todayTodoIds()).containsExactly(1L, 2L);
    }

    @Test
    void examTodayPutsEverythingOnToday() {
        StudyPlanner.Plan plan = StudyPlanner.plan(7, List.of(5L), TODAY, TODAY);

        assertThat(plan.daysLeft()).isZero();
        assertThat(plan.days()).hasSize(1);
        assertThat(plan.todayCards()).isEqualTo(7);
        assertThat(plan.todayTodoIds()).containsExactly(5L);
    }

    @Test
    void pastExamHasNoDays() {
        StudyPlanner.Plan plan = StudyPlanner.plan(7, List.of(5L), TODAY, TODAY.minusDays(1));

        assertThat(plan.daysLeft()).isEqualTo(-1);
        assertThat(plan.days()).isEmpty();
        assertThat(plan.todayCards()).isZero();
    }

    @Test
    void zeroCardsGivesDaysWithNoWork() {
        StudyPlanner.Plan plan = StudyPlanner.plan(0, List.of(), TODAY, TODAY.plusDays(3));

        assertThat(plan.days()).hasSize(3);
        assertThat(plan.days()).allMatch(d -> d.cards() == 0 && d.todoIds().isEmpty());
        assertThat(plan.todayCards()).isZero();
    }

    @Test
    void spreadsTodosAcrossDaysWithoutLosingAny() {
        StudyPlanner.Plan plan = StudyPlanner.plan(0, List.of(1L, 2L, 3L, 4L, 5L), TODAY, TODAY.plusDays(3));

        assertThat(plan.days()).extracting(d -> d.todoIds().size()).containsExactly(2, 2, 1);
        assertThat(plan.days().stream().flatMap(d -> d.todoIds().stream())).containsExactly(1L, 2L, 3L, 4L, 5L);
    }

    @Test
    void negativeCardCountIsTreatedAsZero() {
        assertThat(StudyPlanner.plan(-4, List.of(), TODAY, TODAY.plusDays(2)).remainingCards()).isZero();
    }
}
