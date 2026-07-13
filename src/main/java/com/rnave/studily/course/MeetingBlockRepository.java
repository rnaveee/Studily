package com.rnave.studily.course;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public interface MeetingBlockRepository extends JpaRepository<MeetingBlock, Long> {

    @Query("""
            select mb from MeetingBlock mb
            join fetch mb.course c
            join fetch c.user
            left join c.semester s
            where mb.dayOfWeek = :day
              and mb.startTime >= :from and mb.startTime < :to
              and (s is null or (s.startDate <= :date and s.endDate >= :date))
            """)
    List<MeetingBlock> findStartingBetween(DayOfWeek day, LocalTime from, LocalTime to, LocalDate date);
}
