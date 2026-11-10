package com.rnave.studily.feynman;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FeynmanDocumentRepository extends JpaRepository<FeynmanDocument, Long> {

    List<FeynmanDocument> findBySessionIdOrderByIdAsc(Long sessionId);

    long countBySessionId(Long sessionId);
}
