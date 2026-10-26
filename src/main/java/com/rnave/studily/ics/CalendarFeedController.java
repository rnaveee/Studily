package com.rnave.studily.ics;

import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.ics.IcsDtos.FeedLinkCreated;
import com.rnave.studily.ics.IcsDtos.FeedLinkStatus;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

@RestController
public class CalendarFeedController {

    private final CalendarFeedService feedService;

    public CalendarFeedController(CalendarFeedService feedService) {
        this.feedService = feedService;
    }

    @PostMapping("/api/calendar/feed-link")
    public FeedLinkCreated createLink() {
        return feedService.createOrRotate();
    }

    @GetMapping("/api/calendar/feed-link")
    public FeedLinkStatus linkStatus() {
        return feedService.status();
    }

    @DeleteMapping("/api/calendar/feed-link")
    public ResponseEntity<Void> deleteLink() {
        feedService.delete();
        return ResponseEntity.noContent().build();
    }

    @GetMapping(value = "/api/public/calendar/{token}.ics", produces = "text/calendar")
    public ResponseEntity<String> feed(@PathVariable String token) {
        String body = feedService.feed(token).orElseThrow(() -> new NotFoundException("Calendar not found"));
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/calendar; charset=utf-8"))
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePrivate())
                .body(body);
    }
}
