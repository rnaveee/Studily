package com.rnave.studily.progress;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserFlairRepository extends JpaRepository<UserFlair, Long> {

    List<UserFlair> findByUserId(Long userId);

    boolean existsByUserIdAndFlairCode(Long userId, String code);

    long countByUserId(Long userId);
}
