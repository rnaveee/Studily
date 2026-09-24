package com.rnave.studily.parse;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OutlineSignalsTest {

    @Test
    void acceptsARealOutlineExcerpt() {
        assertThat(OutlineSignals.looksLikeOutline("""
                ENSC 204 Graphical Communication for Engineering, Fall 2026
                Instructor: Dr. Shervin Jannesar. Office Hrs: Tuesdays 2:00-4:30pm
                Week 2 | 16-SEP | Assignment 1
                Grading: Quizzes, Assignments and Labs 15%, Exam 1 25%
                """)).isTrue();
    }

    @Test
    void acceptsAPastedCourseWebPageWithoutACode() {
        assertThat(OutlineSignals.looksLikeOutline(
                "The midterm is on October 14 and the final exam is in December.")).isTrue();
    }

    @Test
    void rejectsFillerAndEmptyText() {
        assertThat(OutlineSignals.looksLikeOutline(
                "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.")).isFalse();
        assertThat(OutlineSignals.looksLikeOutline("lol")).isFalse();
        assertThat(OutlineSignals.looksLikeOutline("   ")).isFalse();
        assertThat(OutlineSignals.looksLikeOutline(null)).isFalse();
    }

    @Test
    void oneSignalIsNotEnough() {
        assertThat(OutlineSignals.looksLikeOutline("I really liked this course a lot")).isFalse();
    }
}
