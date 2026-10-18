package com.rnave.studily.flashcard.generate;

import com.rnave.studily.config.BadRequestException;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SafeZipTest {

    @Test
    void inspect_readsContentTypesFromANormalOfficeFile() {
        SafeZip.Inspection inspection = SafeZip.inspect(TestFiles.office(TestFiles.PPTX_TYPES, "ppt/slides/slide1.xml"));

        assertThat(inspection.contentTypes()).contains("presentationml");
        assertThat(inspection.entries()).isEqualTo(2);
        assertThat(inspection.hasMacros()).isFalse();
    }

    @Test
    void inspect_rejectsAnEntryThatInflatesFarBeyondItsCompressedSize() {
        Map<String, byte[]> entries = new LinkedHashMap<>();
        entries.put("[Content_Types].xml", TestFiles.DOCX_TYPES.getBytes(StandardCharsets.UTF_8));
        entries.put("word/document.xml", new byte[8 * 1024 * 1024]);

        assertThatThrownBy(() -> SafeZip.inspect(TestFiles.zip(entries)))
                .isInstanceOf(BadRequestException.class)
                .hasMessage(SafeZip.BOMB);
    }

    @Test
    void inspect_rejectsAnEntryLargerThanTheEntryLimit() {
        byte[] noise = new byte[51 * 1024 * 1024];
        new java.util.Random(4).nextBytes(noise);
        Map<String, byte[]> entries = new LinkedHashMap<>();
        entries.put("ppt/media/huge.bin", noise);

        assertThatThrownBy(() -> SafeZip.inspect(TestFiles.zip(entries)))
                .isInstanceOf(BadRequestException.class)
                .hasMessage(SafeZip.BOMB);
    }

    @Test
    void inspect_rejectsTooManyEntries() {
        Map<String, byte[]> entries = new LinkedHashMap<>();
        for (int i = 0; i <= SafeZip.MAX_ENTRIES; i++) {
            entries.put("e" + i, new byte[] {1});
        }

        assertThatThrownBy(() -> SafeZip.inspect(TestFiles.zip(entries)))
                .isInstanceOf(BadRequestException.class)
                .hasMessage(SafeZip.BOMB);
    }

    @Test
    void inspect_rejectsDamagedZips() {
        byte[] truncated = java.util.Arrays.copyOf(TestFiles.office(TestFiles.PPTX_TYPES), 12);

        assertThatThrownBy(() -> SafeZip.inspect(truncated))
                .isInstanceOf(BadRequestException.class);
    }
}
