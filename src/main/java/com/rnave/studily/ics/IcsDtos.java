package com.rnave.studily.ics;

import jakarta.validation.constraints.NotBlank;

public class IcsDtos {

    public record ImportRequest(@NotBlank String source, String timeZone) {
    }

    public record ImportResult(
            String calendarName,
            int imported,
            int updated,
            int skipped,
            boolean truncated) {
    }
}
