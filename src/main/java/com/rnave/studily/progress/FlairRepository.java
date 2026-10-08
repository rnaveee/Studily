package com.rnave.studily.progress;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FlairRepository extends JpaRepository<Flair, String> {

    List<Flair> findByActiveTrueOrderBySortOrderAsc();
}
