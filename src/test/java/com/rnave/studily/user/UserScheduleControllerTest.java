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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
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
        viewer(true, ScheduleVisibility.FRIENDS);
        target(ScheduleVisibility.FRIENDS);
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

        assertThat(dto.visible()).isTrue();
        assertThat(dto.semester().label()).isEqualTo("Fall 2026");
        assertThat(dto.courses()).hasSize(1);
        assertThat(dto.courses().get(0).name()).isEqualTo("Biology");
    }

    @Test
    void ownSchedule_isVisibleEvenWhenPrivate() {
        viewer(true, ScheduleVisibility.PRIVATE);
        Semester semester = semesterWithId(10L);
        when(semesterRepository
                .findFirstByUserIdAndStartDateLessThanEqualAndEndDateGreaterThanEqualOrderByStartDateDesc(
                        eq(1L), any(), any()))
                .thenReturn(Optional.of(semester));
        when(courseRepository.findByUserIdAndSemesterIdOrderByNameAsc(1L, 10L))
                .thenReturn(List.of(course("Biology")));

        UserScheduleController.ScheduleDto dto = controller.schedule(1L);

        assertThat(dto.visible()).isTrue();
        assertThat(dto.courses()).hasSize(1);
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

        assertThat(dto.visible()).isTrue();
        assertThat(dto.semester()).isNull();
        assertThat(dto.courses()).isEmpty();
    }

    @Test
    void publicSchedule_isVisibleToNonFriend() {
        target(ScheduleVisibility.PUBLIC);
        when(friendRequestRepository.findBetween(1L, 2L)).thenReturn(Optional.empty());
        when(semesterRepository
                .findFirstByUserIdAndStartDateLessThanEqualAndEndDateGreaterThanEqualOrderByStartDateDesc(
                        eq(2L), any(), any()))
                .thenReturn(Optional.of(semesterWithId(20L)));
        when(courseRepository.findByUserIdAndSemesterIdOrderByNameAsc(2L, 20L))
                .thenReturn(List.of(course("Physics")));

        UserScheduleController.ScheduleDto dto = controller.schedule(2L);

        assertThat(dto.visible()).isTrue();
        assertThat(dto.courses()).hasSize(1);
        assertThat(dto.courses().get(0).name()).isEqualTo("Physics");
    }

    @Test
    void publicSchedule_isVisibleToPendingRequester() {
        target(ScheduleVisibility.PUBLIC);
        when(friendRequestRepository.findBetween(1L, 2L))
                .thenReturn(Optional.of(request(FriendRequestStatus.PENDING)));
        when(semesterRepository
                .findFirstByUserIdAndStartDateLessThanEqualAndEndDateGreaterThanEqualOrderByStartDateDesc(
                        eq(2L), any(), any()))
                .thenReturn(Optional.empty());

        UserScheduleController.ScheduleDto dto = controller.schedule(2L);

        assertThat(dto.visible()).isTrue();
    }

    @Test
    void friendsOnlySchedule_isHiddenFromStranger() {
        when(friendRequestRepository.findBetween(1L, 2L)).thenReturn(Optional.empty());

        UserScheduleController.ScheduleDto dto = controller.schedule(2L);

        assertThat(dto.visible()).isFalse();
        assertThat(dto.semester()).isNull();
        assertThat(dto.courses()).isEmpty();
        verifyNoInteractions(semesterRepository);
    }

    @Test
    void pendingRequest_isStillHidden() {
        when(friendRequestRepository.findBetween(1L, 2L))
                .thenReturn(Optional.of(request(FriendRequestStatus.PENDING)));

        UserScheduleController.ScheduleDto dto = controller.schedule(2L);

        assertThat(dto.visible()).isFalse();
        verifyNoInteractions(semesterRepository);
    }

    @Test
    void privateSchedule_isHiddenFromFriend() {
        target(ScheduleVisibility.PRIVATE);
        when(friendRequestRepository.findBetween(1L, 2L))
                .thenReturn(Optional.of(request(FriendRequestStatus.ACCEPTED)));

        UserScheduleController.ScheduleDto dto = controller.schedule(2L);

        assertThat(dto.visible()).isFalse();
        assertThat(dto.courses()).isEmpty();
        verifyNoInteractions(semesterRepository);
    }

    @Test
    void unverifiedViewer_isForbidden() {
        viewer(false, ScheduleVisibility.FRIENDS);
        when(friendRequestRepository.findBetween(1L, 2L))
                .thenReturn(Optional.of(request(FriendRequestStatus.ACCEPTED)));

        assertThatThrownBy(() -> controller.schedule(2L)).isInstanceOf(ForbiddenException.class);
    }

    @Test
    void unverifiedViewer_isForbiddenForPublicSchedule() {
        viewer(false, ScheduleVisibility.FRIENDS);
        target(ScheduleVisibility.PUBLIC);

        assertThatThrownBy(() -> controller.schedule(2L)).isInstanceOf(ForbiddenException.class);
    }

    @Test
    void unknownUser_isNotFound() {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> controller.schedule(99L)).isInstanceOf(NotFoundException.class);
    }

    private void viewer(boolean verified, ScheduleVisibility visibility) {
        User u = new User();
        u.setId(1L);
        u.setEmailVerified(verified);
        u.setScheduleVisibility(visibility);
        when(userRepository.findById(1L)).thenReturn(Optional.of(u));
    }

    private void target(ScheduleVisibility visibility) {
        User u = new User();
        u.setId(2L);
        u.setEmailVerified(true);
        u.setScheduleVisibility(visibility);
        when(userRepository.findById(2L)).thenReturn(Optional.of(u));
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
