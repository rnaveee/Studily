package com.rnave.studily.course;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CourseRepository extends JpaRepository<Course, Long> {

    List<Course> findByUserIdOrderByNameAsc(Long userId);

    List<Course> findByUserIdAndSemesterIdOrderByNameAsc(Long userId, Long semesterId);

    List<Course> findByUserIdAndSemesterIsNullOrderByNameAsc(Long userId);

    Optional<Course> findByIdAndUserId(Long id, Long userId);
}
