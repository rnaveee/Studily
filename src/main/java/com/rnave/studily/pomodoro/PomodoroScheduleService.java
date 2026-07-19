package com.rnave.studily.pomodoro;

import com.rnave.studily.push.PushPayload;
import com.rnave.studily.push.WebPushSender;
import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

@Service
public class PomodoroScheduleService {

    private static final int MAX_NOTIFICATIONS = 4;
    private static final int PUSH_TTL_SECONDS = 120;

    private final WebPushSender webPushSender;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    private final Map<Long, List<ScheduledFuture<?>>> scheduled = new ConcurrentHashMap<>();

    public PomodoroScheduleService(WebPushSender webPushSender) {
        this.webPushSender = webPushSender;
    }

    public void schedule(long userId, Phase phase, long endsAtEpochMs, int studyMin, int breakMin) {
        cancel(userId);
        long now = System.currentTimeMillis();
        List<ScheduledFuture<?>> futures = new ArrayList<>();
        long at = endsAtEpochMs;
        Phase finishing = phase;
        for (int i = 0; i < MAX_NOTIFICATIONS; i++) {
            if (at > now) {
                futures.add(schedulePush(userId, finishing, at));
            }
            finishing = finishing.other();
            at += (finishing == Phase.STUDY ? studyMin : breakMin) * 60_000L;
        }
        if (!futures.isEmpty()) {
            scheduled.put(userId, futures);
        }
    }

    public void cancel(long userId) {
        List<ScheduledFuture<?>> futures = scheduled.remove(userId);
        if (futures != null) {
            futures.forEach(f -> f.cancel(false));
        }
    }

    private ScheduledFuture<?> schedulePush(long userId, Phase finishing, long atEpochMs) {
        long delay = Math.max(0, atEpochMs - System.currentTimeMillis());
        return scheduler.schedule(() -> {
            String body = finishing == Phase.STUDY
                    ? "Study time is over — take a break!"
                    : "Break time is over — back to studying!";
            webPushSender.sendToUser(userId, PushPayload.of("Pomodoro Timer", body, "/pomodoro"), PUSH_TTL_SECONDS);
        }, delay, TimeUnit.MILLISECONDS);
    }

    @PreDestroy
    void shutdown() {
        scheduler.shutdown();
    }

    public enum Phase {
        STUDY, BREAK;

        Phase other() {
            return this == STUDY ? BREAK : STUDY;
        }
    }
}
