package com.rnave.studily.canvas;

import com.rnave.studily.canvas.CanvasDtos.FeedRequest;
import com.rnave.studily.canvas.CanvasDtos.FeedResult;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/canvas")
public class CanvasController {

    private final CanvasFeedService canvasFeedService;

    public CanvasController(CanvasFeedService canvasFeedService) {
        this.canvasFeedService = canvasFeedService;
    }

    @PostMapping("/feed")
    public FeedResult importFeed(@Valid @RequestBody FeedRequest req) {
        return canvasFeedService.importFeed(req);
    }
}
