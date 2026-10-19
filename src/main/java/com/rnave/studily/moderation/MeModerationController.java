package com.rnave.studily.moderation;

import com.rnave.studily.moderation.MeModerationService.MeModerationDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/me/moderation")
public class MeModerationController {

    private final MeModerationService service;

    public MeModerationController(MeModerationService service) {
        this.service = service;
    }

    @GetMapping
    public MeModerationDto current() {
        return service.current();
    }

    @PostMapping("/warnings/ack")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void acknowledge(@Valid @RequestBody AckRequest req) {
        service.acknowledge(req.ids());
    }

    public record AckRequest(@NotNull @Size(max = 20) List<Long> ids) {
    }
}
