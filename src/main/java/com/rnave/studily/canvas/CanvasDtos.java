package com.rnave.studily.canvas;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class CanvasDtos {

    public record FeedRequest(
            @NotBlank @Size(max = 4_000_000) String source,
            @Size(max = 64) String timeZone,
            Long semesterId,
            Boolean keepSynced) {
    }
}
