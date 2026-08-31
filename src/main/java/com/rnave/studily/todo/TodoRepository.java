package com.rnave.studily.todo;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface TodoRepository extends JpaRepository<Todo, Long> {

    List<Todo> findByUserId(Long userId);

    boolean existsByUserId(Long userId);

    Optional<Todo> findByIdAndUserId(Long id, Long userId);

    List<Todo> findByUserIdAndCompletedAtIsNullAndDueAtBetweenOrderByDueAtAsc(
            Long userId, Instant from, Instant to);
}
