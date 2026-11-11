package com.rnave.studily.filebank;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.config.TooManyRequestsException;
import jakarta.annotation.PreDestroy;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.io.MemoryUsageSetting;
import org.apache.pdfbox.io.RandomAccessReadBuffer;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import com.rnave.studily.flashcard.generate.SafeZip;
import org.apache.poi.xslf.usermodel.XMLSlideShow;
import org.apache.poi.xslf.usermodel.XSLFSlide;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@Component
public class PagePreviewRenderer {

    private static final Logger log = LoggerFactory.getLogger(PagePreviewRenderer.class);

    static final int RENDER_SIDE = 1280;
    static final double MAX_DPI = 300;
    static final long PDF_MEMORY_BYTES = 64L * 1024 * 1024;
    static final int TIMEOUT_SECONDS = 30;

    private final ThreadPoolExecutor executor = new ThreadPoolExecutor(
            2, 2, 0, TimeUnit.MILLISECONDS, new ArrayBlockingQueue<>(6), runnable -> {
                Thread thread = new Thread(runnable, "bank-page-preview");
                thread.setDaemon(true);
                return thread;
            });

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }

    public byte[] render(BankFormat format, String fileName, byte[] bytes, int page) {
        SafeZip.applyPoiLimits();
        Future<byte[]> future;
        try {
            future = executor.submit(() -> draw(format, fileName, bytes, page));
        } catch (RejectedExecutionException e) {
            throw new TooManyRequestsException("Lots of previews are loading right now. Try again in a minute.");
        }
        try {
            return future.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (TimeoutException e) {
            future.cancel(true);
            throw new BadRequestException(fileName + " took too long to preview. Try a smaller file.");
        } catch (InterruptedException e) {
            future.cancel(true);
            Thread.currentThread().interrupt();
            throw new BadRequestException(fileName + " could not be previewed.");
        } catch (ExecutionException e) {
            if (e.getCause() instanceof BadRequestException bad) {
                throw bad;
            }
            if (e.getCause() instanceof NotFoundException missing) {
                throw missing;
            }
            log.warn("Previewing a {} failed: {}", format, String.valueOf(e.getCause()));
            throw new BadRequestException(fileName + " could not be previewed. It may be damaged.");
        }
    }

    private static byte[] draw(BankFormat format, String fileName, byte[] bytes, int page) throws IOException {
        return switch (format) {
            case PDF -> pdfPage(fileName, bytes, page);
            case PPTX -> slide(fileName, bytes, page);
            default -> throw new NotFoundException("This file doesn't have page previews.");
        };
    }

    private static byte[] pdfPage(String fileName, byte[] bytes, int page) throws IOException {
        try (PDDocument doc = Loader.loadPDF(new RandomAccessReadBuffer(bytes), "",
                MemoryUsageSetting.setupMixed(PDF_MEMORY_BYTES).streamCache)) {
            if (page > doc.getNumberOfPages()) {
                throw new NotFoundException("Page not found");
            }
            PDRectangle box = doc.getPage(page - 1).getMediaBox();
            float longest = Math.max(box.getWidth(), box.getHeight());
            if (longest <= 0) {
                throw new BadRequestException(fileName + " could not be previewed.");
            }
            float scale = (float) Math.min(RENDER_SIDE / longest, MAX_DPI / 72.0);
            BufferedImage image = new PDFRenderer(doc).renderImage(page - 1, scale, ImageType.RGB);
            return png(image);
        } catch (InvalidPasswordException e) {
            throw new BadRequestException(fileName + " is password-protected. Remove the password and try again.");
        }
    }

    private static byte[] slide(String fileName, byte[] bytes, int page) throws IOException {
        try (XMLSlideShow show = new XMLSlideShow(new ByteArrayInputStream(bytes))) {
            List<XSLFSlide> slides = show.getSlides();
            if (page > slides.size()) {
                throw new NotFoundException("Slide not found");
            }
            Dimension size = show.getPageSize();
            if (size.width <= 0 || size.height <= 0) {
                throw new BadRequestException(fileName + " could not be previewed.");
            }
            double scale = (double) RENDER_SIDE / Math.max(size.width, size.height);
            int width = (int) Math.round(size.width * scale);
            int height = (int) Math.round(size.height * scale);
            BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = image.createGraphics();
            try {
                g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
                g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
                g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
                g.setRenderingHint(RenderingHints.KEY_FRACTIONALMETRICS, RenderingHints.VALUE_FRACTIONALMETRICS_ON);
                g.setPaint(Color.WHITE);
                g.fillRect(0, 0, width, height);
                g.scale(scale, scale);
                slides.get(page - 1).draw(g);
            } finally {
                g.dispose();
            }
            return png(image);
        }
    }

    private static byte[] png(BufferedImage image) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        if (!ImageIO.write(image, "png", out)) {
            throw new IOException("No PNG writer available");
        }
        return out.toByteArray();
    }
}
