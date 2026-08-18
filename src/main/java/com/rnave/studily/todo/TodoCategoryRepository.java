package com.rnave.studily.todo;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TodoCategoryRepository extends JpaRepository<TodoCategory, Long> {

    List<TodoCategory> findByUserIdOrderByNameAsc(Long userId);

    Optional<TodoCategory> findByIdAndUserId(Long id, Long userId);

    boolean existsByUserIdAndNameIgnoreCase(Long userId, String name);

    boolean existsByUserIdAndNameIgnoreCaseAndIdNot(Long userId, String name, Long id);
}
