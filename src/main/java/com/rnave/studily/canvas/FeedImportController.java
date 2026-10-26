package com.rnave.studily.canvas;

import com.rnave.studily.canvas.FeedImportDtos.ApplyRequest;
import com.rnave.studily.canvas.FeedImportDtos.ApplyResult;
import com.rnave.studily.canvas.FeedImportDtos.Conflict;
import com.rnave.studily.canvas.FeedImportDtos.CourseDecisions;
import com.rnave.studily.canvas.FeedImportDtos.FeedImportView;
import com.rnave.studily.config.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/imports")
public class FeedImportController {

    private final FeedImportService service;
    private final FeedConflictService conflictService;
    private final CurrentUser currentUser;

    public FeedImportController(FeedImportService service, FeedConflictService conflictService,
                                CurrentUser currentUser) {
        this.service = service;
        this.conflictService = conflictService;
        this.currentUser = currentUser;
    }

    @GetMapping("/{id}")
    public FeedImportView get(@PathVariable Long id) {
        return service.view(currentUser.id(), id);
    }

    @PostMapping("/{id}/dismiss")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void dismiss(@PathVariable Long id) {
        service.dismiss(currentUser.id(), id);
    }

    @PostMapping("/{id}/conflicts")
    public List<Conflict> conflicts(@PathVariable Long id, @Valid @RequestBody CourseDecisions req) {
        return conflictService.conflicts(currentUser.id(), id, req);
    }

    @PostMapping("/{id}/apply")
    public ApplyResult apply(@PathVariable Long id, @Valid @RequestBody ApplyRequest req) {
        return service.apply(currentUser.entity(), id, req);
    }
}
