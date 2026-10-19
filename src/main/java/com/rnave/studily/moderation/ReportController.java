package com.rnave.studily.moderation;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.GlobalRateLimitFilter;
import com.rnave.studily.config.SlidingWindowRateLimiter;
import com.rnave.studily.config.TooManyRequestsException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private static final long WINDOW_MS = 60 * 60_000L;
    private static final int PER_USER_PER_HOUR = 10;
    private static final int PER_IP_PER_HOUR = 30;

    private final SlidingWindowRateLimiter userLimiter = new SlidingWindowRateLimiter(PER_USER_PER_HOUR, WINDOW_MS);
    private final SlidingWindowRateLimiter ipLimiter = new SlidingWindowRateLimiter(PER_IP_PER_HOUR, WINDOW_MS);

    private final ReportService reportService;
    private final CurrentUser currentUser;

    public ReportController(ReportService reportService, CurrentUser currentUser) {
        this.reportService = reportService;
        this.currentUser = currentUser;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void create(@Valid @RequestBody CreateReportRequest req, HttpServletRequest http) {
        if (!userLimiter.tryConsume("user:" + currentUser.id())
                || !ipLimiter.tryConsume("ip:" + GlobalRateLimitFilter.clientIp(http))) {
            throw new TooManyRequestsException("You've sent a lot of reports. Please try again later.");
        }
        try {
            reportService.create(req);
        } catch (DataIntegrityViolationException duplicate) {
            return;
        }
    }

    @Scheduled(fixedRate = 10 * WINDOW_MS)
    void evictStale() {
        userLimiter.evictStale();
        ipLimiter.evictStale();
    }

    public record CreateReportRequest(
            @NotNull ReportKind kind,
            Long userId,
            Long messageId,
            @NotNull ReportReason reason,
            @Size(max = 1000) String details) {
    }
}
