package com.rnave.studily.user;

import com.rnave.studily.progress.ProgressDtos.ProgressDelta;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me/welcome")
public class WelcomeController {

    private final WelcomeService welcomeService;

    public WelcomeController(WelcomeService welcomeService) {
        this.welcomeService = welcomeService;
    }

    @PostMapping("/finish")
    public ProgressDelta finish() {
        return welcomeService.finish();
    }
}
