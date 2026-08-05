package com.rnave.studily.course;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CourseRepository extends JpaRepository<Course, Long> {

    List<Course> findByUserIdOrderByNameAsc(Long userId);

    List<Course> findByUserIdAndSemesterIdOrderByNameAsc(Long userId, Long semesterId);

    List<Course> findByUserIdAndSemesterIsNullOrderByNameAsc(Long userId);

    Optional<Course> findByIdAndUserId(Long id, Long userId);

    List<Course> findByCodeNotNullAndCodeKeyIsNull();

    @Query("""
            select c from Course c
            where c.codeKey = :codeKey and c.user.schoolKey = :schoolKey and c.user.id <> :userId""")
    List<Course> findMatching(@Param("codeKey") String codeKey,
                              @Param("schoolKey") String schoolKey,
                              @Param("userId") Long userId);
}
