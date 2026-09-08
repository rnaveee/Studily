package com.rnave.studily.parse;

import java.util.List;

public record ExtractedInput(String text, List<ExtractedImage> images) {

    public boolean isEmpty() {
        return (text == null || text.isBlank()) && images.isEmpty();
    }

    public boolean imagesOnly() {
        return (text == null || text.isBlank()) && !images.isEmpty();
    }

    public record ExtractedImage(String mediaType, byte[] data) {
    }
}
