package com.rnave.studily.academic;

import com.rnave.studily.course.Course;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
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

    private static GradeCategory label(long id, String name) {
        GradeCategory c = category(id, name, 0);
        c.setWeight(null);
        return c;
    }

    private static GradeCategory category(long id, String name, double weight) {
        GradeCategory c = new GradeCategory();
        c.setId(id);
        c.setCourse(new Course());
        c.setName(name);
        c.setKind(ItemType.ASSIGNMENT);
        c.setWeight(weight);
        c.setColor("#3b82f6");
        return c;
    }

    private static AcademicItem inCategory(GradeCategory category, Double score, Double maxScore) {
        AcademicItem i = item(null, score, maxScore);
        i.setGradeCategory(category);
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
    void of_splitsACategoryWeightEvenlyAcrossItsItems() {
        GradeCategory assignments = category(1L, "Assignments", 15.0);
        List<AcademicItem> items = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            items.add(inCategory(assignments, 80.0, 100.0));
        }

        Grades.CourseGrade grade = Grades.of(items, List.of(assignments));

        assertThat(Grades.effectiveWeight(items.get(0), List.of(assignments),
                Grades.countsByCategory(items))).isEqualTo(1.5);
        assertThat(grade.percent()).isEqualTo(80.0);
        assertThat(grade.gradedWeight()).isEqualTo(15.0);
        assertThat(grade.totalWeight()).isEqualTo(15.0);
    }

    @Test
    void of_countsOnlyScoredMembersOfACategoryTowardGradedWeight() {
        GradeCategory assignments = category(1L, "Assignments", 15.0);
        List<AcademicItem> items = List.of(
                inCategory(assignments, 90.0, 100.0),
                inCategory(assignments, null, null),
                inCategory(assignments, null, null));

        Grades.CourseGrade grade = Grades.of(items, List.of(assignments));

        assertThat(grade.percent()).isEqualTo(90.0);
        assertThat(grade.gradedWeight()).isEqualTo(5.0);
        assertThat(grade.totalWeight()).isEqualTo(15.0);
        assertThat(grade.gradedCount()).isEqualTo(1);
    }

    @Test
    void of_mixesCategorisedAndLooseItemsInOneCourse() {
        GradeCategory assignments = category(1L, "Assignments", 20.0);
        List<AcademicItem> items = List.of(
                inCategory(assignments, 100.0, 100.0),
                inCategory(assignments, 50.0, 100.0),
                item(80.0, 75.0, 100.0));

        Grades.CourseGrade grade = Grades.of(items, List.of(assignments));

        assertThat(grade.totalWeight()).isEqualTo(100.0);
        assertThat(grade.gradedWeight()).isEqualTo(100.0);
        assertThat(grade.percent()).isEqualTo(75.0);
    }

    @Test
    void of_countsAnEmptyCategoryTowardTotalWeightOnly() {
        GradeCategory project = category(9L, "Project", 10.0);

        Grades.CourseGrade grade = Grades.of(List.of(item(20.0, 18.0, 20.0)), List.of(project));

        assertThat(grade.totalWeight()).isEqualTo(30.0);
        assertThat(grade.gradedWeight()).isEqualTo(20.0);
        assertThat(grade.percent()).isEqualTo(90.0);
    }

    @Test
    void of_letsItemsUnderALabelOnlyCategoryKeepTheirOwnWeight() {
        GradeCategory groupWork = label(3L, "Group work");
        AcademicItem a = item(20.0, 18.0, 20.0);
        AcademicItem b = item(30.0, null, null);
        a.setGradeCategory(groupWork);
        b.setGradeCategory(groupWork);

        Grades.CourseGrade grade = Grades.of(List.of(a, b), List.of(groupWork));

        assertThat(Grades.effectiveWeight(a, List.of(groupWork),
                Grades.countsByCategory(List.of(a, b)))).isEqualTo(20.0);
        assertThat(grade.totalWeight()).isEqualTo(50.0);
        assertThat(grade.gradedWeight()).isEqualTo(20.0);
        assertThat(grade.percent()).isEqualTo(90.0);
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
