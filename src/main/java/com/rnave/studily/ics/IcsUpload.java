package com.rnave.studily.ics;

import com.rnave.studily.config.BadRequestException;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.zip.ZipEntry;

public final class IcsUpload {

    static final int MAX_TEXT_CHARS = 4_000_000;
    private static final int MAX_ZIP_ENTRIES = 200;

    private IcsUpload() {}

    public static String textFrom(byte[] bytes, String filename) {
        if (bytes == null || bytes.length == 0) {
            throw new BadRequestException("That file is empty");
        }
        String text = isZip(bytes) ? fromZip(bytes) : new String(bytes, StandardCharsets.UTF_8);
        if (text.length() > MAX_TEXT_CHARS) {
            throw new BadRequestException("That calendar is too large to import");
        }
        if (!text.toUpperCase(Locale.ROOT).contains("BEGIN:VCALENDAR")) {
            throw new BadRequestException(name(filename).endsWith(".zip")
                    ? "That zip has no calendar (.ics) files in it"
                    : "That does not look like an iCalendar (.ics) file");
        }
        return text;
    }

    private static boolean isZip(byte[] bytes) {
        return bytes.length >= 4
                && bytes[0] == 0x50 && bytes[1] == 0x4B
                && bytes[2] == 0x03 && bytes[3] == 0x04;
    }

    private static String fromZip(byte[] bytes) {
        StringBuilder out = new StringBuilder();
        java.nio.file.Path temp = null;
        try {
            temp = java.nio.file.Files.createTempFile("studily-ics", ".zip");
            java.nio.file.Files.write(temp, bytes);
            try (java.util.zip.ZipFile zip = new java.util.zip.ZipFile(temp.toFile(), StandardCharsets.UTF_8)) {
                if (zip.size() > MAX_ZIP_ENTRIES) {
                    throw new BadRequestException("That zip has too many files in it");
                }
                var entries = zip.entries();
                while (entries.hasMoreElements()) {
                    ZipEntry entry = entries.nextElement();
                    String base = name(entry.getName());
                    if (entry.isDirectory() || !base.endsWith(".ics") || base.startsWith("._")) {
                        continue;
                    }
                    if (entry.getSize() < 0 || entry.getSize() > MAX_TEXT_CHARS) {
                        throw new BadRequestException("That calendar is too large to import");
                    }
                    try (var in = zip.getInputStream(entry)) {
                        byte[] content = in.readNBytes(MAX_TEXT_CHARS - out.length() + 1);
                        out.append(new String(content, StandardCharsets.UTF_8)).append('\n');
                    }
                    if (out.length() > MAX_TEXT_CHARS) {
                        throw new BadRequestException("That calendar is too large to import");
                    }
                }
            }
        } catch (IOException | IllegalArgumentException e) {
            throw new BadRequestException("Could not read that zip file");
        } finally {
            if (temp != null) {
                try {
                    java.nio.file.Files.deleteIfExists(temp);
                } catch (IOException ignored) {
                }
            }
        }
        return out.toString();
    }

    private static String name(String path) {
        if (path == null) {
            return "";
        }
        String base = path.substring(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1);
        return base.toLowerCase(Locale.ROOT);
    }
}
