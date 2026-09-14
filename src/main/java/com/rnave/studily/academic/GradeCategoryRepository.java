package com.rnave.studily.academic;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GradeCategoryRepository extends JpaRepository<GradeCategory, Long> {

    List<GradeCategory> findByCourseIdOrderByPositionAscIdAsc(Long courseId);

    Optional<GradeCategory> findByIdAndCourseUserId(Long id, Long userId);

    List<GradeCategory> findByCourseUserId(Long userId);

    boolean existsByCourseIdAndNameIgnoreCase(Long courseId, String name);

    boolean existsByCourseIdAndNameIgnoreCaseAndIdNot(Long courseId, String name, Long id);
}
