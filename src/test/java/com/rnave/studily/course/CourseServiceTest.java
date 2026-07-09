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
    void delete_onlyDeletesWhenOwned() {
        when(currentUser.id()).thenReturn(1L);
        when(courseRepository.findByIdAndUserId(99L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> courseService.delete(99L)).isInstanceOf(NotFoundException.class);
        org.mockito.Mockito.verify(courseRepository, org.mockito.Mockito.never()).delete(org.mockito.ArgumentMatchers.any());
    }
}
