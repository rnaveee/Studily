package com.rnave.studily.bot;

import com.rnave.studily.bot.BotDtos.AnswerResultDto;
import com.rnave.studily.bot.BotDtos.ChatDto;
import com.rnave.studily.bot.BotDtos.MessageDto;
import com.rnave.studily.bot.BotDtos.StartPracticeRequest;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.SlidingWindowRateLimiter;
import com.rnave.studily.config.TooManyRequestsException;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/bot/practice")
public class PracticeController {

    static final int PER_USER_PER_MINUTE = 12;

    private final SlidingWindowRateLimiter limiter = new SlidingWindowRateLimiter(PER_USER_PER_MINUTE, 60_000L);

    private final PracticeService service;
    private final CurrentUser currentUser;

    public PracticeController(PracticeService service, CurrentUser currentUser) {
        this.service = service;
        this.currentUser = currentUser;
    }

    @PostMapping
    public ChatDto start(@Valid @RequestBody StartPracticeRequest body) {
        limit();
        return service.start(body);
    }

    @PostMapping("/{id}/next")
    public MessageDto next(@PathVariable Long id) {
        limit();
        return service.next(id);
    }

    @PostMapping("/{id}/reveal")
    public MessageDto reveal(@PathVariable Long id) {
        return service.reveal(id);
    }

    @PostMapping(value = "/{id}/answer", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AnswerResultDto answer(@PathVariable Long id,
                                  @RequestParam(value = "text", required = false) String text,
                                  @RequestParam(value = "photo", required = false) MultipartFile photo) {
        limit();
        return service.answer(id, text, photo);
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
