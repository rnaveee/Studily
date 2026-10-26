package com.rnave.studily.canvas;

import com.rnave.studily.canvas.FeedImportDtos.FeedStageResult;
import com.rnave.studily.canvas.SchoolFeedDtos.SchoolFeedList;
import com.rnave.studily.config.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/school-feeds")
public class SchoolFeedController {

    private final SchoolFeedService service;
    private final CurrentUser currentUser;

    public SchoolFeedController(SchoolFeedService service, CurrentUser currentUser) {
        this.service = service;
        this.currentUser = currentUser;
    }

    @GetMapping
    public SchoolFeedList list() {
        return service.list(currentUser.entity());
    }

    @PostMapping("/{id}/sync")
    public FeedStageResult syncNow(@PathVariable Long id) {
        return service.syncNow(currentUser.entity(), id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(currentUser.entity(), id);
        return ResponseEntity.noContent().build();
    }
}
