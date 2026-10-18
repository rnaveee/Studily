package com.rnave.studily.flashcard.generate;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.flashcard.generate.StudyDocument.Picture;
import net.coobird.thumbnailator.Thumbnails;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Iterator;

final class Pictures {

    static final int MAX_SOURCE_SIDE = 10_000;
    static final long MAX_SOURCE_PIXELS = 40_000_000L;
    private static final float JPEG_QUALITY = 0.85f;

    private Pictures() {
    }

    static int[] headerSize(byte[] bytes) {
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            if (in == null) {
                return null;
            }
            Iterator<ImageReader> readers = ImageIO.getImageReaders(in);
            if (!readers.hasNext()) {
                return null;
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(in);
                return new int[] {reader.getWidth(0), reader.getHeight(0)};
            } finally {
                reader.dispose();
            }
        } catch (IOException | RuntimeException e) {
            return null;
        }
    }

    static boolean safeSize(int width, int height) {
        return width > 0 && height > 0 && width <= MAX_SOURCE_SIDE && height <= MAX_SOURCE_SIDE
                && (long) width * height <= MAX_SOURCE_PIXELS;
    }

    static BufferedImage decode(byte[] bytes) {
        int[] size = headerSize(bytes);
        if (size == null || !safeSize(size[0], size[1])) {
            return null;
        }
        try {
            return ImageIO.read(new ByteArrayInputStream(bytes));
        } catch (IOException | RuntimeException e) {
            return null;
        }
    }

    static BufferedImage decodeOrReject(byte[] bytes) {
        int[] size = headerSize(bytes);
        if (size == null) {
            throw new BadRequestException("That image could not be read.");
        }
        if (!safeSize(size[0], size[1])) {
            throw new BadRequestException("That image is too large. Use one under 10,000 pixels on each side.");
        }
        BufferedImage image = decode(bytes);
        if (image == null) {
            throw new BadRequestException("That image could not be read.");
        }
        return image;
    }

    static Picture of(BufferedImage image, int maxSide) {
        try {
            BufferedImage rgb = flatten(image);
            double scale = Math.min(1.0, (double) maxSide / Math.max(rgb.getWidth(), rgb.getHeight()));
            BufferedImage scaled = scale < 1.0 ? Thumbnails.of(rgb).scale(scale).asBufferedImage() : rgb;
            return new Picture(jpeg(scaled), "image/jpeg", scaled.getWidth(), scaled.getHeight());
        } catch (IOException | RuntimeException e) {
            return null;
        }
    }

    private static BufferedImage flatten(BufferedImage image) {
        if (image.getType() == BufferedImage.TYPE_INT_RGB) {
            return image;
        }
        BufferedImage rgb = new BufferedImage(image.getWidth(), image.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = rgb.createGraphics();
        g.drawImage(image, 0, 0, Color.WHITE, null);
        g.dispose();
        return rgb;
    }

    private static byte[] jpeg(BufferedImage image) throws IOException {
        ImageWriter writer = ImageIO.getImageWritersByFormatName("jpg").next();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ImageOutputStream stream = ImageIO.createImageOutputStream(out)) {
            writer.setOutput(stream);
            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(JPEG_QUALITY);
            writer.write(null, new IIOImage(image, null, null), param);
        } finally {
            writer.dispose();
        }
        return out.toByteArray();
    }
}
