package com.rnave.studily.flashcard.generate;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.GlobalRateLimitFilter;
import com.rnave.studily.config.SlidingWindowRateLimiter;
import com.rnave.studily.config.TooManyRequestsException;
import com.rnave.studily.flashcard.generate.FlashcardGenDtos.GenAvailabilityDto;
import com.rnave.studily.flashcard.generate.FlashcardGenDtos.GeneratedDeckDto;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
public class FlashcardGenController {

    static final long WINDOW_MS = 24 * 60 * 60_000L;
    static final int PER_USER_PER_DAY = 10;
    static final int PER_IP_PER_DAY = 30;

    private final SlidingWindowRateLimiter userLimiter = new SlidingWindowRateLimiter(PER_USER_PER_DAY, WINDOW_MS);
    private final SlidingWindowRateLimiter ipLimiter = new SlidingWindowRateLimiter(PER_IP_PER_DAY, WINDOW_MS);

    private final FlashcardGenService service;
    private final CurrentUser currentUser;

    public FlashcardGenController(FlashcardGenService service, CurrentUser currentUser) {
        this.service = service;
        this.currentUser = currentUser;
    }

    @GetMapping("/api/flashcard-sets/generate/enabled")
    public GenAvailabilityDto enabled() {
        return service.availability();
    }

    @PostMapping(value = "/api/flashcard-sets/generate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public GeneratedDeckDto generate(@RequestParam(value = "files", required = false) List<MultipartFile> files,
                                     HttpServletRequest request) {
        limit(request);
        return service.generate(null, files, request.getParameterValues("pages"));
    }

    @PostMapping(value = "/api/flashcard-sets/{id}/generate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public GeneratedDeckDto generateInto(@PathVariable Long id,
                                         @RequestParam(value = "files", required = false) List<MultipartFile> files,
                                         HttpServletRequest request) {
        limit(request);
        return service.generate(id, files, request.getParameterValues("pages"));
    }

    private void limit(HttpServletRequest request) {
        if (!userLimiter.tryConsume("user:" + currentUser.id())) {
            throw new TooManyRequestsException("You've made flashcards from documents " + PER_USER_PER_DAY
                    + " times today. Try again tomorrow.");
        }
        if (!ipLimiter.tryConsume("ip:" + GlobalRateLimitFilter.clientIp(request))) {
            throw new TooManyRequestsException("Too many documents from this network today. Try again tomorrow.");
        }
    }

    @Scheduled(fixedRate = 10 * 60 * 60_000L)
    void evictStaleWindows() {
        userLimiter.evictStale();
        ipLimiter.evictStale();
    }
}
