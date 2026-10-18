package com.rnave.studily.flashcard.generate;

import java.util.List;

public record GenResult(String title, List<GenCard> cards) {

    public record GenCard(String front, String back, String frontImage, String backImage, Integer sourcePage) {
    }
}
