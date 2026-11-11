package com.rnave.studily.progress;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BotOutfitRepository extends JpaRepository<BotOutfit, String> {

    List<BotOutfit> findByActiveTrueOrderBySortOrderAsc();
}
