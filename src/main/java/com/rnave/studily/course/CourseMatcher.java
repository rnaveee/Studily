package com.rnave.studily.course;

import com.rnave.studily.canvas.CourseCodes;
import com.rnave.studily.course.CourseDtos.CourseDto;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Component
public class CourseMatcher {

    private static final int BY_NAME = 1;
    private static final int BY_CODE = 2;

    private final CourseRepository courseRepository;

    public CourseMatcher(CourseRepository courseRepository) {
        this.courseRepository = courseRepository;
    }

    public Course best(Long userId, String name, String code, Long semesterId, boolean skipLinked) {
        List<Course> found = similar(userId, name, code, semesterId, skipLinked);
        return found.isEmpty() ? null : found.getFirst();
    }

    public List<Course> similar(Long userId, String name, String code, Long semesterId, boolean skipLinked) {
        Set<String> wantedCodes = baseKeys(code, name);
        String wantedName = nameKey(name);
        if (wantedCodes.isEmpty() && wantedName == null) {
            return List.of();
        }
        List<Scored> scored = new ArrayList<>();
        for (Course course : courseRepository.findByUserIdOrderByNameAsc(userId)) {
            if (skipLinked && (course.getCanvasCourseId() != null || course.getLmsCourseId() != null)) {
                continue;
            }
            int score = 0;
            if (!wantedCodes.isEmpty() && intersects(wantedCodes, baseKeys(course.getCode(), course.getName()))) {
                score = BY_CODE;
            } else if (wantedName != null && wantedName.equals(nameKey(course.getName()))) {
                score = BY_NAME;
            }
            if (score > 0) {
                boolean sameSemester = semesterId != null && course.getSemester() != null
                        && semesterId.equals(course.getSemester().getId());
                scored.add(new Scored(course, score, sameSemester));
            }
        }
        scored.sort(Comparator.comparingInt(Scored::score).reversed()
                .thenComparing(Comparator.comparing(Scored::sameSemester).reversed())
                .thenComparing(s -> s.course().getId(), Comparator.nullsLast(Comparator.naturalOrder())));
        return scored.stream().map(Scored::course).toList();
    }

    @Transactional(readOnly = true)
    public List<CourseDto> similarDtos(Long userId, String name, String code, Long semesterId) {
        return similar(userId, name, code, semesterId, false).stream().map(CourseDto::from).toList();
    }

    private static Set<String> baseKeys(String first, String second) {
        Set<String> keys = new HashSet<>();
        String a = CourseCodes.baseKey(first);
        String b = CourseCodes.baseKey(second);
        if (a != null) {
            keys.add(a);
        }
        if (b != null) {
            keys.add(b);
        }
        return keys;
    }

    private static boolean intersects(Set<String> a, Set<String> b) {
        for (String key : a) {
            if (b.contains(key)) {
                return true;
            }
        }
        return false;
    }

    private static String nameKey(String name) {
        if (name == null) {
            return null;
        }
        String key = name.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
        return key.isEmpty() ? null : key;
    }

    private record Scored(Course course, int score, boolean sameSemester) {
    }
}
