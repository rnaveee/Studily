package com.rnave.studily.semester;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface SemesterRepository extends JpaRepository<Semester, Long> {

    List<Semester> findByUserIdOrderByYearDescTermAsc(Long userId);

    Optional<Semester> findByIdAndUserId(Long id, Long userId);

    boolean existsByUserIdAndTermAndYear(Long userId, SemesterTerm term, Integer year);

    Optional<Semester> findFirstByUserIdAndStartDateLessThanEqualAndEndDateGreaterThanEqualOrderByStartDateDesc(
            Long userId, LocalDate date, LocalDate date2);
}
