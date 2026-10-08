package com.rnave.studily.progress;

import com.rnave.studily.progress.ProgressDtos.ProgressDto;
import com.rnave.studily.progress.ProgressDtos.PublicProgressDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ProgressController {

    private final ProgressService progressService;

    public ProgressController(ProgressService progressService) {
        this.progressService = progressService;
    }

    @GetMapping("/api/progress/me")
    public ProgressDto me() {
        return progressService.me();
    }

    @GetMapping("/api/users/{id}/progress")
    public PublicProgressDto forUser(@PathVariable Long id) {
        return progressService.publicFor(id);
    }
}
