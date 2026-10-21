package com.rnave.studily.studysession;

import com.rnave.studily.config.PageResponse;
import com.rnave.studily.progress.ProgressDtos.ProgressDelta;
import com.rnave.studily.progress.StreakRestoreService;
import com.rnave.studily.studysession.StudySessionDtos.AddTaskRequest;
import com.rnave.studily.studysession.StudySessionDtos.FocusRequest;
import com.rnave.studily.studysession.StudySessionDtos.StartSessionRequest;
import com.rnave.studily.studysession.StudySessionDtos.StreakRestoreResult;
import com.rnave.studily.studysession.StudySessionDtos.StreakWeekDto;
import com.rnave.studily.studysession.StudySessionDtos.StudySessionDto;
import com.rnave.studily.studysession.StudySessionDtos.StudySessionRecap;
import com.rnave.studily.studysession.StudySessionDtos.StudySessionResult;
import com.rnave.studily.studysession.StudySessionDtos.StudySessionSummaryDto;
import com.rnave.studily.studysession.StudySessionDtos.TaskUpdateRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/study-sessions")
public class StudySessionController {

    private final StudySessionService studySessionService;
    private final StreakRestoreService streakRestoreService;

    public StudySessionController(StudySessionService studySessionService,
                                  StreakRestoreService streakRestoreService) {
        this.studySessionService = studySessionService;
        this.streakRestoreService = streakRestoreService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public StudySessionDto start(@Valid @RequestBody StartSessionRequest req) {
        return studySessionService.start(req);
    }

    @GetMapping("/active")
    public ResponseEntity<StudySessionDto> active() {
        return studySessionService.active()
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping
    public PageResponse<StudySessionSummaryDto> history(@RequestParam(defaultValue = "0") int page,
                                                        @RequestParam(defaultValue = "20") int size) {
        return studySessionService.history(page, size);
    }

    @GetMapping("/streak")
    public StreakWeekDto streak() {
        return studySessionService.streakWeek();
    }

    @PostMapping("/streak/restore")
    public StreakRestoreResult restoreStreak() {
        ProgressDelta delta = streakRestoreService.restore();
        return new StreakRestoreResult(studySessionService.streakWeek(), delta);
    }

    @PostMapping("/{id}/checkin")
    public StudySessionResult checkin(@PathVariable Long id) {
        return studySessionService.checkin(id);
    }

    @PostMapping("/{id}/pause")
    public StudySessionDto pause(@PathVariable Long id) {
        return studySessionService.pause(id);
    }

    @PostMapping("/{id}/focus")
    public StudySessionDto focus(@PathVariable Long id, @Valid @RequestBody FocusRequest req) {
        return studySessionService.focus(id, req.focused());
    }

    @PostMapping("/{id}/resume")
    public StudySessionDto resume(@PathVariable Long id) {
        return studySessionService.resume(id);
    }

    @PostMapping("/{id}/tasks")
    public StudySessionDto addTask(@PathVariable Long id, @Valid @RequestBody AddTaskRequest req) {
        return studySessionService.addTask(id, req.text());
    }

    @PatchMapping("/{id}/tasks/{taskId}")
    public StudySessionResult updateTask(@PathVariable Long id, @PathVariable Long taskId,
                                         @Valid @RequestBody TaskUpdateRequest req) {
        return studySessionService.updateTask(id, taskId, req.done(), req.text());
    }

    @DeleteMapping("/{id}/tasks/{taskId}")
    public StudySessionDto deleteTask(@PathVariable Long id, @PathVariable Long taskId) {
        return studySessionService.deleteTask(id, taskId);
    }

    @GetMapping("/{id}/recap")
    public StudySessionRecap recap(@PathVariable Long id) {
        return studySessionService.recap(id);
    }

    @PostMapping("/{id}/end")
    public StudySessionResult end(@PathVariable Long id) {
        return studySessionService.end(id);
    }
}
