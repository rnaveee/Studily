package com.rnave.studily.parse;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.parse.ExtractedInput.ExtractedImage;
import net.coobird.thumbnailator.Thumbnails;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.io.RandomAccessReadBuffer;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@Component
public class DocumentExtractor {

    static final int MAX_FILES = 5;
    static final long MAX_TOTAL_BYTES = 8L * 1024 * 1024;
    static final int MAX_PDF_PAGES = 20;
    static final int MAX_TEXT_CHARS = 25_000;
    static final int MAX_SOURCE_DIMENSION = 10_000;
    static final int TARGET_DIMENSION = 1600;
    static final int MIN_CHARS_PER_PAGE = 100;
    static final int MAX_RENDERED_PAGES = 8;
    static final int RENDER_DPI = 150;
    static final long EXTRACT_TIMEOUT_SECONDS = 20;

    private static final byte[] PDF_MAGIC = {0x25, 0x50, 0x44, 0x46, 0x2D};
    private static final byte[] PNG_MAGIC = {(byte) 0x89, 0x50, 0x4E, 0x47};
    private static final byte[] JPEG_MAGIC = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final byte[] ZIP_MAGIC = {0x50, 0x4B, 0x03, 0x04};
    private static final byte[] RIFF_MAGIC = {0x52, 0x49, 0x46, 0x46};
    private static final byte[] WEBP_TAG = {0x57, 0x45, 0x42, 0x50};

    public ExtractedInput extract(List<MultipartFile> files, String pastedText) {
        List<MultipartFile> present = files == null
                ? List.of()
                : files.stream().filter(f -> f != null && !f.isEmpty()).toList();

        if (present.size() > MAX_FILES) {
            throw new BadRequestException("Please upload at most " + MAX_FILES + " files at a time.");
        }
        long total = present.stream().mapToLong(MultipartFile::getSize).sum();
        if (total > MAX_TOTAL_BYTES) {
            throw new BadRequestException("Those files are too large. Keep the total under 8 MB.");
        }

        StringBuilder text = new StringBuilder();
        List<ExtractedImage> images = new ArrayList<>();

        if (pastedText != null && !pastedText.isBlank()) {
            text.append(truncate(pastedText.strip())).append("\n\n");
        }

        for (MultipartFile file : present) {
            byte[] bytes = read(file);
            Kind kind = sniff(bytes);
            switch (kind) {
                case PDF -> readPdf(bytes, text, images);
                case IMAGE -> images.add(normalizeImage(bytes));
                case ZIP -> throw new BadRequestException(
                        "Archives are not supported. Upload the outline itself as a PDF or an image.");
                case UNKNOWN -> throw new BadRequestException(
                        "Unsupported file type. Upload a PDF, PNG, JPEG, or WebP.");
            }
        }

        String joined = text.length() > MAX_TEXT_CHARS
                ? text.substring(0, MAX_TEXT_CHARS)
                : text.toString();
        return new ExtractedInput(joined.strip(), List.copyOf(images));
    }

    private void readPdf(byte[] bytes, StringBuilder text, List<ExtractedImage> images) {
        Extracted extracted = withTimeout(() -> {
            try (PDDocument doc = Loader.loadPDF(new RandomAccessReadBuffer(bytes))) {
                int pages = doc.getNumberOfPages();
                if (pages > MAX_PDF_PAGES) {
                    throw new BadRequestException(
                            "That PDF has " + pages + " pages. Upload one with at most " + MAX_PDF_PAGES + ".");
                }
                PDFTextStripper stripper = new PDFTextStripper();
                stripper.setSortByPosition(true);
                String body = stripper.getText(doc);
                if (body != null && body.strip().length() >= (long) pages * MIN_CHARS_PER_PAGE) {
                    return new Extracted(body, List.of());
                }
                return new Extracted(null, render(doc, pages));
            }
        });

        if (extracted.text() != null) {
            text.append(extracted.text()).append("\n\n");
        }
        images.addAll(extracted.images());
    }

    private List<ExtractedImage> render(PDDocument doc, int pages) throws Exception {
        PDFRenderer renderer = new PDFRenderer(doc);
        List<ExtractedImage> out = new ArrayList<>();
        int limit = Math.min(pages, MAX_RENDERED_PAGES);
        for (int i = 0; i < limit; i++) {
            BufferedImage page = renderer.renderImageWithDPI(i, RENDER_DPI);
            out.add(encode(downscale(page)));
        }
        return out;
    }

    private ExtractedImage normalizeImage(byte[] bytes) {
        return withTimeout(() -> {
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(bytes));
            if (image == null) {
                throw new BadRequestException("That image could not be read.");
            }
            if (image.getWidth() > MAX_SOURCE_DIMENSION || image.getHeight() > MAX_SOURCE_DIMENSION) {
                throw new BadRequestException("That image is too large to process.");
            }
            return encode(downscale(image));
        });
    }

    private BufferedImage downscale(BufferedImage image) throws Exception {
        if (image.getWidth() <= TARGET_DIMENSION && image.getHeight() <= TARGET_DIMENSION) {
            return image;
        }
        return Thumbnails.of(image).size(TARGET_DIMENSION, TARGET_DIMENSION).asBufferedImage();
    }

    private ExtractedImage encode(BufferedImage image) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        return new ExtractedImage("image/png", out.toByteArray());
    }

    private <T> T withTimeout(Callable<T> work) {
        ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "course-parse-extract");
            t.setDaemon(true);
            return t;
        });
        try {
            Future<T> future = executor.submit(work);
            return future.get(EXTRACT_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (TimeoutException e) {
            throw new BadRequestException("That file took too long to read. Try a smaller one.");
        } catch (Exception e) {
            Throwable cause = e.getCause() != null ? e.getCause() : e;
            if (cause instanceof BadRequestException bad) {
                throw bad;
            }
            throw new BadRequestException("That file could not be read.");
        } finally {
            executor.shutdownNow();
        }
    }

    private byte[] read(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (Exception e) {
            throw new BadRequestException("That file could not be read.");
        }
    }

    private String truncate(String value) {
        return value.length() > MAX_TEXT_CHARS ? value.substring(0, MAX_TEXT_CHARS) : value;
    }

    static Kind sniff(byte[] bytes) {
        if (startsWith(bytes, ZIP_MAGIC)) return Kind.ZIP;
        if (startsWith(bytes, PDF_MAGIC)) return Kind.PDF;
        if (startsWith(bytes, PNG_MAGIC)) return Kind.IMAGE;
        if (startsWith(bytes, JPEG_MAGIC)) return Kind.IMAGE;
        if (startsWith(bytes, RIFF_MAGIC) && bytes.length >= 12
                && bytes[8] == WEBP_TAG[0] && bytes[9] == WEBP_TAG[1]
                && bytes[10] == WEBP_TAG[2] && bytes[11] == WEBP_TAG[3]) {
            return Kind.IMAGE;
        }
        return Kind.UNKNOWN;
    }

    private static boolean startsWith(byte[] bytes, byte[] magic) {
        if (bytes.length < magic.length) return false;
        for (int i = 0; i < magic.length; i++) {
            if (bytes[i] != magic[i]) return false;
        }
        return true;
    }

    enum Kind { PDF, IMAGE, ZIP, UNKNOWN }

    private record Extracted(String text, List<ExtractedImage> images) {
    }
}
