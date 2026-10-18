package com.rnave.studily.flashcard.generate;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

final class TestFiles {

    static final String PPTX_TYPES = "<Types><Override ContentType=\""
            + "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml\"/></Types>";
    static final String DOCX_TYPES = "<Types><Override ContentType=\""
            + "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/></Types>";
    static final String PPTM_TYPES = "<Types><Override ContentType=\""
            + "application/vnd.ms-powerpoint.presentation.macroEnabled.main+xml\"/></Types>";

    private TestFiles() {
    }

    static byte[] zip(Map<String, byte[]> entries) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out)) {
            for (Map.Entry<String, byte[]> entry : entries.entrySet()) {
                zip.putNextEntry(new ZipEntry(entry.getKey()));
                zip.write(entry.getValue());
                zip.closeEntry();
            }
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
        return out.toByteArray();
    }

    static byte[] office(String contentTypes, String... extraEntries) {
        Map<String, byte[]> entries = new LinkedHashMap<>();
        entries.put("[Content_Types].xml", contentTypes.getBytes(StandardCharsets.UTF_8));
        for (String name : extraEntries) {
            entries.put(name, "x".getBytes(StandardCharsets.UTF_8));
        }
        return zip(entries);
    }
}
