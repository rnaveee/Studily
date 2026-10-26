package com.rnave.studily.flashcard.generate;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.TooManyRequestsException;
import com.rnave.studily.config.WebpSize;
import com.rnave.studily.flashcard.generate.StudyDocument.Figure;
import com.rnave.studily.flashcard.generate.StudyDocument.Page;
import com.rnave.studily.flashcard.generate.StudyDocument.Picture;
import com.rnave.studily.parse.PageSelection;
import jakarta.annotation.PreDestroy;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.io.MemoryUsageSetting;
import org.apache.pdfbox.io.RandomAccessReadBuffer;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDResources;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.apache.pdfbox.pdmodel.graphics.PDXObject;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.openxml4j.util.ZipSecureFile;
import org.apache.poi.xslf.usermodel.XMLSlideShow;
import org.apache.poi.xslf.usermodel.XSLFGroupShape;
import org.apache.poi.xslf.usermodel.XSLFNotes;
import org.apache.poi.xslf.usermodel.XSLFPictureData;
import org.apache.poi.xslf.usermodel.XSLFPictureShape;
import org.apache.poi.xslf.usermodel.XSLFShape;
import org.apache.poi.xslf.usermodel.XSLFSlide;
import org.apache.poi.xslf.usermodel.XSLFTable;
import org.apache.poi.xslf.usermodel.XSLFTableCell;
import org.apache.poi.xslf.usermodel.XSLFTableRow;
import org.apache.poi.xslf.usermodel.XSLFTextShape;
import org.apache.poi.xwpf.usermodel.IBodyElement;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFPicture;
import org.apache.poi.xwpf.usermodel.XWPFPictureData;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.awt.Dimension;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@Component
public class StudyDocumentReader {

    private static final Logger log = LoggerFactory.getLogger(StudyDocumentReader.class);

    static final int READER_VERSION = 1;
    static final int MAX_PAGES = 80;
    static final int MAX_SOURCE_PAGES = 500;
    static final int MAX_TEXT_CHARS = 150_000;
    static final int MAX_FIGURES = 30;
    static final int MAX_RENDERS = 40;
    static final int VISUAL_TEXT_CHARS = 300;
    static final int MIN_FIGURE_SIDE = 150;
    static final int LOGO_PAGES = 3;
    static final int RENDER_SIDE = 1024;
    static final int FIGURE_SIDE = 768;
    static final int PHOTO_SIDE = 1600;
    static final int SECTION_CHARS = 3_000;
    static final long PDF_MEMORY_BYTES = 64L * 1024 * 1024;
    static final long MAX_WEBP_BYTES = 5L * 1024 * 1024;
    static final int MAX_WEBP_SIDE = 8_000;
    static final int TIMEOUT_SECONDS = 30;

    static {
        ZipSecureFile.setMinInflateRatio(0.01);
        ZipSecureFile.setMaxEntrySize(SafeZip.MAX_ENTRY_BYTES);
        ZipSecureFile.setMaxFileCount(SafeZip.MAX_ENTRIES);
        ZipSecureFile.setMaxTextSize(20_000_000L);
    }

