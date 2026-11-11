package com.rnave.studily.feynman;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FeynmanAssessmentRepository extends JpaRepository<FeynmanAssessment, Long> {

    List<FeynmanAssessment> findBySessionIdOrderByIdAsc(Long sessionId);
}
