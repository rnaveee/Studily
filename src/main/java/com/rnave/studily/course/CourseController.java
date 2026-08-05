package com.rnave.studily.course;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.SlidingWindowRateLimiter;
import com.rnave.studily.config.TooManyRequestsException;
import com.rnave.studily.course.CourseDtos.CourseDto;
import com.rnave.studily.course.CourseDtos.CourseMatchDto;
import com.rnave.studily.course.CourseDtos.CourseRequest;
import com.rnave.studily.course.CourseDtos.ImportRequest;
import com.rnave.studily.friend.FriendDtos.PublicUserDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/courses")
public class CourseController {

    private static final long MATCH_WINDOW_MS = 10 * 60_000;

    private final SlidingWindowRateLimiter matchLimiter =
            new SlidingWindowRateLimiter(60, MATCH_WINDOW_MS);

    private final CourseService courseService;
    private final CourseMatchService courseMatchService;
    private final CurrentUser currentUser;

    public CourseController(CourseService courseService, CourseMatchService courseMatchService,
                            CurrentUser currentUser) {
        this.courseService = courseService;
        this.courseMatchService = courseMatchService;
        this.currentUser = currentUser;
    }

    @GetMapping
    public List<CourseDto> list(@RequestParam(required = false) Long semesterId) {
        return courseService.list(semesterId);
    }

    @GetMapping("/{id}")
    public CourseDto get(@PathVariable Long id) {
        return courseService.get(id);
    }

    @GetMapping("/matches")
    public List<CourseMatchDto> matches(@RequestParam String code) {
        if (!matchLimiter.tryConsume("user:" + currentUser.id())) {
            throw new TooManyRequestsException("Too many course lookups, please slow down.");
        }
        return courseMatchService.matches(code);
    }

    @PostMapping("/import")
    @ResponseStatus(HttpStatus.CREATED)
    public CourseDto importCourse(@Valid @RequestBody ImportRequest req) {
        return courseMatchService.importCourse(req.sourceCourseId(), req.semesterId());
    }

    @GetMapping("/{id}/classmates")
    public List<PublicUserDto> classmates(@PathVariable Long id) {
        return courseMatchService.classmates(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CourseDto create(@Valid @RequestBody CourseRequest req) {
        return courseService.create(req);
    }

    @PutMapping("/{id}")
    public CourseDto update(@PathVariable Long id, @Valid @RequestBody CourseRequest req) {
        return courseService.update(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        courseService.delete(id);
    }

    @Scheduled(fixedRate = 10 * MATCH_WINDOW_MS)
    void evictStaleMatchWindows() {
        matchLimiter.evictStale();
    }
}
