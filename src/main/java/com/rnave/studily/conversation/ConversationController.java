package com.rnave.studily.conversation;

import com.rnave.studily.conversation.ConversationDtos.ConversationDto;
import com.rnave.studily.conversation.ConversationDtos.CreateGroupRequest;
import com.rnave.studily.conversation.ConversationDtos.MessageDto;
import com.rnave.studily.conversation.ConversationDtos.OpenDirectRequest;
import com.rnave.studily.conversation.ConversationDtos.SendMessageRequest;
import com.rnave.studily.config.PageResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/conversations")
public class ConversationController {

    private final ConversationService conversationService;

    public ConversationController(ConversationService conversationService) {
        this.conversationService = conversationService;
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
}
