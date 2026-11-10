package com.rnave.studily.rag;

import com.rnave.studily.filebank.BankFormat;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.io.RandomAccessReadBuffer;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.openxml4j.util.ZipSecureFile;
import org.apache.poi.sl.usermodel.Placeholder;
import org.apache.poi.xslf.usermodel.XMLSlideShow;
import org.apache.poi.xslf.usermodel.XSLFGroupShape;
import org.apache.poi.xslf.usermodel.XSLFNotes;
import org.apache.poi.xslf.usermodel.XSLFShape;
import org.apache.poi.xslf.usermodel.XSLFSlide;
import org.apache.poi.xslf.usermodel.XSLFTable;
import org.apache.poi.xslf.usermodel.XSLFTableCell;
import org.apache.poi.xslf.usermodel.XSLFTableRow;
import org.apache.poi.xslf.usermodel.XSLFTextShape;
import org.apache.poi.xwpf.usermodel.IBodyElement;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Component
public class TextExtractor {

    static final long TIMEOUT_SECONDS = 90;
    static final int MIN_READABLE_CHARS = 25;
    static final int MAX_HEADING = 300;

    private static final Pattern MARKDOWN_HEADING = Pattern.compile("^#{1,6}\\s+(.+)$");

    static {
        ZipSecureFile.setMaxEntrySize(100L * 1024 * 1024);
    }

    private final int maxPages;

    public TextExtractor(@Value("${app.bank.max-pages}") int maxPages) {
        this.maxPages = maxPages;
    }

    public ExtractedDocument extract(byte[] bytes, BankFormat kind) {
        return withTimeout(() -> switch (kind) {
            case PDF -> pdf(bytes);
            case DOCX -> docx(bytes);
            case PPTX -> pptx(bytes);
            case TEXT -> plain(bytes, false);
            case MARKDOWN -> plain(bytes, true);
        });
    }

    private ExtractedDocument pdf(byte[] bytes) throws IOException {
        try (PDDocument doc = Loader.loadPDF(new RandomAccessReadBuffer(bytes))) {
            int pages = doc.getNumberOfPages();
            requirePageLimit(pages);
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            List<String> pageTexts = new ArrayList<>(pages);
            for (int page = 1; page <= pages; page++) {
                stripper.setStartPage(page);
                stripper.setEndPage(page);
                pageTexts.add(stripper.getText(doc));
            }
            List<String> cleaned = TextCleaner.removeRepeatedEdges(pageTexts);
            List<Section> sections = new ArrayList<>();
            int unreadable = 0;
            for (int i = 0; i < cleaned.size(); i++) {
                String text = TextCleaner.normalize(cleaned.get(i));
                if (text.length() < MIN_READABLE_CHARS) {
                    unreadable++;
                }
                if (!text.isBlank()) {
                    sections.add(new Section(null, text, i + 1));
                }
            }
            return new ExtractedDocument(sections, pages, unreadable);
        } catch (InvalidPasswordException e) {
            throw new IngestFailure("This PDF is password-protected. Remove the password and upload it again.", true);
        }
    }

    private ExtractedDocument pptx(byte[] bytes) throws IOException {
        try (XMLSlideShow show = new XMLSlideShow(new ByteArrayInputStream(bytes))) {
            List<XSLFSlide> slides = show.getSlides();
            requirePageLimit(slides.size());
            List<Section> sections = new ArrayList<>();
            int unreadable = 0;
            int number = 0;
            for (XSLFSlide slide : slides) {
                number++;
                String title = clean(slide.getTitle());
                StringBuilder body = new StringBuilder();
                for (XSLFShape shape : slide.getShapes()) {
                    appendShape(shape, title, body);
                }
                String notes = speakerNotes(slide.getNotes());
                if (!notes.isBlank()) {
                    body.append("\n\nSpeaker notes: ").append(notes);
                }
                String text = TextCleaner.normalize(body.toString());
                if (text.length() < MIN_READABLE_CHARS && title == null) {
                    unreadable++;
                }
                if (!text.isBlank() || title != null) {
                    sections.add(new Section(title, text.isBlank() ? title : text, number));
                }
            }
            return new ExtractedDocument(sections, slides.size(), unreadable);
        }
    }

    private void appendShape(XSLFShape shape, String title, StringBuilder out) {
        if (shape instanceof XSLFGroupShape group) {
            for (XSLFShape child : group.getShapes()) {
                appendShape(child, title, out);
            }
        } else if (shape instanceof XSLFTable table) {
            for (XSLFTableRow row : table.getRows()) {
                out.append(row.getCells().stream()
                                .map(XSLFTableCell::getText)
                                .map(String::strip)
                                .collect(Collectors.joining(" | ")))
                        .append('\n');
            }
            out.append('\n');
        } else if (shape instanceof XSLFTextShape textShape) {
            String text = textShape.getText();
            if (text != null && !text.isBlank() && !text.strip().equals(title)) {
                out.append(text.strip()).append("\n\n");
            }
        }
    }

