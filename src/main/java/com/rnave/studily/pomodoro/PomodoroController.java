package com.rnave.studily.pomodoro;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.pomodoro.PomodoroScheduleService.Phase;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/pomodoro")
public class PomodoroController {

    private static final long MAX_HORIZON_MS = 4 * 60 * 60_000L;

    private final PomodoroScheduleService service;
    private final CurrentUser currentUser;

    public PomodoroController(PomodoroScheduleService service, CurrentUser currentUser) {
        this.service = service;
        this.currentUser = currentUser;
    }

    @PostMapping("/schedule")
    public ResponseEntity<Void> schedule(@RequestBody ScheduleRequest body) {
        Phase phase;
        try {
            phase = Phase.valueOf(body.phase());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
        long now = System.currentTimeMillis();
        if (body.endsAtEpochMs() < now - 60_000L || body.endsAtEpochMs() > now + MAX_HORIZON_MS) {
            return ResponseEntity.badRequest().build();
        }
        service.schedule(currentUser.id(), phase, body.endsAtEpochMs(),
                clampMinutes(body.studyMin()), clampMinutes(body.breakMin()));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/schedule")
    public ResponseEntity<Void> cancel() {
        service.cancel(currentUser.id());
        return ResponseEntity.noContent().build();
    }

    private static int clampMinutes(int n) {
        return Math.min(180, Math.max(1, n));
    }

    public record ScheduleRequest(String phase, long endsAtEpochMs, int studyMin, int breakMin) {
    }
}
