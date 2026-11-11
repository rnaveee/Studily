package com.rnave.studily.progress;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserBotOutfitRepository extends JpaRepository<UserBotOutfit, Long> {

    List<UserBotOutfit> findByUserId(Long userId);

    boolean existsByUserIdAndOutfitCode(Long userId, String code);
}
