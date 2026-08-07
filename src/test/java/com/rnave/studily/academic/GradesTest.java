package com.rnave.studily.academic;

import com.rnave.studily.course.Course;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class GradesTest {

    private static AcademicItem item(Double weight, Double score, Double maxScore) {
        AcademicItem i = new AcademicItem();
        i.setCourse(new Course());
        i.setType(ItemType.ASSIGNMENT);
        i.setTitle("Item");
        i.setDueAt(Instant.parse("2026-09-01T00:00:00Z"));
        i.setWeight(weight);
        i.setScore(score);
        i.setMaxScore(maxScore);
        return i;
    }

    @Test
    void of_returnsNullPercentWhenNothingIsScored() {
        Grades.CourseGrade grade = Grades.of(List.of(item(20.0, null, null), item(30.0, null, null)));

        assertThat(grade.percent()).isNull();
        assertThat(grade.gradedCount()).isZero();
        assertThat(grade.totalWeight()).isEqualTo(50.0);
    }

    @Test
    void of_returnsNullPercentForAnEmptyCourse() {
        assertThat(Grades.of(List.of()).percent()).isNull();
    }

    @Test
    void of_weightsEachScoreByItsShareOfTheCourse() {
        Grades.CourseGrade grade = Grades.of(List.of(
                item(10.0, 17.0, 20.0),
                item(30.0, 43.0, 50.0),
                item(60.0, null, null)));

        assertThat(grade.percent()).isEqualTo(85.75);
        assertThat(grade.gradedWeight()).isEqualTo(40.0);
        assertThat(grade.totalWeight()).isEqualTo(100.0);
        assertThat(grade.gradedCount()).isEqualTo(2);
    }

    @Test
    void of_fallsBackToRawPointsWhenNoScoredItemHasAWeight() {
        Grades.CourseGrade grade = Grades.of(List.of(
                item(null, 8.0, 10.0),
                item(null, 15.0, 20.0)));

        assertThat(grade.percent()).isCloseTo(76.667, org.assertj.core.data.Offset.offset(0.001));
        assertThat(grade.gradedWeight()).isZero();
    }

    @Test
    void of_ignoresItemsWithAnUnusableMaxScore() {
        Grades.CourseGrade grade = Grades.of(List.of(
                item(50.0, 40.0, 50.0),
                item(50.0, 10.0, 0.0)));

        assertThat(grade.percent()).isEqualTo(80.0);
        assertThat(grade.gradedCount()).isEqualTo(1);
    }
}
