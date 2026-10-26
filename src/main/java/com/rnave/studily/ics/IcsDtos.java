package com.rnave.studily.ics;

import com.rnave.studily.canvas.FeedImportDtos.FeedChange;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public class IcsDtos {

    public record ImportRequest(
            @NotBlank @Size(max = 4_000_000) String source,
            @Size(max = 64) String timeZone) {
    }

    public record ImportResult(
            String calendarName,
            int imported,
            int updated,
            int skipped,
            boolean truncated,
            int removed,
            boolean synced) {
    }

    public record AddedEvent(String title, Instant at) {
    }

    public record SyncResult(ImportResult result, List<AddedEvent> added, List<FeedChange> changes) {
    }

    public record FeedLinkCreated(String httpsUrl, String webcalUrl, Instant createdAt) {
    }

    public record FeedLinkStatus(boolean exists, Instant createdAt, Instant lastFetchedAt) {
    }
}
