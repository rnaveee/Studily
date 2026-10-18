package com.rnave.studily.flashcard.generate;

import com.rnave.studily.config.BadRequestException;

import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;

final class FileSniffer {

    static final String UNSUPPORTED =
            "That file type can't be read. Upload a PDF, PowerPoint (.pptx), Word (.docx), image or text file.";
    static final String LEGACY_OFFICE =
            "Older Office files (.ppt, .doc) and password-protected files can't be read. "
                    + "Save it as .pptx, .docx or PDF and try again.";
    static final String MACROS = "Files with macros can't be read. Save it as a regular .pptx, .docx or PDF.";

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};
    private static final byte[] OLE2 = {(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0,
            (byte) 0xA1, (byte) 0xB1, 0x1A, (byte) 0xE1};
    private static final int PDF_HEADER_WINDOW = 1024;

    private FileSniffer() {
    }

    static FileKind sniff(byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            throw new BadRequestException("That file is empty.");
        }
        if (hasPdfHeader(bytes)) {
            return FileKind.PDF;
        }
        if (startsWith(bytes, PNG)) {
            return FileKind.PNG;
        }
        if (bytes.length > 3 && (bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8 && (bytes[2] & 0xFF) == 0xFF) {
            return FileKind.JPEG;
        }
        if (bytes.length > 12 && startsWith(bytes, "RIFF".getBytes(StandardCharsets.US_ASCII))
                && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P') {
            return FileKind.WEBP;
        }
        if (startsWith(bytes, OLE2)) {
            throw new BadRequestException(LEGACY_OFFICE);
        }
        if (bytes.length > 4 && bytes[0] == 'P' && bytes[1] == 'K' && bytes[2] == 3 && bytes[3] == 4) {
            return office(SafeZip.inspect(bytes));
        }
        if (isText(bytes)) {
            return FileKind.TEXT;
        }
        throw new BadRequestException(UNSUPPORTED);
    }

    private static FileKind office(SafeZip.Inspection zip) {
        String types = zip.contentTypes();
        if (types == null) {
            throw new BadRequestException(UNSUPPORTED);
        }
        if (zip.hasMacros() || types.contains("macroEnabled")) {
            throw new BadRequestException(MACROS);
        }
        if (types.contains("application/vnd.openxmlformats-officedocument.presentationml.")) {
            return FileKind.PPTX;
        }
        if (types.contains("application/vnd.openxmlformats-officedocument.wordprocessingml.")) {
            return FileKind.DOCX;
        }
        throw new BadRequestException(UNSUPPORTED);
    }

    private static boolean hasPdfHeader(byte[] bytes) {
        int limit = Math.min(bytes.length - 5, PDF_HEADER_WINDOW);
        for (int i = 0; i <= limit; i++) {
            if (bytes[i] == '%' && bytes[i + 1] == 'P' && bytes[i + 2] == 'D' && bytes[i + 3] == 'F'
                    && bytes[i + 4] == '-') {
                return true;
            }
        }
        return false;
    }

    static boolean isText(byte[] bytes) {
        int control = 0;
        for (byte b : bytes) {
            if (b == 0) {
                return false;
            }
            if ((b & 0xFF) < 0x20 && b != '\n' && b != '\r' && b != '\t' && b != '\f') {
                control++;
            }
        }
        if (control * 100L > bytes.length) {
            return false;
        }
        try {
            StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(bytes));
            return true;
        } catch (CharacterCodingException e) {
            return false;
        }
    }

    private static boolean startsWith(byte[] bytes, byte[] prefix) {
        if (bytes.length < prefix.length) {
            return false;
        }
        for (int i = 0; i < prefix.length; i++) {
            if (bytes[i] != prefix[i]) {
                return false;
            }
        }
        return true;
    }
}
