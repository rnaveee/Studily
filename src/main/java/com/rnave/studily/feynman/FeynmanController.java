package com.rnave.studily.feynman;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.SlidingWindowRateLimiter;
import com.rnave.studily.config.TooManyRequestsException;
import com.rnave.studily.feynman.FeynmanDtos.AvailabilityDto;
import com.rnave.studily.feynman.FeynmanDtos.SendMessageRequest;
import com.rnave.studily.feynman.FeynmanDtos.SessionDto;
import com.rnave.studily.feynman.FeynmanDtos.SessionSummaryDto;
import com.rnave.studily.feynman.FeynmanDtos.TurnDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/feynman")
public class FeynmanController {

    static final int PER_USER_PER_MINUTE = 12;

    private final SlidingWindowRateLimiter limiter = new SlidingWindowRateLimiter(PER_USER_PER_MINUTE, 60_000L);

    private final FeynmanService service;
    private final CurrentUser currentUser;

    public FeynmanController(FeynmanService service, CurrentUser currentUser) {
        this.service = service;
        this.currentUser = currentUser;
    }

    @GetMapping("/enabled")
    public AvailabilityDto enabled() {
        return service.availability();
    }

    @GetMapping("/sessions")
    public List<SessionSummaryDto> list() {
        return service.list();
    }

    @PostMapping(value = "/sessions", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public SessionDto start(@RequestParam(value = "title", required = false) String title,
                            @RequestParam(value = "focus", required = false) String focus,
                            @RequestParam(value = "files", required = false) List<MultipartFile> files) {
        limit();
        return service.start(title, focus, files);
    }

    @GetMapping("/sessions/{id}")
    public SessionDto get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping(value = "/sessions/{id}/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public SessionDto addDocuments(@PathVariable Long id,
                                   @RequestParam(value = "files", required = false) List<MultipartFile> files) {
        limit();
        return service.addDocuments(id, files);
    }

    @PostMapping("/sessions/{id}/messages")
    public TurnDto send(@PathVariable Long id, @Valid @RequestBody SendMessageRequest body) {
        limit();
        return service.send(id, body.body());
    }

    @PostMapping("/sessions/{id}/finish")
    public TurnDto finish(@PathVariable Long id) {
        limit();
        return service.finish(id);
    }

    @DeleteMapping("/sessions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    private void limit() {
        if (!limiter.tryConsume("user:" + currentUser.id())) {
            throw new TooManyRequestsException("Slow down a little. StudilyBot needs a moment.");
        }
    }

    @Scheduled(fixedRate = 10 * 60_000L)
    void evictStaleWindows() {
        limiter.evictStale();
    }
}
