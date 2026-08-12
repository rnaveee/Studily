package com.rnave.studily.course;

import com.rnave.studily.academic.AcademicItem;
import com.rnave.studily.academic.ItemStatus;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.ForbiddenException;
import com.rnave.studily.config.MatchKeys;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.course.CourseDtos.CourseDto;
import com.rnave.studily.course.CourseDtos.CourseMatchDto;
import com.rnave.studily.friend.FriendDtos.PublicUserDto;
import com.rnave.studily.semester.SemesterService;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class CourseMatchService {

    private static final int MAX_MATCHES = 20;

    private final CourseRepository courseRepository;
    private final UserRepository userRepository;
    private final CurrentUser currentUser;
    private final SemesterService semesterService;

    public CourseMatchService(CourseRepository courseRepository, UserRepository userRepository,
                              CurrentUser currentUser, SemesterService semesterService) {
        this.courseRepository = courseRepository;
        this.userRepository = userRepository;
        this.currentUser = currentUser;
        this.semesterService = semesterService;
    }

    @Transactional(readOnly = true)
    public List<CourseMatchDto> matches(String code) {
        String codeKey = MatchKeys.codeKey(code);
        User me = currentUser.entity();
        if (codeKey == null || me.getSchoolKey() == null || !me.isEmailVerified()) {
            return List.of();
        }
        List<Course> found = courseRepository.findMatching(codeKey, me.getSchoolKey(), me.getId());

        Map<String, List<Course>> groups = new LinkedHashMap<>();
        for (Course course : found) {
            groups.computeIfAbsent(signature(course), k -> new ArrayList<>()).add(course);
        }
        return groups.values().stream()
                .map(group -> CourseMatchDto.from(
                        group.get(0),
                        (int) group.stream().map(c -> c.getUser().getId()).distinct().count()))
                .sorted(Comparator.comparingInt(CourseMatchDto::userCount).reversed())
                .limit(MAX_MATCHES)
                .toList();
    }

    @Transactional
    public CourseDto importCourse(Long sourceCourseId, String code, Long semesterId) {
        User me = currentUser.entity();
        if (!me.isEmailVerified()) {
            throw new ForbiddenException("Verify your email to import a shared course");
        }
        Course source = courseRepository.findById(sourceCourseId)
                .orElseThrow(() -> new NotFoundException("Course not found"));
        String codeKey = MatchKeys.codeKey(code);
        boolean sameSchool = me.getSchoolKey() != null
                && me.getSchoolKey().equals(source.getUser().getSchoolKey());
        boolean discoverable = codeKey != null && codeKey.equals(source.getCodeKey());
        if (source.getUser().getId().equals(me.getId()) || !sameSchool || !discoverable) {
            throw new NotFoundException("Course not found");
        }

        Course course = new Course();
        course.setUser(me);
        course.setName(source.getName());
        course.setCode(source.getCode());
        course.setCodeKey(source.getCodeKey());
        course.setProfessor(source.getProfessor());
        course.setLocation(source.getLocation());
        course.setColor(source.getColor());
        if (semesterId != null) {
            course.setSemester(semesterService.requireOwned(semesterId));
        }
        for (MeetingBlock block : source.getMeetingBlocks()) {
            MeetingBlock copy = new MeetingBlock();
            copy.setCourse(course);
            copy.setDayOfWeek(block.getDayOfWeek());
            copy.setKind(block.getKind());
            copy.setStartTime(block.getStartTime());
            copy.setEndTime(block.getEndTime());
            copy.setLocation(block.getLocation());
            course.getMeetingBlocks().add(copy);
        }
        Map<UUID, UUID> seriesRemap = new HashMap<>();
        for (AcademicItem item : source.getItems()) {
            AcademicItem copy = new AcademicItem();
            copy.setCourse(course);
            copy.setType(item.getType());
            copy.setTitle(item.getTitle());
            copy.setDueAt(item.getDueAt());
            copy.setLocation(item.getLocation());
            copy.setWeight(item.getWeight());
            copy.setStatus(ItemStatus.TODO);
            if (item.getSeriesId() != null) {
                copy.setSeriesId(seriesRemap.computeIfAbsent(item.getSeriesId(), k -> UUID.randomUUID()));
                copy.setRecurrenceRule(item.getRecurrenceRule());
            }
            course.getItems().add(copy);
        }
        return CourseDto.from(courseRepository.save(course));
    }

    @Transactional(readOnly = true)
    public List<PublicUserDto> classmates(Long courseId) {
        User me = currentUser.entity();
        Course course = courseRepository.findByIdAndUserId(courseId, me.getId())
                .orElseThrow(() -> new NotFoundException("Course not found"));
        if (!me.isEmailVerified() || me.getSchoolKey() == null || course.getCodeKey() == null) {
            return List.of();
        }
        return userRepository.findClassmates(course.getCodeKey(), me.getSchoolKey(), me.getId())
                .stream().map(PublicUserDto::from).toList();
    }

    private String signature(Course c) {
        StringBuilder sb = new StringBuilder();
        sb.append(c.getName().trim().toLowerCase(Locale.ROOT)).append('|');
        sb.append(c.getProfessor() == null ? "" : c.getProfessor().trim().toLowerCase(Locale.ROOT)).append('|');
        c.getMeetingBlocks().stream()
                .map(b -> b.getDayOfWeek() + ":" + b.getStartTime() + "-" + b.getEndTime())
                .sorted()
                .forEach(s -> sb.append(s).append(','));
        sb.append('|');
        c.getItems().stream()
                .map(i -> i.getType() + ":" + i.getTitle().trim().toLowerCase(Locale.ROOT) + ":"
                        + DateTimeFormatter.ISO_INSTANT.format(i.getDueAt()))
                .sorted()
                .forEach(s -> sb.append(s).append(','));
        return sb.toString();
    }
}
