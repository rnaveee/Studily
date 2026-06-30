package com.rnave.studily.course;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.course.CourseDtos.CourseDto;
import com.rnave.studily.course.CourseDtos.CourseRequest;
import com.rnave.studily.course.CourseDtos.MeetingBlockDto;
import com.rnave.studily.semester.Semester;
import com.rnave.studily.semester.SemesterService;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CourseService {

    private final CourseRepository courseRepository;
    private final CurrentUser currentUser;
    private final SemesterService semesterService;

    public CourseService(CourseRepository courseRepository, CurrentUser currentUser,
                         @Lazy SemesterService semesterService) {
        this.courseRepository = courseRepository;
        this.currentUser = currentUser;
        this.semesterService = semesterService;
    }

    @Transactional(readOnly = true)
    public List<CourseDto> list(Long semesterId) {
        Long userId = currentUser.id();
        if (semesterId != null) {
            return courseRepository.findByUserIdAndSemesterIdOrderByNameAsc(userId, semesterId)
                    .stream().map(CourseDto::from).toList();
        }
        return courseRepository.findByUserIdOrderByNameAsc(userId)
                .stream().map(CourseDto::from).toList();
    }

    @Transactional(readOnly = true)
    public CourseDto get(Long id) {
        return CourseDto.from(requireOwned(id));
    }

    @Transactional(readOnly = true)
    public Course requireOwned(Long id) {
        return courseRepository.findByIdAndUserId(id, currentUser.id())
                .orElseThrow(() -> new NotFoundException("Course not found"));
    }

    @Transactional
    public CourseDto create(CourseRequest req) {
        Course course = new Course();
        course.setUser(currentUser.entity());
        apply(course, req);
        return CourseDto.from(courseRepository.save(course));
    }

    @Transactional
    public CourseDto update(Long id, CourseRequest req) {
        Course course = requireOwned(id);
        apply(course, req);
        return CourseDto.from(courseRepository.save(course));
    }

    @Transactional
    public void delete(Long id) {
        Course course = requireOwned(id);
        courseRepository.delete(course);
    }

    private void apply(Course course, CourseRequest req) {
        course.setName(req.name().trim());
        course.setCode(trimToNull(req.code()));
        course.setProfessor(trimToNull(req.professor()));
        course.setColor(trimToNull(req.color()));

        if (req.semesterId() != null) {
            Semester semester = semesterService.requireOwned(req.semesterId());
            course.setSemester(semester);
        } else {
            course.setSemester(null);
        }

        course.getMeetingBlocks().clear();
        if (req.meetingBlocks() != null) {
            for (MeetingBlockDto dto : req.meetingBlocks()) {
                if (dto.endTime().isBefore(dto.startTime()) || dto.endTime().equals(dto.startTime())) {
                    throw new IllegalArgumentException("Meeting block end time must be after start time");
                }
                MeetingBlock mb = new MeetingBlock();
                mb.setCourse(course);
                mb.setDayOfWeek(dto.dayOfWeek());
                mb.setStartTime(dto.startTime());
                mb.setEndTime(dto.endTime());
                course.getMeetingBlocks().add(mb);
            }
        }
    }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
