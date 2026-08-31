package com.rnave.studily.admin;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminAuditLogRepository extends JpaRepository<AdminAuditLog, Long> {

    Slice<AdminAuditLog> findAllByOrderByCreatedAtDescIdDesc(Pageable pageable);
}
