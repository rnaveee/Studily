package com.rnave.studily.user;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.ForbiddenException;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseRepository;
import com.rnave.studily.friend.FriendRequest;
import com.rnave.studily.friend.FriendRequestRepository;
import com.rnave.studily.friend.FriendRequestStatus;
import com.rnave.studily.semester.Semester;
import com.rnave.studily.semester.SemesterRepository;
import com.rnave.studily.semester.SemesterTerm;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class UserScheduleControllerTest {

    private SemesterRepository semesterRepository;
    private CourseRepository courseRepository;
    private FriendRequestRepository friendRequestRepository;
    private UserRepository userRepository;
    private CurrentUser currentUser;
    private UserScheduleController controller;

    @BeforeEach
    void setUp() {
        semesterRepository = mock(SemesterRepository.class);
        courseRepository = mock(CourseRepository.class);
        friendRequestRepository = mock(FriendRequestRepository.class);
        userRepository = mock(UserRepository.class);
        currentUser = mock(CurrentUser.class);
        controller = new UserScheduleController(
                semesterRepository, courseRepository, friendRequestRepository, userRepository, currentUser);
        when(currentUser.id()).thenReturn(1L);
        when(userRepository.existsById(anyLong())).thenReturn(true);
        User viewer = new User();
        viewer.setId(1L);
        viewer.setEmailVerified(true);
        when(userRepository.findById(1L)).thenReturn(Optional.of(viewer));
    }

    @Test
    void ownSchedule_returnsCurrentSemesterAndCourses() {
        Semester semester = semesterWithId(10L);
        when(semesterRepository
                .findFirstByUserIdAndStartDateLessThanEqualAndEndDateGreaterThanEqualOrderByStartDateDesc(
                        eq(1L), any(), any()))
                .thenReturn(Optional.of(semester));
        when(courseRepository.findByUserIdAndSemesterIdOrderByNameAsc(1L, 10L))
                .thenReturn(List.of(course("Biology")));

        UserScheduleController.ScheduleDto dto = controller.schedule(1L);

        assertThat(dto.semester().label()).isEqualTo("Fall 2026");
        assertThat(dto.courses()).hasSize(1);
        assertThat(dto.courses().get(0).name()).isEqualTo("Biology");
    }

    @Test
    void friendsSchedule_isVisible() {
        when(friendRequestRepository.findBetween(1L, 2L))
                .thenReturn(Optional.of(request(FriendRequestStatus.ACCEPTED)));
        when(semesterRepository
                .findFirstByUserIdAndStartDateLessThanEqualAndEndDateGreaterThanEqualOrderByStartDateDesc(
                        eq(2L), any(), any()))
                .thenReturn(Optional.empty());

        UserScheduleController.ScheduleDto dto = controller.schedule(2L);

        assertThat(dto.semester()).isNull();
        assertThat(dto.courses()).isEmpty();
    }

    @Test
    void strangersSchedule_isForbidden() {
        when(friendRequestRepository.findBetween(1L, 2L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> controller.schedule(2L)).isInstanceOf(ForbiddenException.class);
    }

    @Test
    void pendingRequest_isStillForbidden() {
        when(friendRequestRepository.findBetween(1L, 2L))
                .thenReturn(Optional.of(request(FriendRequestStatus.PENDING)));

        assertThatThrownBy(() -> controller.schedule(2L)).isInstanceOf(ForbiddenException.class);
    }

    @Test
    void unverifiedViewer_isForbidden() {
        User viewer = new User();
        viewer.setId(1L);
        viewer.setEmailVerified(false);
        when(userRepository.findById(1L)).thenReturn(Optional.of(viewer));
        when(friendRequestRepository.findBetween(1L, 2L))
                .thenReturn(Optional.of(request(FriendRequestStatus.ACCEPTED)));

        assertThatThrownBy(() -> controller.schedule(2L)).isInstanceOf(ForbiddenException.class);
    }

    @Test
    void unknownUser_isNotFound() {
        when(userRepository.existsById(99L)).thenReturn(false);

        assertThatThrownBy(() -> controller.schedule(99L)).isInstanceOf(NotFoundException.class);
    }

    private Semester semesterWithId(Long id) {
        Semester s = new Semester();
        s.setId(id);
        s.setTerm(SemesterTerm.FALL);
        s.setYear(2026);
        s.setStartDate(LocalDate.now().minusDays(10));
        s.setEndDate(LocalDate.now().plusDays(90));
        return s;
    }

    private Course course(String name) {
        Course c = new Course();
        c.setName(name);
        return c;
    }

    private FriendRequest request(FriendRequestStatus status) {
        FriendRequest f = new FriendRequest();
        f.setStatus(status);
        return f;
    }
}
