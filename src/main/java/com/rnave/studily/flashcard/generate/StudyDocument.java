package com.rnave.studily.flashcard.generate;

import java.util.List;

record StudyDocument(String fileName, FileKind kind, String unit, List<Page> pages, List<Figure> figures) {

    record Picture(byte[] data, String mediaType, int width, int height) {

        long tokens() {
            return Math.min(1_600, (long) width * height / 750 + 1);
        }
    }

    record Page(int number, String text, Picture render) {
    }

    record Figure(int id, int page, Picture picture) {
    }

    int textChars() {
        return pages.stream().mapToInt(p -> p.text().length()).sum();
    }

    String label(Integer page) {
        return page == null ? null : unit + " " + page;
    }
}