    private String speakerNotes(XSLFNotes notes) {
        if (notes == null) {
            return "";
        }
        StringBuilder out = new StringBuilder();
        for (XSLFShape shape : notes.getShapes()) {
            if (shape instanceof XSLFTextShape textShape
                    && textShape.getTextType() == Placeholder.BODY
                    && textShape.getText() != null) {
                out.append(textShape.getText().strip()).append('\n');
            }
        }
        return out.toString().strip();
    }

    private ExtractedDocument docx(byte[] bytes) throws IOException {
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(bytes))) {
            List<Section> sections = new ArrayList<>();
            String heading = null;
            StringBuilder body = new StringBuilder();
            for (IBodyElement element : doc.getBodyElements()) {
                if (element instanceof XWPFParagraph paragraph) {
                    String text = paragraph.getText() == null ? "" : paragraph.getText().strip();
                    if (text.isEmpty()) {
                        continue;
                    }
                    if (isHeading(paragraph)) {
                        addSection(sections, heading, body);
                        heading = clean(text);
                        body.setLength(0);
                    } else {
                        body.append(text).append("\n\n");
                    }
                } else if (element instanceof XWPFTable table) {
                    for (XWPFTableRow row : table.getRows()) {
                        body.append(row.getTableCells().stream()
                                        .map(XWPFTableCell::getText)
                                        .map(String::strip)
                                        .collect(Collectors.joining(" | ")))
                                .append('\n');
                    }
                    body.append('\n');
                }
            }
            addSection(sections, heading, body);
            return new ExtractedDocument(sections, null, 0);
        }
    }

    private static boolean isHeading(XWPFParagraph paragraph) {
        String style = paragraph.getStyle();
        if (style == null) {
            return false;
        }
        String lower = style.toLowerCase(Locale.ROOT);
        return lower.startsWith("heading") || lower.equals("title") || lower.equals("subtitle");
    }

    private ExtractedDocument plain(byte[] bytes, boolean markdown) {
        String text = new String(bytes, StandardCharsets.UTF_8);
        if (!markdown) {
            String normalized = TextCleaner.normalize(text);
            return new ExtractedDocument(
                    normalized.isBlank() ? List.of() : List.of(new Section(null, normalized, null)), null, 0);
        }
        List<Section> sections = new ArrayList<>();
        String heading = null;
        StringBuilder body = new StringBuilder();
        for (String line : text.split("\\R")) {
            Matcher matcher = MARKDOWN_HEADING.matcher(line.strip());
            if (matcher.matches()) {
                addSection(sections, heading, body);
                heading = clean(matcher.group(1));
                body.setLength(0);
            } else {
                body.append(line).append('\n');
            }
        }
        addSection(sections, heading, body);
        return new ExtractedDocument(sections, null, 0);
    }

    private static void addSection(List<Section> sections, String heading, StringBuilder body) {
        String text = TextCleaner.normalize(body.toString());
        if (!text.isBlank()) {
            sections.add(new Section(heading, text, null));
        }
    }

    private void requirePageLimit(int pages) {
        if (pages > maxPages) {
            throw new IngestFailure("This file has " + pages + " pages. The limit is " + maxPages + ".", true);
        }
    }

    private static String clean(String heading) {
        if (heading == null || heading.isBlank()) {
            return null;
        }
        String text = heading.strip().replaceAll("\\s+", " ");
        return text.length() > MAX_HEADING ? text.substring(0, MAX_HEADING) : text;
    }

    private static ExtractedDocument withTimeout(Callable<ExtractedDocument> work) {
        ExecutorService executor = Executors.newSingleThreadExecutor(runnable -> {
            Thread thread = new Thread(runnable, "rag-extract");
            thread.setDaemon(true);
            return thread;
        });
        try {
            Future<ExtractedDocument> future = executor.submit(work);
            return future.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (TimeoutException e) {
            throw new IngestFailure("This file took too long to read.", true);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IngestFailure("Reading this file was interrupted.", false);
        } catch (ExecutionException e) {
            if (e.getCause() instanceof IngestFailure failure) {
                throw failure;
            }
            throw new IngestFailure("This file couldn't be read. It may be damaged.", true);
        } finally {
            executor.shutdownNow();
        }
    }
}
