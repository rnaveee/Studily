package com.rnave.studily.bot;

import com.rnave.studily.bot.BotDtos.StatusDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/bot")
public class BotStatusController {

    private final BotChatService service;

    public BotStatusController(BotChatService service) {
        this.service = service;
    }

    @GetMapping("/status")
    public StatusDto status() {
        return service.status();
    }
}
