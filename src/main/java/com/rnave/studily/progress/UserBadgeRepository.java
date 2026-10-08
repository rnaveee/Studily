package com.rnave.studily.progress;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserBadgeRepository extends JpaRepository<UserBadge, Long> {

    List<UserBadge> findByUserId(Long userId);

    boolean existsByUserIdAndBadgeCode(Long userId, String code);

    List<UserBadge> findByUserIdAndFeaturedSlotNotNullOrderByFeaturedSlot(Long userId);

    long countByUserId(Long userId);
}
