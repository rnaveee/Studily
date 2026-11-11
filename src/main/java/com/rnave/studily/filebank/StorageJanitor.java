package com.rnave.studily.filebank;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class StorageJanitor {

    private static final Logger log = LoggerFactory.getLogger(StorageJanitor.class);
    private static final int BATCH = 100;

    private final JdbcTemplate jdbc;
    private final FileStorage storage;

    public StorageJanitor(JdbcTemplate jdbc, FileStorage storage) {
        this.jdbc = jdbc;
        this.storage = storage;
    }

    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    void sweep() {
        if (!storage.configured()) {
            return;
        }
        List<String> keys = jdbc.queryForList(
                "SELECT storage_key FROM storage_trash ORDER BY created_at LIMIT ?", String.class, BATCH);
        for (String key : keys) {
            try {
                storage.delete(key);
                jdbc.update("DELETE FROM storage_trash WHERE storage_key = ?", key);
            } catch (RuntimeException e) {
                log.warn("Could not delete stored file {}: {}", key, e.getMessage());
            }
        }
    }
}
