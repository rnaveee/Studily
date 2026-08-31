package com.rnave.studily.user;

import com.rnave.studily.academic.AcademicItemRepository;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.course.CourseRepository;
import com.rnave.studily.semester.SemesterRepository;
import com.rnave.studily.todo.TodoRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/me/onboarding")
public class OnboardingController {

    private final CurrentUser currentUser;
    private final SemesterRepository semesterRepository;
    private final CourseRepository courseRepository;
    private final AcademicItemRepository academicItemRepository;
    private final TodoRepository todoRepository;

    public OnboardingController(CurrentUser currentUser, SemesterRepository semesterRepository,
                                CourseRepository courseRepository,
                                AcademicItemRepository academicItemRepository,
                                TodoRepository todoRepository) {
        this.currentUser = currentUser;
        this.semesterRepository = semesterRepository;
        this.courseRepository = courseRepository;
        this.academicItemRepository = academicItemRepository;
        this.todoRepository = todoRepository;
    }

    @GetMapping
    public OnboardingStatus status() {
        User user = currentUser.entity();
        Long userId = user.getId();

        boolean profile = user.getSchool() != null && !user.getSchool().isBlank();
        boolean semester = semesterRepository.existsByUserId(userId);
        long courseCount = courseRepository.countByUserId(userId);
        boolean coursework = academicItemRepository.existsByCourseUserId(userId)
                || todoRepository.existsByUserId(userId);

        List<Boolean> steps = List.of(profile, semester, courseCount > 0, coursework);
        int completed = (int) steps.stream().filter(Boolean::booleanValue).count();

        return new OnboardingStatus(
                profile,
                semester,
                courseCount > 0,
                coursework,
                user.getAvatarKey() != null,
                completed,
                steps.size(),
                completed == steps.size(),
                courseCount);
    }

    public record OnboardingStatus(
            boolean profile,
            boolean semester,
            boolean courses,
            boolean coursework,
            boolean avatar,
            int completed,
            int total,
            boolean complete,
            long courseCount) {
    }
}
