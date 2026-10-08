package com.rnave.studily.progress;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BadgeRepository extends JpaRepository<Badge, String> {

    List<Badge> findByActiveTrueOrderByCategoryAscSortOrderAsc();
}
