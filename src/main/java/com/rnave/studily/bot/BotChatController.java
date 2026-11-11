package com.rnave.studily.bot;

import com.rnave.studily.bot.BotDtos.ChatDto;
import com.rnave.studily.bot.BotDtos.ChatSummaryDto;
import com.rnave.studily.bot.BotDtos.CreateChatRequest;
import com.rnave.studily.bot.BotDtos.RenameRequest;
import com.rnave.studily.bot.BotDtos.SendRequest;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.SlidingWindowRateLimiter;
import com.rnave.studily.config.TooManyRequestsException;
import com.rnave.studily.filebank.BankFileDto;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

@RestController
@RequestMapping("/api/bot/chats")
public class BotChatController {

    static final int PER_USER_PER_MINUTE = 12;

    private final SlidingWindowRateLimiter limiter = new SlidingWindowRateLimiter(PER_USER_PER_MINUTE, 60_000L);

    private final BotChatService service;
    private final CurrentUser currentUser;

    public BotChatController(BotChatService service, CurrentUser currentUser) {
        this.service = service;
        this.currentUser = currentUser;
    }

    @GetMapping
    public List<ChatSummaryDto> list(@RequestParam(value = "mode", defaultValue = "CHAT") BotMode mode) {
        return service.list(mode);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ChatDto create(@RequestBody(required = false) CreateChatRequest request) {
        return service.create(request == null ? new CreateChatRequest(null, null) : request);
    }

    @GetMapping("/{id}")
    public ChatDto get(@PathVariable long id) {
        return service.get(id);
    }

    @PatchMapping("/{id}")
    public ChatDto rename(@PathVariable long id, @Valid @RequestBody RenameRequest request) {
        return service.rename(id, request.title());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long id) {
        service.delete(id);
    }

    @PostMapping(value = "/{id}/files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public List<BankFileDto> upload(@PathVariable long id,
                                    @RequestParam(value = "files", required = false) List<MultipartFile> files) {
        limit();
        return service.upload(id, files);
    }

    @PostMapping(value = "/{id}/messages", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter send(@PathVariable long id, @Valid @RequestBody SendRequest request,
                           HttpServletResponse response) {
        limit();
        response.setHeader("Cache-Control", "no-cache");
        response.setHeader("X-Accel-Buffering", "no");
        return service.send(id, request.body());
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
