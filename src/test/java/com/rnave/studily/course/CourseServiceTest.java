package com.rnave.studily.course;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.semester.SemesterService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CourseServiceTest {

    private CourseRepository courseRepository;
    private CurrentUser currentUser;
    private CourseService courseService;

    @BeforeEach
    void setUp() {
        courseRepository = mock(CourseRepository.class);
        currentUser = mock(CurrentUser.class);
        courseService = new CourseService(courseRepository, currentUser, mock(SemesterService.class));
    }

    @Test
    void requireOwned_returnsCourseWhenCallerOwnsIt() {
        when(currentUser.id()).thenReturn(1L);
        Course course = new Course();
        course.setId(99L);
        when(courseRepository.findByIdAndUserId(99L, 1L)).thenReturn(Optional.of(course));

        assertThat(courseService.requireOwned(99L)).isSameAs(course);
    }

    @Test
    void requireOwned_rejectsAnotherUsersCourse() {
        when(currentUser.id()).thenReturn(1L);
        when(courseRepository.findByIdAndUserId(99L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> courseService.requireOwned(99L))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void updateGrading_savesCreditsAndTarget() {
        when(currentUser.id()).thenReturn(1L);
        Course course = new Course();
        course.setId(99L);
        when(courseRepository.findByIdAndUserId(99L, 1L)).thenReturn(Optional.of(course));
        when(courseRepository.save(course)).thenReturn(course);

        CourseDtos.CourseDto dto = courseService.updateGrading(99L, new CourseDtos.GradingRequest(3.0, 85.5));

        assertThat(dto.credits()).isEqualTo(3.0);
        assertThat(dto.targetGrade()).isEqualTo(85.5);
    }

    @Test
    void updateGrading_nullClearsBothValues() {
        when(currentUser.id()).thenReturn(1L);
        Course course = new Course();
        course.setId(99L);
        course.setCredits(java.math.BigDecimal.valueOf(3));
        course.setTargetGrade(80.0);
        when(courseRepository.findByIdAndUserId(99L, 1L)).thenReturn(Optional.of(course));
        when(courseRepository.save(course)).thenReturn(course);

        courseService.updateGrading(99L, new CourseDtos.GradingRequest(null, null));

        assertThat(course.getCredits()).isNull();
        assertThat(course.getTargetGrade()).isNull();
    }

    @Test
    void updateGrading_rejectsAnotherUsersCourse() {
        when(currentUser.id()).thenReturn(1L);
        when(courseRepository.findByIdAndUserId(99L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> courseService.updateGrading(99L, new CourseDtos.GradingRequest(3.0, 80.0)))
                .isInstanceOf(NotFoundException.class);
        org.mockito.Mockito.verify(courseRepository, org.mockito.Mockito.never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void update_withoutGradingFieldsKeepsExistingValues() {
        when(currentUser.id()).thenReturn(1L);
        Course course = new Course();
        course.setId(99L);
        course.setName("Calc");
        course.setCredits(java.math.BigDecimal.valueOf(1.5));
        course.setTargetGrade(90.0);
        when(courseRepository.findByIdAndUserId(99L, 1L)).thenReturn(Optional.of(course));
        when(courseRepository.save(course)).thenReturn(course);

        courseService.update(99L, new CourseDtos.CourseRequest("Calc II", null, null, null, null, null,
                null, null, null));

        assertThat(course.getName()).isEqualTo("Calc II");
        assertThat(course.getCredits()).isEqualByComparingTo("1.5");
        assertThat(course.getTargetGrade()).isEqualTo(90.0);
    }

    @Test
    void update_withGradingFieldsOverwrites() {
        when(currentUser.id()).thenReturn(1L);
        Course course = new Course();
        course.setId(99L);
        when(courseRepository.findByIdAndUserId(99L, 1L)).thenReturn(Optional.of(course));
        when(courseRepository.save(course)).thenReturn(course);

        courseService.update(99L, new CourseDtos.CourseRequest("Calc", null, null, null, null, null,
                4.0, 75.0, null));

        assertThat(course.getCredits()).isEqualByComparingTo("4");
        assertThat(course.getTargetGrade()).isEqualTo(75.0);
    }

    @Test
    void delete_onlyDeletesWhenOwned() {
        when(currentUser.id()).thenReturn(1L);
        when(courseRepository.findByIdAndUserId(99L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> courseService.delete(99L)).isInstanceOf(NotFoundException.class);
        org.mockito.Mockito.verify(courseRepository, org.mockito.Mockito.never()).delete(org.mockito.ArgumentMatchers.any());
    }
}
