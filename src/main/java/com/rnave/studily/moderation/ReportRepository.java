package com.rnave.studily.moderation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReportRepository extends JpaRepository<Report, Long> {

    boolean existsByReporterIdAndTargetUserIdAndReasonAndStatusAndKind(
            Long reporterId, Long targetUserId, ReportReason reason, ReportStatus status, ReportKind kind);

    boolean existsByReporterIdAndMessageIdAndStatus(Long reporterId, Long messageId, ReportStatus status);

    List<Report> findTop100ByTargetUserIdOrderByCreatedAtDesc(Long targetUserId);

    List<Report> findByTargetUserIdAndStatus(Long targetUserId, ReportStatus status);
}
