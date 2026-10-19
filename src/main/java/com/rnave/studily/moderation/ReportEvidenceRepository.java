package com.rnave.studily.moderation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface ReportEvidenceRepository extends JpaRepository<ReportEvidence, Long> {

    @Query("select e.reportId from ReportEvidence e where e.reportId in :ids")
    List<Long> findExistingReportIds(@Param("ids") Collection<Long> ids);
}
