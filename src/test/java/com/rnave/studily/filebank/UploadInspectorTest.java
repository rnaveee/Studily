package com.rnave.studily.filebank;

import com.rnave.studily.config.BadRequestException;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UploadInspectorTest {

    private final UploadInspector inspector = new UploadInspector();

    @Test
    void recognisesPdfByItsMagicBytes() {
        byte[] pdf = "%PDF-1.7\n...".getBytes(StandardCharsets.US_ASCII);

        assertThat(inspector.inspect("anything.bin", pdf)).isEqualTo(BankFormat.PDF);
    }

    @Test
    void recognisesOfficeFilesByTheirInternalParts() throws IOException {
        assertThat(inspector.inspect("slides.pptx", zip("ppt/presentation.xml"))).isEqualTo(BankFormat.PPTX);
        assertThat(inspector.inspect("notes.docx", zip("word/document.xml"))).isEqualTo(BankFormat.DOCX);
    }

    @Test
    void rejectsOtherArchives() throws IOException {
        assertThatThrownBy(() -> inspector.inspect("photos.zip", zip("img/cat.jpg")))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void rejectsLegacyOfficeFilesWithAHelpfulMessage() {
        byte[] doc = {(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0, 0, 0, 0, 0};

        assertThatThrownBy(() -> inspector.inspect("old.doc", doc))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining(".docx");
    }

    @Test
    void acceptsUtf8TextAndMarkdownByExtension() {
        byte[] text = "Résumé of chapter 3: entropy always increases.".getBytes(StandardCharsets.UTF_8);

        assertThat(inspector.inspect("chapter3.txt", text)).isEqualTo(BankFormat.TEXT);
        assertThat(inspector.inspect("chapter3.md", text)).isEqualTo(BankFormat.MARKDOWN);
    }

    @Test
    void rejectsBinaryDataPretendingToBeText() {
        byte[] binary = {0x48, 0x00, 0x49, 0x00};

        assertThatThrownBy(() -> inspector.inspect("fake.txt", binary)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void rejectsEmptyFiles() {
        assertThatThrownBy(() -> inspector.inspect("empty.pdf", new byte[0]))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("empty");
    }

    @Test
    void rejectsProgramsEvenWhenTheyAreNamedAsText() {
        byte[] windowsProgram = {'M', 'Z', (byte) 0x90, 0, 3, 0, 0, 0};
        byte[] linuxProgram = {0x7F, 'E', 'L', 'F', 2, 1, 1, 0};

        assertThatThrownBy(() -> inspector.inspect("notes.txt", windowsProgram))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Programs");
        assertThatThrownBy(() -> inspector.inspect("notes.pdf", linuxProgram))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Programs");
    }

    @Test
    void rejectsOfficeFilesThatCarryAVbaMacroProject() throws IOException {
        byte[] withMacros = zip("word/document.xml", "word/vbaProject.bin");

        assertThatThrownBy(() -> inspector.inspect("report.docx", withMacros))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("macros");
    }

    @Test
    void rejectsMacroEnabledExtensions() throws IOException {
        byte[] plainPackage = zip("word/document.xml");

        assertThatThrownBy(() -> inspector.inspect("report.docm", plainPackage))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("macros");
        assertThatThrownBy(() -> inspector.inspect("slides.pptm", plainPackage))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("macros");
    }

    private static byte[] zip(String... entryNames) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out)) {
            zip.putNextEntry(new ZipEntry("[Content_Types].xml"));
            zip.write("<Types/>".getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
            for (String entryName : entryNames) {
                zip.putNextEntry(new ZipEntry(entryName));
                zip.write("<x/>".getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
        }
        return out.toByteArray();
    }
}
