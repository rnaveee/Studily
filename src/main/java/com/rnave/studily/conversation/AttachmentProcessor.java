package com.rnave.studily.conversation;

import com.rnave.studily.config.BadRequestException;
import net.coobird.thumbnailator.Thumbnails;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class AttachmentProcessor {

    public static final long MAX_BYTES = 10L * 1024 * 1024;

    private static final int MAX_IMAGE_DIMENSION = 1600;
    private static final int MAX_SOURCE_DIMENSION = 10000;
    private static final Set<String> IMAGE_TYPES = Set.of("image/jpeg", "image/png");
    private static final String GIF_TYPE = "image/gif";
    private static final String WEBP_TYPE = "image/webp";
    private static final Map<String, String> DOC_TYPES_BY_EXTENSION = Map.ofEntries(
            Map.entry("pdf", "application/pdf"),
            Map.entry("doc", "application/msword"),
            Map.entry("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            Map.entry("ppt", "application/vnd.ms-powerpoint"),
            Map.entry("pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
            Map.entry("xls", "application/vnd.ms-excel"),
            Map.entry("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            Map.entry("txt", "text/plain"),
            Map.entry("csv", "text/csv"),
            Map.entry("md", "text/markdown"));

    public record Processed(String filename, String contentType, byte[] data, Integer width, Integer height) {
    }

    public Processed process(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("File is empty");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new BadRequestException("File must be smaller than 10MB");
        }
        String filename = sanitizeFilename(file.getOriginalFilename());
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new BadRequestException("Could not read file");
        }
        if (contentType.equals(GIF_TYPE)) {
            return processGif(filename, bytes);
        }
        if (contentType.equals(WEBP_TYPE)) {
            return processWebp(filename, bytes);
        }
        if (IMAGE_TYPES.contains(contentType)) {
            return processImage(filename, bytes);
        }
        String docType = DOC_TYPES_BY_EXTENSION.get(extension(filename));
        if (docType == null || contentType.startsWith("image/")) {
            throw new BadRequestException(
                    "Unsupported file type. Send a photo (JPEG, PNG, WEBP, GIF) or a document (PDF, Word, PowerPoint, Excel, TXT, CSV, MD).");
        }
        if (docType.equals("application/pdf") && !startsWith(bytes, "%PDF-")) {
            throw new BadRequestException("This file doesn't look like a valid PDF");
        }
        return new Processed(filename, docType, bytes, null, null);
    }

    private Processed processGif(String filename, byte[] bytes) {
        if (!startsWith(bytes, "GIF87a") && !startsWith(bytes, "GIF89a")) {
            throw new BadRequestException("This file doesn't look like a valid GIF");
        }
        int[] size = readDimensions(bytes);
        if (Math.max(size[0], size[1]) > MAX_IMAGE_DIMENSION) {
            throw new BadRequestException(
                    "GIF dimensions are too large (max " + MAX_IMAGE_DIMENSION + "px per side)");
        }
        return new Processed(filename, GIF_TYPE, bytes, size[0], size[1]);
    }

    private Processed processWebp(String filename, byte[] bytes) {
        if (!startsWith(bytes, "RIFF") || bytes.length < 30 || !matchesAt(bytes, 8, "WEBP")) {
            throw new BadRequestException("This file doesn't look like a valid WEBP");
        }
        int[] size = webpDimensions(bytes);
        if (Math.max(size[0], size[1]) > MAX_IMAGE_DIMENSION) {
            throw new BadRequestException(
                    "Image dimensions are too large (max " + MAX_IMAGE_DIMENSION + "px per side)");
        }
        return new Processed(filename, WEBP_TYPE, bytes, size[0], size[1]);
    }

    private static int[] webpDimensions(byte[] b) {
        if (matchesAt(b, 12, "VP8X")) {
            return new int[] {u24(b, 24) + 1, u24(b, 27) + 1};
        }
        if (matchesAt(b, 12, "VP8L")) {
            int bits = u8(b, 21) | (u8(b, 22) << 8) | (u8(b, 23) << 16) | (u8(b, 24) << 24);
            return new int[] {(bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1};
        }
        if (matchesAt(b, 12, "VP8 ")) {
            return new int[] {
                ((u8(b, 27) << 8) | u8(b, 26)) & 0x3FFF,
                ((u8(b, 29) << 8) | u8(b, 28)) & 0x3FFF,
            };
        }
        throw new BadRequestException("This file doesn't look like a valid WEBP");
    }

    private static int u8(byte[] b, int i) {
        return b[i] & 0xFF;
    }

    private static int u24(byte[] b, int i) {
        return u8(b, i) | (u8(b, i + 1) << 8) | (u8(b, i + 2) << 16);
    }

    private static boolean matchesAt(byte[] bytes, int offset, String text) {
        byte[] p = text.getBytes(StandardCharsets.US_ASCII);
        if (bytes.length < offset + p.length) {
            return false;
        }
        for (int i = 0; i < p.length; i++) {
            if (bytes[offset + i] != p[i]) {
                return false;
            }
        }
        return true;
    }

    private Processed processImage(String filename, byte[] bytes) {
        int[] source = readDimensions(bytes);
        if (Math.max(source[0], source[1]) > MAX_SOURCE_DIMENSION) {
            throw new BadRequestException(
                    "Image dimensions are too large (max " + MAX_SOURCE_DIMENSION + "px per side)");
        }
        BufferedImage image;
        try {
            image = Thumbnails.of(new ByteArrayInputStream(bytes)).scale(1.0).asBufferedImage();
            if (Math.max(image.getWidth(), image.getHeight()) > MAX_IMAGE_DIMENSION) {
                image = Thumbnails.of(image)
                        .size(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION)
                        .keepAspectRatio(true)
                        .asBufferedImage();
            }
        } catch (IOException | IllegalArgumentException e) {
            throw new BadRequestException("Could not read image");
        }
        boolean png = image.getColorModel().hasAlpha();
        BufferedImage canvas = png ? image : toRgb(image);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            ImageIO.write(canvas, png ? "png" : "jpg", out);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to encode image", e);
        }
        String baseName = filename.contains(".") ? filename.substring(0, filename.lastIndexOf('.')) : filename;
        return new Processed(
                baseName + (png ? ".png" : ".jpg"),
                png ? "image/png" : "image/jpeg",
                out.toByteArray(),
                canvas.getWidth(), canvas.getHeight());
    }

    private int[] readDimensions(byte[] bytes) {
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(in);
            if (!readers.hasNext()) {
                throw new BadRequestException("Could not read image");
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(in);
                return new int[] {reader.getWidth(0), reader.getHeight(0)};
            } finally {
                reader.dispose();
            }
        } catch (IOException e) {
            throw new BadRequestException("Could not read image");
        }
    }

    private static BufferedImage toRgb(BufferedImage image) {
        if (image.getType() == BufferedImage.TYPE_INT_RGB) {
            return image;
        }
        BufferedImage rgb = new BufferedImage(image.getWidth(), image.getHeight(), BufferedImage.TYPE_INT_RGB);
        var g = rgb.createGraphics();
        g.drawImage(image, 0, 0, Color.WHITE, null);
        g.dispose();
        return rgb;
    }

    private static String sanitizeFilename(String original) {
        String name = original == null ? "file" : original;
        name = name.substring(Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1);
        name = name.replaceAll("[\\p{Cntrl}\"\\\\]", "").trim();
        if (name.isEmpty() || name.equals(".") || name.equals("..")) {
            name = "file";
        }
        return name.length() > 200 ? name.substring(name.length() - 200) : name;
    }

    private static boolean startsWith(byte[] bytes, String prefix) {
        byte[] p = prefix.getBytes(StandardCharsets.US_ASCII);
        if (bytes.length < p.length) {
            return false;
        }
        for (int i = 0; i < p.length; i++) {
            if (bytes[i] != p[i]) {
                return false;
            }
        }
        return true;
    }

    private static String extension(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot < 0 ? "" : filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }
}
