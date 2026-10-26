package com.rnave.studily.canvas;

import com.rnave.studily.canvas.CanvasDtos.FeedRequest;
import com.rnave.studily.canvas.CanvasDtos.FeedResult;
import com.rnave.studily.config.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/canvas", "/api/school-feed"})
public class CanvasController {

    private final CanvasFeedService canvasFeedService;

    private final CurrentUser currentUser;

    public CanvasController(CanvasFeedService canvasFeedService, CurrentUser currentUser) {
        this.canvasFeedService = canvasFeedService;
        this.currentUser = currentUser;
    }

    @PostMapping("/feed")
    public FeedResult importFeed(@Valid @RequestBody FeedRequest req) {
        return canvasFeedService.importFeed(currentUser.entity(), req);
    }
}
