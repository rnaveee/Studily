package com.rnave.studily.config;

import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseRepository;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Component
public class MatchKeyBackfill implements ApplicationRunner {

    private final UserRepository userRepository;
    private final CourseRepository courseRepository;

    public MatchKeyBackfill(UserRepository userRepository, CourseRepository courseRepository) {
        this.userRepository = userRepository;
        this.courseRepository = courseRepository;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        List<User> users = userRepository.findBySchoolNotNullAndSchoolKeyIsNull();
        for (User user : users) {
            user.setSchoolKey(MatchKeys.schoolKey(user.getSchool()));
        }
        userRepository.saveAll(users);

        List<Course> courses = courseRepository.findByCodeNotNullAndCodeKeyIsNull();
        for (Course course : courses) {
            course.setCodeKey(MatchKeys.codeKey(course.getCode()));
        }
        courseRepository.saveAll(courses);
    }
}
