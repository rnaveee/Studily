package com.rnave.studily.filebank;

public enum BankFormat {
    PDF("application/pdf"),
    DOCX("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    PPTX("application/vnd.openxmlformats-officedocument.presentationml.presentation"),
    TEXT("text/plain"),
    MARKDOWN("text/markdown");

    private final String contentType;

    BankFormat(String contentType) {
        this.contentType = contentType;
    }

    public String contentType() {
        return contentType;
    }

    public boolean previewable() {
        return this == PDF || this == PPTX;
    }
}
