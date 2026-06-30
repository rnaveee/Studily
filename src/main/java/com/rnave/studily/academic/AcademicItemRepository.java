package com.rnave.studily.academic;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface AcademicItemRepository extends JpaRepository<AcademicItem, Long> {

    List<AcademicItem> findByCourseIdOrderByDueAtAsc(Long courseId);

    Optional<AcademicItem> findByIdAndCourseUserId(Long id, Long userId);

    List<AcademicItem> findByCourseUserIdAndDueAtBetweenOrderByDueAtAsc(Long userId, Instant from, Instant to);

    List<AcademicItem> findByCourseUserIdAndCourseSemesterIdAndDueAtBetweenOrderByDueAtAsc(
            Long userId, Long semesterId, Instant from, Instant to);

    List<AcademicItem> findByStatusNotAndDueAtBetween(ItemStatus status, Instant from, Instant to);

    Optional<AcademicItem> findFirstByCourseUserIdAndTypeAndDueAtAfterOrderByDueAtAsc(
            Long userId, ItemType type, Instant after);

    Optional<AcademicItem> findFirstByCourseUserIdAndCourseSemesterIdAndTypeAndDueAtAfterOrderByDueAtAsc(
            Long userId, Long semesterId, ItemType type, Instant after);
}
