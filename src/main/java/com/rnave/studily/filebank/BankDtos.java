package com.rnave.studily.filebank;

import jakarta.validation.constraints.NotNull;

public final class BankDtos {

    private BankDtos() {
    }

    public record BankStatusDto(boolean enabled, long usedBytes, long quotaBytes, long fileCount, int maxFiles,
                                long maxFileBytes, int maxFilesPerRequest) {
    }

    public record KindRequest(@NotNull BankFileKind kind) {
    }
}
