package com.rnave.studily.semester;

import com.rnave.studily.academic.AcademicItem;
import com.rnave.studily.academic.AcademicItemRepository;
import com.rnave.studily.academic.Grades;
import com.rnave.studily.academic.ItemStatus;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseRepository;
import com.rnave.studily.semester.SemesterDtos.CourseGradeDto;
import com.rnave.studily.semester.SemesterDtos.SemesterStatsDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class SemesterStatsService {

    private final SemesterRepository semesterRepository;
    private final CourseRepository courseRepository;
    private final AcademicItemRepository itemRepository;
    private final CurrentUser currentUser;

    public SemesterStatsService(SemesterRepository semesterRepository, CourseRepository courseRepository,
                                AcademicItemRepository itemRepository, CurrentUser currentUser) {
        this.semesterRepository = semesterRepository;
        this.courseRepository = courseRepository;
        this.itemRepository = itemRepository;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<SemesterStatsDto> list() {
        Long userId = currentUser.id();
        List<Course> courses = courseRepository.findByUserIdOrderByNameAsc(userId);

        Map<Long, List<AcademicItem>> itemsByCourse = new HashMap<>();
        for (AcademicItem item : itemRepository.findByCourseUserId(userId)) {
            itemsByCourse.computeIfAbsent(item.getCourse().getId(), k -> new ArrayList<>()).add(item);
        }

        Map<Long, List<Course>> coursesBySemester = new HashMap<>();
        for (Course course : courses) {
            if (course.getSemester() != null) {
                coursesBySemester.computeIfAbsent(course.getSemester().getId(), k -> new ArrayList<>()).add(course);
            }
        }

        Instant now = Instant.now();
        return semesterRepository.findByUserIdOrderByYearDescTermAsc(userId).stream()
                .map(s -> statsFor(s.getId(), coursesBySemester.getOrDefault(s.getId(), List.of()),
                        itemsByCourse, now))
                .toList();
    }

    private SemesterStatsDto statsFor(Long semesterId, List<Course> courses,
                                      Map<Long, List<AcademicItem>> itemsByCourse, Instant now) {
        List<CourseGradeDto> grades = new ArrayList<>();
        double gradeSum = 0;
        int gradedCourses = 0;
        int itemsTotal = 0;
        int itemsDone = 0;
        int itemsGraded = 0;
        int upcoming = 0;
        Instant nextDueAt = null;

        for (Course course : courses) {
            List<AcademicItem> items = itemsByCourse.getOrDefault(course.getId(), List.of());
            Grades.CourseGrade grade = Grades.of(items);

            grades.add(new CourseGradeDto(
                    course.getId(), course.getName(), course.getCode(), course.getColor(),
                    grade.percent(), grade.gradedWeight(), grade.totalWeight(),
                    grade.gradedCount(), grade.itemCount()));

            if (grade.percent() != null) {
                gradeSum += grade.percent();
                gradedCourses++;
            }
            itemsTotal += items.size();
            itemsGraded += grade.gradedCount();

            for (AcademicItem item : items) {
                if (item.getStatus() == ItemStatus.DONE) {
                    itemsDone++;
                } else if (item.getDueAt().isAfter(now)) {
                    upcoming++;
                    if (nextDueAt == null || item.getDueAt().isBefore(nextDueAt)) {
                        nextDueAt = item.getDueAt();
                    }
                }
            }
        }

        Double average = gradedCourses > 0 ? gradeSum / gradedCourses : null;
        return new SemesterStatsDto(semesterId, average, courses.size(), gradedCourses,
                itemsTotal, itemsDone, itemsGraded, upcoming, nextDueAt, grades);
    }
}
