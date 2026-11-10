package com.rnave.studily.feynman;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FeynmanSessionRepository extends JpaRepository<FeynmanSession, Long> {

    List<FeynmanSession> findByUserIdOrderByUpdatedAtDesc(Long userId);

    Optional<FeynmanSession> findByIdAndUserId(Long id, Long userId);
}
