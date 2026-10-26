package com.rnave.studily.canvas;

import com.rnave.studily.canvas.CanvasDtos.FeedRequest;
import com.rnave.studily.canvas.CanvasDtos.FeedResult;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.user.User;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/canvas", "/api/school-feed"})
public class CanvasController {

    private static final Logger log = LoggerFactory.getLogger(CanvasController.class);

    private final CanvasFeedService canvasFeedService;

    private final SchoolFeedService schoolFeedService;

    private final CurrentUser currentUser;

    public CanvasController(CanvasFeedService canvasFeedService, SchoolFeedService schoolFeedService,
                            CurrentUser currentUser) {
        this.canvasFeedService = canvasFeedService;
        this.schoolFeedService = schoolFeedService;
        this.currentUser = currentUser;
    }

    @PostMapping("/feed")
    public FeedResult importFeed(@Valid @RequestBody FeedRequest req) {
        User user = currentUser.entity();
        FeedResult result = canvasFeedService.importFeed(user, req);
        try {
            schoolFeedService.remember(user, req, result);
        } catch (RuntimeException e) {
            log.warn("Could not save school feed for user {}: {}", user.getId(), e.getClass().getSimpleName());
        }
        return result;
    }
}
