package com.rnave.studily.admin;

import com.rnave.studily.config.GlobalRateLimitFilter;
import com.rnave.studily.user.User;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminAuditService {

    private static final Logger log = LoggerFactory.getLogger(AdminAuditService.class);
    private static final int MAX_DETAIL = 8000;

    private final AdminAuditLogRepository repository;

    public AdminAuditService(AdminAuditLogRepository repository) {
        this.repository = repository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(User actor, HttpServletRequest request, String action, String target, String detail) {
        AdminAuditLog entry = new AdminAuditLog();
        entry.setActorId(actor == null ? null : actor.getId());
        entry.setActorName(actor == null ? "unknown" : "@" + actor.getUsername());
        entry.setAction(action);
        entry.setTarget(truncate(target, 255));
        entry.setDetail(truncate(detail, MAX_DETAIL));
        entry.setIp(request == null ? null : truncate(GlobalRateLimitFilter.clientIp(request), 64));
        try {
            repository.save(entry);
        } catch (RuntimeException e) {
            log.error("Failed to write admin audit entry for action {}", action, e);
        }
        log.info("admin action={} target={} actor={}", action, target, entry.getActorName());
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max - 1) + "…";
    }
}
