package com.rnave.studily.filebank;

import java.time.Instant;

public record BankFileDto(Long id, Long courseId, Long chatId, String name, String contentType, BankFileKind kind,
                          long sizeBytes, BankFileStatus status, String statusDetail, Integer pageCount,
                          int chunkCount, boolean previewable, Instant createdAt, Instant indexedAt) {

    public static BankFileDto from(BankFile file) {
        return new BankFileDto(file.getId(), file.getCourseId(), file.getChatId(), file.getName(),
                file.getContentType(), file.getKind(), file.getSizeBytes(), file.getStatus(),
                file.getStatusDetail(), file.getPageCount(), file.getChunkCount(),
                file.getFormat() != null && file.getFormat().previewable(), file.getCreatedAt(),
                file.getIndexedAt());
    }
}
