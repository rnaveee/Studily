package com.rnave.studily.flashcard.generate;

import com.rnave.studily.config.BadRequestException;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FileSnifferTest {

    @Test
    void sniff_recognisesFilesByTheirBytesNotTheirName() {
        assertThat(FileSniffer.sniff("%PDF-1.7\n...".getBytes(StandardCharsets.US_ASCII))).isEqualTo(FileKind.PDF);
        assertThat(FileSniffer.sniff(new byte[] {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0}))
                .isEqualTo(FileKind.PNG);
        assertThat(FileSniffer.sniff(new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0}))
                .isEqualTo(FileKind.JPEG);
        assertThat(FileSniffer.sniff("RIFF\0\0\0\0WEBPVP8 ".getBytes(StandardCharsets.US_ASCII)))
                .isEqualTo(FileKind.WEBP);
        assertThat(FileSniffer.sniff("Lecture 3\nMitochondria make ATP.\n".getBytes(StandardCharsets.UTF_8)))
                .isEqualTo(FileKind.TEXT);
    }

    @Test
    void sniff_findsAPdfHeaderAfterLeadingJunk() {
        assertThat(FileSniffer.sniff("\n\n  %PDF-1.4 rest".getBytes(StandardCharsets.US_ASCII)))
                .isEqualTo(FileKind.PDF);
    }

    @Test
    void sniff_tellsPowerPointFromWordByTheContentTypes() {
        assertThat(FileSniffer.sniff(TestFiles.office(TestFiles.PPTX_TYPES))).isEqualTo(FileKind.PPTX);
        assertThat(FileSniffer.sniff(TestFiles.office(TestFiles.DOCX_TYPES))).isEqualTo(FileKind.DOCX);
    }

    @Test
    void sniff_rejectsMacroEnabledOfficeFiles() {
        assertThatThrownBy(() -> FileSniffer.sniff(TestFiles.office(TestFiles.PPTM_TYPES)))
                .isInstanceOf(BadRequestException.class)
                .hasMessage(FileSniffer.MACROS);
        assertThatThrownBy(() -> FileSniffer.sniff(TestFiles.office(TestFiles.DOCX_TYPES, "word/vbaProject.bin")))
                .isInstanceOf(BadRequestException.class)
                .hasMessage(FileSniffer.MACROS);
    }

    @Test
    void sniff_rejectsLegacyAndEncryptedOfficeFiles() {
        byte[] ole2 = {(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0, (byte) 0xA1, (byte) 0xB1, 0x1A, (byte) 0xE1, 0, 0};

        assertThatThrownBy(() -> FileSniffer.sniff(ole2))
                .isInstanceOf(BadRequestException.class)
                .hasMessage(FileSniffer.LEGACY_OFFICE);
    }

    @Test
    void sniff_rejectsOtherZipsExecutablesAndBinaryData() {
        String xlsx = "<Types><Override ContentType=\""
                + "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/></Types>";
        byte[] exe = {'M', 'Z', (byte) 0x90, 0, 3, 0, 0, 0, 4, 0};
        byte[] latin1 = "café notes".getBytes(StandardCharsets.ISO_8859_1);

        assertThatThrownBy(() -> FileSniffer.sniff(TestFiles.office(xlsx))).hasMessage(FileSniffer.UNSUPPORTED);
        assertThatThrownBy(() -> FileSniffer.sniff(TestFiles.zip(java.util.Map.of("a.txt", new byte[] {1}))))
                .hasMessage(FileSniffer.UNSUPPORTED);
        assertThatThrownBy(() -> FileSniffer.sniff(exe)).hasMessage(FileSniffer.UNSUPPORTED);
        assertThatThrownBy(() -> FileSniffer.sniff(latin1)).hasMessage(FileSniffer.UNSUPPORTED);
        assertThatThrownBy(() -> FileSniffer.sniff(new byte[0])).hasMessageContaining("empty");
    }
}
