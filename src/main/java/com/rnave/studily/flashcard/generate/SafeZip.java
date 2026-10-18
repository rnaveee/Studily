package com.rnave.studily.flashcard.generate;

import com.rnave.studily.config.BadRequestException;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

final class SafeZip {

    static final int MAX_ENTRIES = 2_000;
    static final long MAX_ENTRY_BYTES = 50L * 1024 * 1024;
    static final long MAX_TOTAL_BYTES = 200L * 1024 * 1024;
    static final long MAX_RATIO = 100;
    static final long RATIO_FLOOR = 1024 * 1024;
    private static final int MAX_CONTENT_TYPES_BYTES = 1024 * 1024;

    static final String BOMB = "That file expands to far more data than a real document would, so it can't be read.";
    static final String DAMAGED = "That file is damaged or isn't a real Office document.";

    record Inspection(String contentTypes, boolean hasMacros, int entries, long inflatedBytes) {
    }

    private SafeZip() {
    }

    static Inspection inspect(byte[] zip) {
        int entries = 0;
        long total = 0;
        String contentTypes = null;
        boolean macros = false;
        byte[] buffer = new byte[64 * 1024];
        try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(zip))) {
            ZipEntry entry;
            while ((entry = in.getNextEntry()) != null) {
                if (++entries > MAX_ENTRIES) {
                    throw new BadRequestException(BOMB);
                }
                String name = entry.getName();
                if (name.toLowerCase(Locale.ROOT).endsWith("vbaproject.bin")) {
                    macros = true;
                }
                ByteArrayOutputStream keep = name.equals("[Content_Types].xml") ? new ByteArrayOutputStream() : null;
                long entryBytes = 0;
                int n;
                while ((n = in.read(buffer)) > 0) {
                    entryBytes += n;
                    total += n;
                    if (entryBytes > MAX_ENTRY_BYTES || total > MAX_TOTAL_BYTES) {
                        throw new BadRequestException(BOMB);
                    }
                    if (keep != null && keep.size() < MAX_CONTENT_TYPES_BYTES) {
                        keep.write(buffer, 0, n);
                    }
                }
                long compressed = entry.getCompressedSize();
                if (entryBytes > RATIO_FLOOR && compressed > 0 && entryBytes / compressed > MAX_RATIO) {
                    throw new BadRequestException(BOMB);
                }
                if (keep != null) {
                    contentTypes = keep.toString(StandardCharsets.UTF_8);
                }
            }
        } catch (IOException | IllegalArgumentException e) {
            throw new BadRequestException(DAMAGED);
        }
        if (entries == 0) {
            throw new BadRequestException(DAMAGED);
        }
        if (total > RATIO_FLOOR && total / Math.max(1, zip.length) > MAX_RATIO) {
            throw new BadRequestException(BOMB);
        }
        return new Inspection(contentTypes, macros, entries, total);
    }
}
