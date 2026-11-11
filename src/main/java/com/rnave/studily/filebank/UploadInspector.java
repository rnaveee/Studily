package com.rnave.studily.filebank;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.flashcard.generate.SafeZip;
import org.springframework.stereotype.Component;

import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.CoderResult;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Component
public class UploadInspector {

    static final String MACROS = "Files with macros can't be uploaded. Save it as a regular .docx, .pptx or PDF.";
    static final String PROGRAM = "Programs and scripts can't be uploaded. "
            + "Upload a PDF, Word (.docx), PowerPoint (.pptx), text or Markdown file.";
    static final String LEGACY_OFFICE =
            "Old Office files (.doc, .ppt) aren't supported. Save it as .docx or .pptx and upload it again.";
    static final String ARCHIVE = "That archive isn't a Word or PowerPoint file.";
    static final String UNSUPPORTED =
            "Unsupported file type. Upload a PDF, Word (.docx), PowerPoint (.pptx), text or Markdown file.";

    private static final byte[] PDF_MAGIC = "%PDF-".getBytes(StandardCharsets.US_ASCII);
    private static final byte[] ZIP_MAGIC = {0x50, 0x4B, 0x03, 0x04};
    private static final byte[] OLE_MAGIC = {(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0};
    private static final byte[] DOS_MAGIC = {'M', 'Z'};
    private static final String DOCX_PART = "word/document.xml";
    private static final String PPTX_PART = "ppt/presentation.xml";
    private static final List<byte[]> PROGRAM_MAGIC = List.of(
            new byte[] {0x7F, 'E', 'L', 'F'},
            new byte[] {(byte) 0xFE, (byte) 0xED, (byte) 0xFA, (byte) 0xCE},
            new byte[] {(byte) 0xFE, (byte) 0xED, (byte) 0xFA, (byte) 0xCF},
            new byte[] {(byte) 0xCE, (byte) 0xFA, (byte) 0xED, (byte) 0xFE},
            new byte[] {(byte) 0xCF, (byte) 0xFA, (byte) 0xED, (byte) 0xFE},
            new byte[] {(byte) 0xCA, (byte) 0xFE, (byte) 0xBA, (byte) 0xBE});
    private static final Set<String> MACRO_EXTENSIONS = Set.of("docm", "dotm", "pptm", "potm", "ppsm", "xlsm");
    private static final Set<String> TEXT_EXTENSIONS = Set.of("txt", "md", "markdown");
    private static final int TEXT_SAMPLE_BYTES = 64 * 1024;

    public BankFormat inspect(String filename, byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            throw new BadRequestException("That file is empty.");
        }
        String extension = extension(filename);
        if (MACRO_EXTENSIONS.contains(extension)) {
            throw new BadRequestException(MACROS);
        }
        boolean textUpload = TEXT_EXTENSIONS.contains(extension) && looksLikeText(bytes);
        if (PROGRAM_MAGIC.stream().anyMatch(magic -> startsWith(bytes, magic))
                || (!textUpload && startsWith(bytes, DOS_MAGIC))) {
            throw new BadRequestException(PROGRAM);
        }
        if (startsWith(bytes, PDF_MAGIC)) {
            return BankFormat.PDF;
        }
        if (startsWith(bytes, OLE_MAGIC)) {
            throw new BadRequestException(LEGACY_OFFICE);
        }
        if (startsWith(bytes, ZIP_MAGIC)) {
            return office(bytes);
        }
        if (textUpload) {
            return extension.equals("txt") ? BankFormat.TEXT : BankFormat.MARKDOWN;
        }
        throw new BadRequestException(UNSUPPORTED);
    }

    static boolean looksLikeText(byte[] bytes) {
        int length = Math.min(bytes.length, TEXT_SAMPLE_BYTES);
        for (int i = 0; i < length; i++) {
            if (bytes[i] == 0) {
                return false;
            }
        }
        CoderResult result = StandardCharsets.UTF_8.newDecoder().decode(
                ByteBuffer.wrap(bytes, 0, length), CharBuffer.allocate(length), length == bytes.length);
        return !result.isError();
    }

    private static BankFormat office(byte[] bytes) {
        SafeZip.Inspection zip = SafeZip.inspect(bytes);
        if (zip.hasMacros()) {
            throw new BadRequestException(MACROS);
        }
        if (zip.names().contains(PPTX_PART)) {
            return BankFormat.PPTX;
        }
        if (zip.names().contains(DOCX_PART)) {
            return BankFormat.DOCX;
        }
        throw new BadRequestException(ARCHIVE);
    }

    private static boolean startsWith(byte[] bytes, byte[] magic) {
        if (bytes.length < magic.length) {
            return false;
        }
        for (int i = 0; i < magic.length; i++) {
            if (bytes[i] != magic[i]) {
                return false;
            }
        }
        return true;
    }

    private static String extension(String filename) {
        if (filename == null) {
            return "";
        }
        int dot = filename.lastIndexOf('.');
        return dot < 0 ? "" : filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }
}
