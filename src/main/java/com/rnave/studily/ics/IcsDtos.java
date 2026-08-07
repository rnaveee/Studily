package com.rnave.studily.ics;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

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
            boolean truncated) {
    }
}
