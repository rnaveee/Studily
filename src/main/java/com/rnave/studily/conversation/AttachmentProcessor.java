package com.rnave.studily.conversation;

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
    private static final Set<String> IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
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
            throw new IllegalArgumentException("File is empty");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new IllegalArgumentException("File must be smaller than 10MB");
        }
        String filename = sanitizeFilename(file.getOriginalFilename());
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new IllegalArgumentException("Could not read file");
        }
        if (IMAGE_TYPES.contains(contentType)) {
            return processImage(filename, bytes);
        }
        String docType = DOC_TYPES_BY_EXTENSION.get(extension(filename));
        if (docType == null || contentType.startsWith("image/")) {
            throw new IllegalArgumentException(
                    "Unsupported file type. Send a photo (JPEG, PNG, WEBP) or a document (PDF, Word, PowerPoint, Excel, TXT, CSV, MD).");
        }
        if (docType.equals("application/pdf") && !startsWith(bytes, "%PDF-")) {
            throw new IllegalArgumentException("This file doesn't look like a valid PDF");
        }
        return new Processed(filename, docType, bytes, null, null);
    }

    private Processed processImage(String filename, byte[] bytes) {
        requireSafeDimensions(bytes);
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
            throw new IllegalArgumentException("Could not read image");
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

    private void requireSafeDimensions(byte[] bytes) {
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(in);
            if (!readers.hasNext()) {
                throw new IllegalArgumentException("Could not read image");
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(in);
                if (reader.getWidth(0) > MAX_SOURCE_DIMENSION || reader.getHeight(0) > MAX_SOURCE_DIMENSION) {
                    throw new IllegalArgumentException(
                            "Image dimensions are too large (max " + MAX_SOURCE_DIMENSION + "px per side)");
                }
            } finally {
                reader.dispose();
            }
        } catch (IOException e) {
            throw new IllegalArgumentException("Could not read image");
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
