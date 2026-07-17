package com.rnave.studily.conversation;

import com.rnave.studily.conversation.ConversationDtos.ConversationDto;
import com.rnave.studily.conversation.ConversationDtos.CreateGroupRequest;
import com.rnave.studily.conversation.ConversationDtos.MessageDto;
import com.rnave.studily.conversation.ConversationDtos.OpenDirectRequest;
import com.rnave.studily.conversation.ConversationDtos.SendMessageRequest;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.PageResponse;
import com.rnave.studily.config.SlidingWindowRateLimiter;
import com.rnave.studily.config.TooManyRequestsException;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;

@RestController
@RequestMapping("/api/conversations")
public class ConversationController {

    private static final long UPLOAD_WINDOW_MS = 10 * 60_000;

    private final SlidingWindowRateLimiter uploadLimiter =
            new SlidingWindowRateLimiter(30, UPLOAD_WINDOW_MS);

    private final ConversationService conversationService;
    private final CurrentUser currentUser;

    public ConversationController(ConversationService conversationService, CurrentUser currentUser) {
        this.conversationService = conversationService;
        this.currentUser = currentUser;
    }

    @GetMapping
    public List<ConversationDto> list(@RequestParam(required = false) ConversationType type) {
        return conversationService.list(type);
    }

    @GetMapping("/{id}")
    public ConversationDto get(@PathVariable Long id) {
        return conversationService.get(id);
    }

    @PostMapping("/direct")
    public ConversationDto openDirect(@Valid @RequestBody OpenDirectRequest req) {
        return conversationService.openDirect(req.userId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ConversationDto createGroup(@Valid @RequestBody CreateGroupRequest req) {
        return conversationService.createGroup(req.name(), req.memberIds());
    }

    @GetMapping("/{id}/messages")
    public PageResponse<MessageDto> messages(
            @PathVariable Long id,
            @RequestParam(required = false) Long before,
            @RequestParam(defaultValue = "50") int limit) {
        return conversationService.messages(id, before, limit);
    }

    @PostMapping("/{id}/messages")
    @ResponseStatus(HttpStatus.CREATED)
    public MessageDto send(@PathVariable Long id, @Valid @RequestBody SendMessageRequest req) {
        return conversationService.send(id, req.body());
    }

    @PostMapping("/{id}/attachments")
    @ResponseStatus(HttpStatus.CREATED)
    public MessageDto sendAttachment(@PathVariable Long id, @RequestParam("file") MultipartFile file) {
        if (!uploadLimiter.tryConsume("user:" + currentUser.id())) {
            throw new TooManyRequestsException("You're uploading too many files — please wait a few minutes.");
        }
        return conversationService.sendAttachment(id, file);
    }

    @GetMapping("/{id}/messages/{messageId}/attachment")
    public ResponseEntity<byte[]> attachment(@PathVariable Long id, @PathVariable Long messageId) {
        ConversationService.AttachmentContent content = conversationService.attachment(id, messageId);
        boolean inline = content.contentType().startsWith("image/")
                || content.contentType().equals("application/pdf");
        ContentDisposition disposition = (inline ? ContentDisposition.inline() : ContentDisposition.attachment())
                .filename(content.filename(), StandardCharsets.UTF_8)
                .build();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(content.contentType()))
                .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePrivate())
                .header("Content-Disposition", disposition.toString())
                .body(content.data());
    }

    @Scheduled(fixedRate = 10 * UPLOAD_WINDOW_MS)
    void evictStaleUploadWindows() {
        uploadLimiter.evictStale();
    }
}
