package com.rnave.studily.linkpreview;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.SlidingWindowRateLimiter;
import com.rnave.studily.config.TooManyRequestsException;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

@RestController
@RequestMapping("/api/link-preview")
public class LinkPreviewController {

    private static final long WINDOW_MS = 60_000;

    private final SlidingWindowRateLimiter limiter = new SlidingWindowRateLimiter(60, WINDOW_MS);

    private final LinkPreviewService linkPreviewService;
    private final CurrentUser currentUser;

    public LinkPreviewController(LinkPreviewService linkPreviewService, CurrentUser currentUser) {
        this.linkPreviewService = linkPreviewService;
        this.currentUser = currentUser;
    }

    @GetMapping
    public ResponseEntity<LinkPreviewDto> preview(@RequestParam String url) {
        if (!limiter.tryConsume("user:" + currentUser.id())) {
            throw new TooManyRequestsException("Too many link previews. Please wait a minute.");
        }
        return linkPreviewService.preview(url)
                .map(p -> ResponseEntity.ok()
                        .cacheControl(CacheControl.maxAge(Duration.ofHours(6)).cachePrivate())
                        .body(p))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @Scheduled(fixedRate = 10 * WINDOW_MS)
    void evictStaleWindows() {
        limiter.evictStale();
    }
}
