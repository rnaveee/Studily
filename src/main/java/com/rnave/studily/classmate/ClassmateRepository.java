package com.rnave.studily.classmate;

import com.rnave.studily.course.Course;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ClassmateRepository extends JpaRepository<Course, Long> {

    @Query("""
            select c from Course c
            join c.user u
            where u.id <> :userId
              and u.school = :school
              and upper(c.code) in :codes
            order by c.code asc, u.username asc
            """)
    List<Course> findClassmateCourses(
            @Param("userId") Long userId,
            @Param("school") String school,
            @Param("codes") List<String> upperCodes);
}
