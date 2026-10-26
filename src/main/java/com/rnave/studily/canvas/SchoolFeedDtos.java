package com.rnave.studily.canvas;

import java.time.Instant;
import java.util.List;

public class SchoolFeedDtos {

    public record SchoolFeedView(
            Long id,
            String provider,
            String host,
            Instant lastSyncedAt,
            Instant lastSuccessAt,
            String lastError,
            boolean enabled) {
    }

    public record SchoolFeedList(boolean available, List<SchoolFeedView> feeds) {
    }
}
