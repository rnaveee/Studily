package com.rnave.studily.user;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.ForbiddenException;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.course.CourseDtos.CourseDto;
import com.rnave.studily.course.CourseRepository;
import com.rnave.studily.friend.FriendRequestRepository;
import com.rnave.studily.friend.FriendRequestStatus;
import com.rnave.studily.semester.Semester;
import com.rnave.studily.semester.SemesterDtos.SemesterDto;
import com.rnave.studily.semester.SemesterRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/users/{id}/schedule")
public class UserScheduleController {

    private final SemesterRepository semesterRepository;
    private final CourseRepository courseRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final UserRepository userRepository;
    private final CurrentUser currentUser;

    public UserScheduleController(SemesterRepository semesterRepository,
                                  CourseRepository courseRepository,
                                  FriendRequestRepository friendRequestRepository,
                                  UserRepository userRepository,
                                  CurrentUser currentUser) {
        this.semesterRepository = semesterRepository;
        this.courseRepository = courseRepository;
        this.friendRequestRepository = friendRequestRepository;
        this.userRepository = userRepository;
        this.currentUser = currentUser;
    }

    public record ScheduleDto(SemesterDto semester, List<CourseDto> courses) {
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ScheduleDto schedule(@PathVariable Long id) {
        Long me = currentUser.id();
        if (!userRepository.existsById(id)) {
            throw new NotFoundException("User not found");
        }
        if (!me.equals(id) && !isFriend(me, id)) {
            throw new ForbiddenException("Only friends can view schedules");
        }
        LocalDate today = LocalDate.now();
        Semester current = semesterRepository
                .findFirstByUserIdAndStartDateLessThanEqualAndEndDateGreaterThanEqualOrderByStartDateDesc(
                        id, today, today)
                .orElse(null);
        if (current == null) {
            return new ScheduleDto(null, List.of());
        }
        List<CourseDto> courses = courseRepository
                .findByUserIdAndSemesterIdOrderByNameAsc(id, current.getId())
                .stream()
                .map(CourseDto::from)
                .toList();
        return new ScheduleDto(SemesterDto.from(current), courses);
    }

    private boolean isFriend(Long a, Long b) {
        return friendRequestRepository.findBetween(a, b)
                .map(f -> f.getStatus() == FriendRequestStatus.ACCEPTED)
                .orElse(false);
    }
}
