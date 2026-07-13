package com.rnave.studily.calendar;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface CalendarEventRepository extends JpaRepository<CalendarEvent, Long> {

    List<CalendarEvent> findByUserIdAndStartAtBetweenOrderByStartAtAsc(Long userId, Instant from, Instant to);

    Optional<CalendarEvent> findByIdAndUserId(Long id, Long userId);

    List<CalendarEvent> findByStartAtBetween(Instant from, Instant to);
}
