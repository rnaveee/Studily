package com.rnave.studily.studysession;

import com.rnave.studily.config.PageResponse;
import com.rnave.studily.studysession.StudySessionDtos.StartSessionRequest;
import com.rnave.studily.studysession.StudySessionDtos.StreakWeekDto;
import com.rnave.studily.studysession.StudySessionDtos.StudySessionDto;
import com.rnave.studily.studysession.StudySessionDtos.StudySessionResult;
import com.rnave.studily.studysession.StudySessionDtos.StudySessionSummaryDto;
import com.rnave.studily.studysession.StudySessionDtos.TaskDoneRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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

    public StudySessionController(StudySessionService studySessionService) {
        this.studySessionService = studySessionService;
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

    @PostMapping("/{id}/checkin")
    public StudySessionResult checkin(@PathVariable Long id) {
        return studySessionService.checkin(id);
    }

    @PostMapping("/{id}/resume")
    public StudySessionDto resume(@PathVariable Long id) {
        return studySessionService.resume(id);
    }

    @PatchMapping("/{id}/tasks/{taskId}")
    public StudySessionResult setTaskDone(@PathVariable Long id, @PathVariable Long taskId,
                                          @Valid @RequestBody TaskDoneRequest req) {
        return studySessionService.setTaskDone(id, taskId, req.done());
    }

    @PostMapping("/{id}/end")
    public StudySessionResult end(@PathVariable Long id) {
        return studySessionService.end(id);
    }
}
