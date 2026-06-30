package com.rnave.studily.classmate;

import com.rnave.studily.classmate.ClassmateDtos.ClassmateSuggestion;
import com.rnave.studily.classmate.ClassmateDtos.PublicUserDto;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseRepository;
import com.rnave.studily.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ClassmateService {

    private final CourseRepository courseRepository;
    private final ClassmateRepository classmateRepository;
    private final CurrentUser currentUser;

    public ClassmateService(CourseRepository courseRepository, ClassmateRepository classmateRepository,
                            CurrentUser currentUser) {
        this.courseRepository = courseRepository;
        this.classmateRepository = classmateRepository;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<ClassmateSuggestion> suggestions() {
        User me = currentUser.entity();

        if (me.getSchool() == null || me.getSchool().isBlank()) {
            return List.of();
        }
        List<String> myCodes = courseRepository.findByUserIdOrderByNameAsc(me.getId()).stream()
                .map(Course::getCode)
                .filter(c -> c != null && !c.isBlank())
                .map(c -> c.trim().toUpperCase())
                .distinct()
                .toList();
        if (myCodes.isEmpty()) {
            return List.of();
        }

        return classmateRepository.findClassmateCourses(me.getId(), me.getSchool(), myCodes).stream()
                .map(c -> new ClassmateSuggestion(
                        PublicUserDto.from(c.getUser()), c.getCode(), c.getName()))
                .toList();
    }
}
