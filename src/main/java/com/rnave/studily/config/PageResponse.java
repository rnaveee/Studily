package com.rnave.studily.config;

import java.util.List;

public record PageResponse<T>(List<T> items, boolean hasMore) {

    public static <T> PageResponse<T> empty() {
        return new PageResponse<>(List.of(), false);
    }
}
