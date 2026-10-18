package com.rnave.studily.flashcard.generate;

import java.util.List;

public class FlashcardGenDtos {

    public record GenAvailabilityDto(boolean enabled, int monthlyLimit, int remaining, boolean paused,
                                     int maxFiles, long maxFileBytes, long maxTotalBytes) {
    }

    public record GeneratedCardDto(String front, String back, String frontImage, String backImage,
                                   Integer sourcePage, String sourceLabel, String sourceFile, boolean duplicate) {
    }

    public record GeneratedDeckDto(String title, List<GeneratedCardDto> cards, List<String> warnings, int remaining) {
    }
}
