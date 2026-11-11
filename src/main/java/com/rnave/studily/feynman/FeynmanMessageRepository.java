package com.rnave.studily.feynman;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FeynmanMessageRepository extends JpaRepository<FeynmanMessage, Long> {

    List<FeynmanMessage> findBySessionIdOrderByIdAsc(Long sessionId);

    long countBySessionIdAndRole(Long sessionId, FeynmanRole role);
}
