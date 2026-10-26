package com.rnave.studily.canvas;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class SchoolFeedSyncJob {

    private static final Logger log = LoggerFactory.getLogger(SchoolFeedSyncJob.class);

    private final SchoolFeedService service;

    public SchoolFeedSyncJob(SchoolFeedService service) {
        this.service = service;
    }

    @Scheduled(fixedDelayString = "${app.feeds.sync-delay-ms:600000}",
            initialDelayString = "${app.feeds.sync-initial-delay-ms:120000}")
    public void run() {
        if (!service.isAvailable()) {
            return;
        }
        for (Long id : service.dueFeedIds()) {
            try {
                service.syncDue(id);
            } catch (RuntimeException e) {
                log.warn("School feed {} sync did not complete: {}", id, e.getClass().getSimpleName());
            }
        }
    }
}