    private final ThreadPoolExecutor executor = new ThreadPoolExecutor(
            2, 2, 0, TimeUnit.MILLISECONDS, new ArrayBlockingQueue<>(6), runnable -> {
                Thread thread = new Thread(runnable, "flashcard-doc-reader");
                thread.setDaemon(true);
                return thread;
            });

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }

    public StudyDocument read(String fileName, byte[] bytes) {
        return read(fileName, bytes, PageSelection.ALL);
    }

    public StudyDocument read(String fileName, byte[] bytes, PageSelection selection) {
        FileKind kind = FileSniffer.sniff(bytes);
        Future<StudyDocument> future;
        try {
            future = executor.submit(() -> parse(fileName, kind, bytes, selection));
        } catch (RejectedExecutionException e) {
            throw new TooManyRequestsException("Lots of documents are being read right now. Try again in a minute.");
        }
        try {
            return future.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (TimeoutException e) {
            future.cancel(true);
            throw new BadRequestException(fileName + " took too long to read. Try a smaller file.");
        } catch (InterruptedException e) {
            future.cancel(true);
            Thread.currentThread().interrupt();
            throw new BadRequestException(fileName + " could not be read.");
        } catch (ExecutionException e) {
            if (e.getCause() instanceof BadRequestException bad) {
                throw bad;
            }
            log.warn("Reading a {} for flashcards failed: {}", kind, String.valueOf(e.getCause()));
            throw new BadRequestException(fileName + " could not be read. It may be damaged.");
        }
    }

    StudyDocument parse(String fileName, FileKind kind, byte[] bytes, PageSelection selection) throws Exception {
        StudyDocument doc = switch (kind) {
            case PDF -> readPdf(fileName, bytes, selection);
            case PPTX -> readPptx(fileName, bytes, selection);
            case DOCX -> readDocx(fileName, bytes);
            case PNG, JPEG -> readPhoto(fileName, kind, bytes);
            case WEBP -> readWebp(fileName, bytes);
            case TEXT -> readText(fileName, bytes);
        };
        if (doc.textChars() > MAX_TEXT_CHARS) {
            throw new BadRequestException(fileName + " is too long to turn into cards in one go. "
                    + "Split it into smaller files and upload them one at a time.");
        }
        if (doc.textChars() == 0 && doc.pages().stream().allMatch(p -> p.render() == null) && doc.figures().isEmpty()) {
            throw new BadRequestException(fileName + " doesn't have any text or pictures to make cards from.");
        }
        return doc;
    }

    private StudyDocument readPdf(String fileName, byte[] bytes, PageSelection selection) throws IOException {
        try (PDDocument doc = Loader.loadPDF(new RandomAccessReadBuffer(bytes), "",
                MemoryUsageSetting.setupMixed(PDF_MEMORY_BYTES).streamCache)) {
            int count = doc.getNumberOfPages();
            if (count == 0) {
                throw new BadRequestException(fileName + " has no pages.");
            }
            List<Integer> numbers = selected(fileName, count, selection, "page");
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            List<String> texts = new ArrayList<>();
            List<List<Candidate>> candidates = new ArrayList<>();
            Map<String, Set<Integer>> pagesByHash = new HashMap<>();
            for (int number : numbers) {
                stripper.setStartPage(number);
                stripper.setEndPage(number);
                texts.add(clean(stripper.getText(doc)));
                List<Candidate> onPage = pdfImages(doc.getPage(number - 1));
                candidates.add(onPage);
                for (Candidate c : onPage) {
                    pagesByHash.computeIfAbsent(c.hash(), h -> new LinkedHashSet<>()).add(number);
                }
            }
            List<Figure> figures = new ArrayList<>();
            Set<String> seen = new LinkedHashSet<>();
            for (int i = 0; i < numbers.size() && figures.size() < MAX_FIGURES; i++) {
                for (Candidate c : candidates.get(i)) {
                    if (figures.size() >= MAX_FIGURES) {
                        break;
                    }
                    if (pagesByHash.get(c.hash()).size() >= LOGO_PAGES || !seen.add(c.hash())) {
                        continue;
                    }
                    Picture picture = pdfPicture(c.image());
                    if (picture != null) {
                        figures.add(new Figure(figures.size() + 1, numbers.get(i), picture));
                    }
                }
            }
            Set<Integer> renderPages = visualPages(numbers, texts, figures);
            PDFRenderer renderer = new PDFRenderer(doc);
            List<Page> pages = new ArrayList<>();
            for (int i = 0; i < numbers.size(); i++) {
                int number = numbers.get(i);
                Picture render = renderPages.contains(number)
                        ? renderPdfPage(renderer, doc.getPage(number - 1), number - 1) : null;
                pages.add(new Page(number, texts.get(i), render));
            }
            return new StudyDocument(fileName, FileKind.PDF, "Page", pages, figures);
        } catch (InvalidPasswordException e) {
            throw new BadRequestException(fileName + " is password-protected. Remove the password and try again.");
        }
    }

    private record Candidate(String hash, PDImageXObject image) {
    }

    private List<Candidate> pdfImages(PDPage page) {
        List<Candidate> out = new ArrayList<>();
        PDResources resources = page.getResources();
        if (resources == null) {
            return out;
        }
        for (COSName name : resources.getXObjectNames()) {
            try {
                PDXObject object = resources.getXObject(name);
                if (object instanceof PDImageXObject image
                        && image.getWidth() >= MIN_FIGURE_SIDE && image.getHeight() >= MIN_FIGURE_SIDE
                        && Pictures.safeSize(image.getWidth(), image.getHeight())) {
                    out.add(new Candidate(hash(image), image));
                }
            } catch (IOException | RuntimeException e) {
                log.debug("Skipped an unreadable PDF image: {}", e.getMessage());
            }
        }
        return out;
    }

    private static String hash(PDImageXObject image) throws IOException {
        MessageDigest digest = sha256();
        try (InputStream in = image.getCOSObject().createRawInputStream()) {
            byte[] buffer = new byte[64 * 1024];
            int n;
            while ((n = in.read(buffer)) > 0) {
                digest.update(buffer, 0, n);
            }
        }
        return HexFormat.of().formatHex(digest.digest());
    }

    private static Picture pdfPicture(PDImageXObject image) {
        try {
            BufferedImage decoded = image.getImage();
            return decoded == null ? null : Pictures.of(decoded, FIGURE_SIDE);
        } catch (IOException | RuntimeException e) {
            return null;
        }
    }

    private static Picture renderPdfPage(PDFRenderer renderer, PDPage page, int index) {
        PDRectangle box = page.getMediaBox();
        float longest = Math.max(box.getWidth(), box.getHeight());
        if (longest <= 0) {
            return null;
        }
        try {
            BufferedImage image = renderer.renderImage(index, RENDER_SIDE / longest, ImageType.RGB);
            return Pictures.of(image, RENDER_SIDE);
        } catch (IOException | RuntimeException e) {
            return null;
        }
    }

    private StudyDocument readPptx(String fileName, byte[] bytes, PageSelection selection) throws IOException {
        try (XMLSlideShow show = new XMLSlideShow(new ByteArrayInputStream(bytes))) {
            List<XSLFSlide> slides = show.getSlides();
            if (slides.isEmpty()) {
                throw new BadRequestException(fileName + " has no slides.");
            }
            List<Integer> numbers = selected(fileName, slides.size(), selection, "slide");
            List<String> texts = new ArrayList<>();
            List<List<XSLFPictureData>> pictures = new ArrayList<>();
            Map<String, Set<Integer>> slidesByHash = new HashMap<>();
            for (int number : numbers) {
                XSLFSlide slide = slides.get(number - 1);
                StringBuilder text = new StringBuilder();
                List<XSLFPictureData> onSlide = new ArrayList<>();
                collect(slide.getShapes(), text, onSlide);
                String notes = notes(slide.getNotes());
                if (!notes.isBlank()) {
                    text.append("\nSpeaker notes: ").append(notes);
                }
                texts.add(clean(text.toString()));
                pictures.add(onSlide);
                for (XSLFPictureData data : onSlide) {
                    slidesByHash.computeIfAbsent(checksum(data), h -> new LinkedHashSet<>()).add(number);
                }
            }
            List<Figure> figures = new ArrayList<>();
            Set<String> seen = new LinkedHashSet<>();
            for (int i = 0; i < numbers.size() && figures.size() < MAX_FIGURES; i++) {
                for (XSLFPictureData data : pictures.get(i)) {
                    if (figures.size() >= MAX_FIGURES) {
                        break;
                    }
                    String hash = checksum(data);
                    if (slidesByHash.get(hash).size() >= LOGO_PAGES || !seen.add(hash)) {
                        continue;
                    }
                    Picture picture = officePicture(data.getContentType(), data.getData());
                    if (picture != null) {
                        figures.add(new Figure(figures.size() + 1, numbers.get(i), picture));
                    }
                }
            }
            Set<Integer> renderSlides = visualPages(numbers, texts, figures);
            Dimension size = show.getPageSize();
            List<Page> pages = new ArrayList<>();
            for (int i = 0; i < numbers.size(); i++) {
                int number = numbers.get(i);
                Picture render = renderSlides.contains(number) ? renderSlide(slides.get(number - 1), size) : null;
                pages.add(new Page(number, texts.get(i), render));
            }
            return new StudyDocument(fileName, FileKind.PPTX, "Slide", pages, figures);
        }
    }

    private static void collect(List<XSLFShape> shapes, StringBuilder text, List<XSLFPictureData> pictures) {
        for (XSLFShape shape : shapes) {
            if (shape instanceof XSLFTextShape textShape) {
                String value = textShape.getText();
                if (value != null && !value.isBlank()) {
                    text.append(value.strip()).append('\n');
                }
            } else if (shape instanceof XSLFGroupShape group) {
                collect(group.getShapes(), text, pictures);
            } else if (shape instanceof XSLFTable table) {
                for (XSLFTableRow row : table.getRows()) {
                    List<String> cells = new ArrayList<>();
                    for (XSLFTableCell cell : row.getCells()) {
                        cells.add(cell.getText() == null ? "" : cell.getText().strip());
                    }
                    text.append(String.join(" | ", cells)).append('\n');
                }
            } else if (shape instanceof XSLFPictureShape picture) {
                XSLFPictureData data = picture.getPictureData();
                if (data != null && isRaster(data.getContentType())) {
                    pictures.add(data);
                }
            }
        }
    }

    private static String notes(XSLFNotes notes) {
        if (notes == null) {
            return "";
        }
        StringBuilder text = new StringBuilder();
        for (XSLFShape shape : notes.getShapes()) {
            if (shape instanceof XSLFTextShape textShape) {
                String value = textShape.getText();
                if (value != null && !value.isBlank() && !value.strip().matches("\\d+")) {
                    text.append(value.strip()).append('\n');
                }
            }
        }
        return text.toString().strip();
    }

    private static String checksum(XSLFPictureData data) {
        return HexFormat.of().formatHex(data.getChecksum());
    }

    private static Picture renderSlide(XSLFSlide slide, Dimension size) {
        if (size.width <= 0 || size.height <= 0) {
            return null;
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
            slide.draw(g);
            return Pictures.of(image, RENDER_SIDE);
        } catch (Exception | LinkageError e) {
            return null;
        } finally {
            g.dispose();
        }
    }

    private StudyDocument readDocx(String fileName, byte[] bytes) throws IOException {
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(bytes))) {
            List<String> sections = new ArrayList<>();
            Map<Integer, List<XWPFPictureData>> picturesBySection = new LinkedHashMap<>();
            StringBuilder current = new StringBuilder();
            for (IBodyElement element : doc.getBodyElements()) {
                if (element instanceof XWPFParagraph paragraph) {
                    current.append(paragraph.getText()).append('\n');
                    for (XWPFRun run : paragraph.getRuns()) {
                        for (XWPFPicture picture : run.getEmbeddedPictures()) {
                            XWPFPictureData data = picture.getPictureData();
                            if (data != null) {
                                picturesBySection.computeIfAbsent(sections.size() + 1, k -> new ArrayList<>()).add(data);
                            }
                        }
                    }
                } else if (element instanceof XWPFTable table) {
                    for (XWPFTableRow row : table.getRows()) {
                        List<String> cells = new ArrayList<>();
                        for (XWPFTableCell cell : row.getTableCells()) {
                            cells.add(cell.getText() == null ? "" : cell.getText().strip());
                        }
                        current.append(String.join(" | ", cells)).append('\n');
                    }
                }
                if (current.length() >= SECTION_CHARS) {
                    sections.add(clean(current.toString()));
                    current.setLength(0);
                }
                if (sections.stream().mapToInt(String::length).sum() > MAX_TEXT_CHARS) {
                    break;
                }
            }
            if (!current.isEmpty()) {
                sections.add(clean(current.toString()));
            }
            List<Figure> figures = new ArrayList<>();
            Set<String> seen = new LinkedHashSet<>();
            for (Map.Entry<Integer, List<XWPFPictureData>> entry : picturesBySection.entrySet()) {
                for (XWPFPictureData data : entry.getValue()) {
                    if (figures.size() >= MAX_FIGURES) {
                        break;
                    }
                    String type = "image/" + data.suggestFileExtension().toLowerCase(Locale.ROOT).replace("jpg", "jpeg");
                    if (!isRaster(type) || !seen.add(HexFormat.of().formatHex(sha256().digest(data.getData())))) {
                        continue;
                    }
                    Picture picture = officePicture(type, data.getData());
                    if (picture != null) {
                        int section = Math.min(entry.getKey(), Math.max(1, sections.size()));
                        figures.add(new Figure(figures.size() + 1, section, picture));
                    }
                }
            }
            List<Page> pages = new ArrayList<>();
            for (int i = 0; i < sections.size(); i++) {
                pages.add(new Page(i + 1, sections.get(i), null));
            }
            if (pages.isEmpty()) {
                pages.add(new Page(1, "", null));
            }
            return new StudyDocument(fileName, FileKind.DOCX, "Section", pages, figures);
        }
    }

    private static StudyDocument readPhoto(String fileName, FileKind kind, byte[] bytes) {
        BufferedImage image = Pictures.decodeOrReject(bytes);
        Picture page = Pictures.of(image, PHOTO_SIDE);
        if (page == null) {
            throw new BadRequestException(fileName + " could not be read.");
        }
        List<Figure> figures = new ArrayList<>();
        Picture figure = Pictures.of(image, FIGURE_SIDE);
        if (figure != null) {
            figures.add(new Figure(1, 1, figure));
        }
        return new StudyDocument(fileName, kind, "Image", List.of(new Page(1, "", page)), figures);
    }

    private static StudyDocument readWebp(String fileName, byte[] bytes) {
        int[] size = WebpSize.of(bytes);
        if (size == null) {
            throw new BadRequestException(fileName + " could not be read.");
        }
        if (bytes.length > MAX_WEBP_BYTES || Math.max(size[0], size[1]) > MAX_WEBP_SIDE) {
            throw new BadRequestException(fileName + " is too large. Save it as a JPEG or PNG and try again.");
        }
        Picture picture = new Picture(bytes, "image/webp", size[0], size[1]);
        return new StudyDocument(fileName, FileKind.WEBP, "Image", List.of(new Page(1, "", picture)),
                List.of(new Figure(1, 1, picture)));
    }

    private static StudyDocument readText(String fileName, byte[] bytes) {
        String text = new String(bytes, StandardCharsets.UTF_8).replace("﻿", "").replace("\r\n", "\n");
        if (text.length() > MAX_TEXT_CHARS) {
            throw new BadRequestException(fileName + " is too long to turn into cards in one go. "
                    + "Split it into smaller files and upload them one at a time.");
        }
        List<Page> pages = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        for (String line : text.split("\n", -1)) {
            current.append(line).append('\n');
            if (current.length() >= SECTION_CHARS) {
                pages.add(new Page(pages.size() + 1, clean(current.toString()), null));
                current.setLength(0);
            }
        }
        if (!current.toString().isBlank() || pages.isEmpty()) {
            pages.add(new Page(pages.size() + 1, clean(current.toString()), null));
        }
        return new StudyDocument(fileName, FileKind.TEXT, "Section", pages, List.of());
    }

    private static Picture officePicture(String contentType, byte[] data) {
        if (!isRaster(contentType)) {
            return null;
        }
        int[] size = Pictures.headerSize(data);
        if (size == null || size[0] < MIN_FIGURE_SIDE || size[1] < MIN_FIGURE_SIDE) {
            return null;
        }
        BufferedImage image = Pictures.decode(data);
        return image == null ? null : Pictures.of(image, FIGURE_SIDE);
    }

    private static boolean isRaster(String contentType) {
        return contentType != null
                && (contentType.equals("image/png") || contentType.equals("image/jpeg"));
    }

    private static List<Integer> selected(String fileName, int count, PageSelection selection, String unit) {
        if (count > MAX_SOURCE_PAGES || (selection.all() && count > MAX_PAGES)) {
            throw new BadRequestException(fileName + " has " + count + " " + unit + "s. Pick at most " + MAX_PAGES
                    + " " + unit + "s to read, or split it into parts.");
        }
        List<Integer> numbers = selection.resolve(count, fileName, unit);
        if (numbers.size() > MAX_PAGES) {
            throw new BadRequestException("You picked " + numbers.size() + " " + unit + "s of " + fileName
                    + ". Pick at most " + MAX_PAGES + ".");
        }
        return numbers;
    }

    static Set<Integer> visualPages(List<String> texts, List<Figure> figures) {
        List<Integer> numbers = new ArrayList<>();
        for (int i = 0; i < texts.size(); i++) {
            numbers.add(i + 1);
        }
        return visualPages(numbers, texts, figures);
    }

    static Set<Integer> visualPages(List<Integer> numbers, List<String> texts, List<Figure> figures) {
        Set<Integer> withFigures = new LinkedHashSet<>();
        figures.forEach(f -> withFigures.add(f.page()));
        List<Integer> visual = new ArrayList<>();
        for (int i = 0; i < texts.size(); i++) {
            if (texts.get(i).length() < VISUAL_TEXT_CHARS || withFigures.contains(numbers.get(i))) {
                visual.add(i);
            }
        }
        visual.sort(Comparator.comparingInt(i -> texts.get(i).length()));
        Set<Integer> out = new LinkedHashSet<>();
        for (int i : visual.subList(0, Math.min(visual.size(), MAX_RENDERS))) {
            out.add(numbers.get(i));
        }
        return out;
    }

    static String clean(String text) {
        if (text == null) {
            return "";
        }
        return text.replace("\r", "")
                .replaceAll("[ \\t\\x0B\\f]+", " ")
                .replaceAll(" *\\n *", "\n")
                .replaceAll("\\n{3,}", "\n\n")
                .strip();
    }

    private static MessageDigest sha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
