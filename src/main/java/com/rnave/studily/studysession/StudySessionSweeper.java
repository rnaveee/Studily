package com.rnave.studily.studysession;

import com.rnave.studily.push.PushPayload;
import com.rnave.studily.push.WebPushSender;
import com.rnave.studily.studysession.StudySessionService.SweepTarget;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class StudySessionSweeper {

    private static final Logger log = LoggerFactory.getLogger(StudySessionSweeper.class);
    static final int PUSH_TTL_SECONDS = 300;
    static final String PUSH_TITLE = "Study session";
    static final String PUSH_BODY = "Block done! Check in to keep your XP.";
    static final String PUSH_URL = "/learn";

    private final StudySessionService service;
    private final WebPushSender pushSender;

    public StudySessionSweeper(StudySessionService service, WebPushSender pushSender) {
        this.service = service;
        this.pushSender = pushSender;
    }

    @Scheduled(fixedDelay = 30_000, initialDelay = 30_000)
    public void sweep() {
        markMissed();
        notifyDue();
        expirePaused();
    }

    void markMissed() {
        for (SweepTarget target : service.overdueBlocks()) {
            try {
                service.missBlock(target.userId(), target.id());
            } catch (RuntimeException e) {
                log.warn("Failed to mark study block {} missed: {}", target.id(), e.getMessage());
            }
        }
    }

    void notifyDue() {
        for (SweepTarget target : service.dueUnnotifiedBlocks()) {
            try {
                if (service.markNotified(target.userId(), target.id())) {
                    pushSender.sendToUser(target.userId(), PushPayload.of(PUSH_TITLE, PUSH_BODY, PUSH_URL),
                            PUSH_TTL_SECONDS);
                }
            } catch (RuntimeException e) {
                log.warn("Failed to notify study block {}: {}", target.id(), e.getMessage());
            }
        }
    }

    void expirePaused() {
        for (SweepTarget target : service.stalePausedSessions()) {
            try {
                service.expire(target.userId(), target.id());
            } catch (RuntimeException e) {
                log.warn("Failed to expire study session {}: {}", target.id(), e.getMessage());
            }
        }
    }
}
