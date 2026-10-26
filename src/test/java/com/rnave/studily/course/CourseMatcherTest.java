package com.rnave.studily.course;

import com.rnave.studily.course.CourseDtos.CourseDto;
import com.rnave.studily.semester.Semester;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CourseMatcherTest {

    private CourseRepository repository;
    private CourseMatcher matcher;
    private List<Course> courses;

    @BeforeEach
    void setUp() {
        repository = mock(CourseRepository.class);
        courses = new ArrayList<>();
        when(repository.findByUserIdOrderByNameAsc(7L)).thenReturn(courses);
        matcher = new CourseMatcher(repository);
    }

    private Course course(long id, String name, String code) {
        Course c = new Course();
        c.setId(id);
        c.setName(name);
        c.setCode(code);
        courses.add(c);
        return c;
    }

    private static Semester semester(long id) {
        Semester s = new Semester();
        s.setId(id);
        return s;
    }

    @Test
    void aSpacedCodeMatchesTheSameCodeWithASection() {
        course(1L, "Digital Logic", "ENSC 252");

        Course found = matcher.best(7L, "Fundamentals of Digital Logic and Design", "ENSC252 D100", null, false);

        assertThat(found.getId()).isEqualTo(1L);
    }

    @Test
    void aCourseNamedWithJustTheCodeAndNoCodeStillMatches() {
        course(1L, "ENSC252", null);

        Course found = matcher.best(7L, "Fundamentals of Digital Logic and Design", "ENSC252 D100", null, false);

        assertThat(found.getId()).isEqualTo(1L);
    }

    @Test
    void anIncomingCodeOnlyNameMatchesACodeInTheExistingName() {
        course(1L, "ENSC 252 Digital Logic", null);

        assertThat(matcher.best(7L, "ENSC252 D100", null, null, false).getId()).isEqualTo(1L);
    }

    @Test
    void fallsBackToTheNormalizedNameWhenThereIsNoCode() {
        course(1L, "Intro to Philosophy", null);

        assertThat(matcher.best(7L, "intro  to philosophy!", null, null, false).getId()).isEqualTo(1L);
        assertThat(matcher.best(7L, "Ethics", null, null, false)).isNull();
    }

    @Test
    void differentCodesDoNotMatch() {
        course(1L, "ENSC 254", "ENSC254");

        assertThat(matcher.best(7L, "ENSC252", "ENSC252 D100", null, false)).isNull();
        assertThat(matcher.best(7L, null, null, null, false)).isNull();
    }

    @Test
    void codeMatchesRankAboveNameMatches() {
        course(1L, "Digital Logic", null);
        course(2L, "Something else", "ENSC 252");

        List<Course> found = matcher.similar(7L, "Digital Logic", "ENSC252", null, false);

        assertThat(found).extracting(Course::getId).containsExactly(2L, 1L);
    }

    @Test
    void prefersTheSameSemester() {
        Course older = course(1L, "ENSC252", null);
        older.setSemester(semester(10L));
        Course current = course(2L, "ENSC252", null);
        current.setSemester(semester(20L));

        assertThat(matcher.best(7L, "ENSC252", "ENSC252", 20L, false).getId()).isEqualTo(2L);
        assertThat(matcher.best(7L, "ENSC252", "ENSC252", 10L, false).getId()).isEqualTo(1L);
        assertThat(matcher.best(7L, "ENSC252", "ENSC252", null, false).getId()).isEqualTo(1L);
    }

    @Test
    void skipsCoursesLinkedToAnotherLmsCourseWhenAsked() {
        Course linked = course(1L, "ENSC252", "ENSC252");
        linked.setCanvasCourseId(5L);
        Course lms = course(2L, "ENSC252", "ENSC252");
        lms.setLmsCourseId("60614");
        course(3L, "ENSC 252", null);

        assertThat(matcher.best(7L, "ENSC252", "ENSC252", null, true).getId()).isEqualTo(3L);
        assertThat(matcher.best(7L, "ENSC252", "ENSC252", null, false).getId()).isEqualTo(1L);
    }

    @Test
    void similarDtosReturnsCourseDtosBestFirst() {
        course(1L, "Digital Logic", null);
        course(2L, "Other", "ENSC252");

        List<CourseDto> found = matcher.similarDtos(7L, "Digital Logic", "ENSC 252", null);

        assertThat(found).extracting(CourseDto::id).containsExactly(2L, 1L);
    }
}
