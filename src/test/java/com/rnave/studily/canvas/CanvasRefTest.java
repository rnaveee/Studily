package com.rnave.studily.canvas;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CanvasRefTest {

    @Test
    void parse_readsAssignmentCourseAndItemIds() {
        CanvasRef ref = CanvasRef.parse("https://school.instructure.com/courses/1234/assignments/5678");

        assertThat(ref).isNotNull();
        assertThat(ref.kind()).isEqualTo(CanvasRef.Kind.ASSIGNMENT);
        assertThat(ref.courseId()).isEqualTo(1234L);
        assertThat(ref.itemId()).isEqualTo(5678L);
        assertThat(ref.externalUid()).isEqualTo("canvas-assignment-5678");
    }

    @Test
    void parse_recognisesQuizzesAndCalendarEvents() {
        assertThat(CanvasRef.parse("https://s.instructure.com/courses/1/quizzes/2").kind())
                .isEqualTo(CanvasRef.Kind.QUIZ);
        assertThat(CanvasRef.parse("https://s.instructure.com/courses/1/calendar_events/2").kind())
                .isEqualTo(CanvasRef.Kind.CALENDAR_EVENT);
    }

    @Test
    void parse_readsTheCalendarPageLinkCanvasPutsInSomeFeeds() {
        CanvasRef ref = CanvasRef.parse(
                "https://school.instructure.com/calendar?include_contexts=course_16838&month=09&year=2026#assignment_232739");

        assertThat(ref).isNotNull();
        assertThat(ref.kind()).isEqualTo(CanvasRef.Kind.ASSIGNMENT);
        assertThat(ref.courseId()).isEqualTo(16838L);
        assertThat(ref.itemId()).isEqualTo(232739L);
        assertThat(ref.externalUid()).isEqualTo("canvas-assignment-232739");
        assertThat(CanvasRef.parse("https://s.instructure.com/calendar?include_contexts=course_1#calendar_event_2")
                .kind()).isEqualTo(CanvasRef.Kind.CALENDAR_EVENT);
    }

    @Test
    void parse_findsTheUrlEmbeddedInADescription() {
        CanvasRef ref = CanvasRef.parse(
                "Read chapter 4. https://school.instructure.com/courses/9/assignments/11 is due Friday.");

        assertThat(ref).isNotNull();
        assertThat(ref.courseId()).isEqualTo(9L);
        assertThat(ref.itemId()).isEqualTo(11L);
    }

    @Test
    void parse_returnsNullForNonCanvasUrls() {
        assertThat(CanvasRef.parse(null)).isNull();
        assertThat(CanvasRef.parse("https://example.com/some/page")).isNull();
        assertThat(CanvasRef.parse("https://school.instructure.com/courses/1")).isNull();
    }
}
