package com.rnave.studily.course;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.ForbiddenException;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.semester.SemesterService;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CourseMatchServiceTest {

    private CourseRepository courseRepository;
    private UserRepository userRepository;
    private CurrentUser currentUser;
    private CourseMatchService service;

    @BeforeEach
    void setUp() {
        courseRepository = mock(CourseRepository.class);
        userRepository = mock(UserRepository.class);
        currentUser = mock(CurrentUser.class);
        service = new CourseMatchService(courseRepository, userRepository, currentUser,
                mock(SemesterService.class));
    }

    @Test
    void matches_returnsNothingForUnverifiedUser() {
        when(currentUser.entity()).thenReturn(user(1L, "queensuniversity", false));

        assertThat(service.matches("CISC 121")).isEmpty();
        verify(courseRepository, never()).findMatching(anyString(), anyString(), anyLong());
    }

    @Test
    void matches_queriesForVerifiedUser() {
        when(currentUser.entity()).thenReturn(user(1L, "queensuniversity", true));
        when(courseRepository.findMatching("CISC121", "queensuniversity", 1L))
                .thenReturn(List.of());

        assertThat(service.matches("CISC 121")).isEmpty();
        verify(courseRepository).findMatching("CISC121", "queensuniversity", 1L);
    }

    @Test
    void matches_returnsNothingWhenSchoolUnset() {
        when(currentUser.entity()).thenReturn(user(1L, null, true));

        assertThat(service.matches("CISC 121")).isEmpty();
        verify(courseRepository, never()).findMatching(anyString(), anyString(), anyLong());
    }

    @Test
    void importCourse_rejectsUnverifiedUser() {
        when(currentUser.entity()).thenReturn(user(1L, "queensuniversity", false));

        assertThatThrownBy(() -> service.importCourse(5L, "CISC 121", null))
                .isInstanceOf(ForbiddenException.class);
        verify(courseRepository, never()).findById(any());
    }

    @Test
    void importCourse_rejectsCourseWhoseCodeWasNotSupplied() {
        when(currentUser.entity()).thenReturn(user(1L, "queensuniversity", true));
        when(courseRepository.findById(5L))
                .thenReturn(java.util.Optional.of(shared(5L, 2L, "queensuniversity", "MATH121")));

        assertThatThrownBy(() -> service.importCourse(5L, "CISC 121", null))
                .isInstanceOf(NotFoundException.class);
        verify(courseRepository, never()).save(any());
    }

    @Test
    void importCourse_rejectsCourseWithNoCode() {
        when(currentUser.entity()).thenReturn(user(1L, "queensuniversity", true));
        when(courseRepository.findById(5L))
                .thenReturn(java.util.Optional.of(shared(5L, 2L, "queensuniversity", null)));

        assertThatThrownBy(() -> service.importCourse(5L, "CISC 121", null))
                .isInstanceOf(NotFoundException.class);
        verify(courseRepository, never()).save(any());
    }

    @Test
    void importCourse_rejectsCourseFromAnotherSchool() {
        when(currentUser.entity()).thenReturn(user(1L, "queensuniversity", true));
        when(courseRepository.findById(5L))
                .thenReturn(java.util.Optional.of(shared(5L, 2L, "torontometropolitan", "CISC121")));

        assertThatThrownBy(() -> service.importCourse(5L, "CISC 121", null))
                .isInstanceOf(NotFoundException.class);
        verify(courseRepository, never()).save(any());
    }

    @Test
    void importCourse_copiesCourseWhenCodeMatches() {
        when(currentUser.entity()).thenReturn(user(1L, "queensuniversity", true));
        Course source = shared(5L, 2L, "queensuniversity", "CISC121");
        source.setName("Intro to Programming");
        when(courseRepository.findById(5L)).thenReturn(java.util.Optional.of(source));
        when(courseRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        assertThat(service.importCourse(5L, "cisc 121", null).name()).isEqualTo("Intro to Programming");
        verify(courseRepository).save(any());
    }

    private static Course shared(Long courseId, Long ownerId, String schoolKey, String codeKey) {
        Course course = new Course();
        course.setId(courseId);
        course.setUser(user(ownerId, schoolKey, true));
        course.setName("Shared course");
        course.setCodeKey(codeKey);
        return course;
    }

    @Test
    void classmates_returnsNothingForUnverifiedUser() {
        User me = user(1L, "queensuniversity", false);
        Course course = new Course();
        course.setId(9L);
        course.setCodeKey("CISC121");
        when(currentUser.entity()).thenReturn(me);
        when(courseRepository.findByIdAndUserId(9L, 1L)).thenReturn(java.util.Optional.of(course));

        assertThat(service.classmates(9L)).isEmpty();
        verify(userRepository, never()).findClassmates(anyString(), anyString(), anyLong());
    }

    private static User user(Long id, String schoolKey, boolean verified) {
        User user = new User();
        user.setId(id);
        user.setSchoolKey(schoolKey);
        user.setEmailVerified(verified);
        return user;
    }
}
