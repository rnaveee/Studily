package com.rnave.studily.survey;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.Map;

public final class SurveyDtos {

    private SurveyDtos() {
    }

    public record SurveyDto(
            String key,
            boolean open,
            boolean eligible,
            boolean completed,
            boolean promptSeen,
            SurveyDefinition definition) {
    }

    public record SubmitRequest(
            @NotBlank String key,
            String platform,
            Boolean standalone,
            @NotNull Map<String, Object> answers) {
    }
}
