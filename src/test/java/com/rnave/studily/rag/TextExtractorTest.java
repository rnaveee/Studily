package com.rnave.studily.rag;

import com.rnave.studily.filebank.BankFormat;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.poi.xslf.usermodel.SlideLayout;
import org.apache.poi.xslf.usermodel.XMLSlideShow;
import org.apache.poi.xslf.usermodel.XSLFSlide;
import org.apache.poi.xslf.usermodel.XSLFSlideLayout;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TextExtractorTest {

    private final TextExtractor extractor = new TextExtractor(400);

    @Test
    void pdfPagesBecomeNumberedSections() throws IOException {
        byte[] pdf = pdf(List.of(
                "Lecture 4: Thevenin equivalent circuits replace a network with one source.",
                "Norton equivalents use a current source in parallel with a resistor."));

        ExtractedDocument document = extractor.extract(pdf, BankFormat.PDF);

        assertThat(document.pageCount()).isEqualTo(2);
        assertThat(document.sections()).extracting(Section::page).containsExactly(1, 2);
        assertThat(document.sections().get(1).text()).contains("Norton equivalents");
        assertThat(document.unreadablePages()).isZero();
    }

    @Test
    void blankPdfPagesCountAsUnreadable() throws IOException {
        byte[] pdf = pdf(List.of("", "", "Only this page has words on it, enough to count as text."));

        ExtractedDocument document = extractor.extract(pdf, BankFormat.PDF);

        assertThat(document.unreadablePages()).isEqualTo(2);
        assertThat(document.mostlyUnreadable()).isTrue();
        assertThat(document.sections()).hasSize(1);
    }

    @Test
    void slidesKeepTheirTitlesAndNumbers() throws IOException {
        byte[] pptx;
        try (XMLSlideShow show = new XMLSlideShow(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            XSLFSlideLayout layout = show.getSlideMasters().getFirst().getLayout(SlideLayout.TITLE_AND_CONTENT);
            XSLFSlide first = show.createSlide(layout);
            first.getPlaceholder(0).setText("Gender inequality in the workplace");
            first.getPlaceholder(1).setText("The wage gap persists across most industries.");
            XSLFSlide second = show.createSlide(layout);
            second.getPlaceholder(0).setText("Policy responses");
            second.getPlaceholder(1).setText("Pay transparency laws require posted salary ranges.");
            show.write(out);
            pptx = out.toByteArray();
        }

        ExtractedDocument document = extractor.extract(pptx, BankFormat.PPTX);

        assertThat(document.pageCount()).isEqualTo(2);
        assertThat(document.sections()).extracting(Section::heading)
                .containsExactly("Gender inequality in the workplace", "Policy responses");
        assertThat(document.sections().get(0).text()).isEqualTo("The wage gap persists across most industries.");
        assertThat(document.sections().get(1).page()).isEqualTo(2);
    }

    @Test
    void wordHeadingsSplitTheDocumentIntoSections() throws IOException {
        byte[] docx;
        try (XWPFDocument doc = new XWPFDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            XWPFParagraph heading = doc.createParagraph();
            heading.setStyle("Heading1");
            heading.createRun().setText("Lab 2 procedure");
            doc.createParagraph().createRun().setText("Measure the voltage across R1.");
            XWPFParagraph second = doc.createParagraph();
            second.setStyle("Heading1");
            second.createRun().setText("Questions");
            doc.createParagraph().createRun().setText("Why does the reading drift?");
            doc.write(out);
            docx = out.toByteArray();
        }

        ExtractedDocument document = extractor.extract(docx, BankFormat.DOCX);

        assertThat(document.sections()).extracting(Section::heading).containsExactly("Lab 2 procedure", "Questions");
        assertThat(document.sections().get(1).text()).isEqualTo("Why does the reading drift?");
    }

    @Test
    void markdownHeadingsBecomeSections() {
        String markdown = "Intro line\n\n# Power\nP = VI\n\n## Energy\nE = Pt\n";

        ExtractedDocument document = extractor.extract(markdown.getBytes(StandardCharsets.UTF_8), BankFormat.MARKDOWN);

        assertThat(document.sections()).extracting(Section::heading).containsExactly(null, "Power", "Energy");
        assertThat(document.sections().get(2).text()).isEqualTo("E = Pt");
    }

    @Test
    void filesOverThePageLimitFailPermanently() throws IOException {
        TextExtractor strict = new TextExtractor(1);
        byte[] pdf = pdf(List.of("one", "two"));

        assertThatThrownBy(() -> strict.extract(pdf, BankFormat.PDF))
                .isInstanceOf(IngestFailure.class)
                .hasMessageContaining("limit is 1")
                .matches(e -> ((IngestFailure) e).permanent());
    }

    @Test
    void damagedFilesFailPermanently() {
        byte[] junk = "%PDF-1.7 this is not really a pdf".getBytes(StandardCharsets.US_ASCII);

        assertThatThrownBy(() -> extractor.extract(junk, BankFormat.PDF))
                .isInstanceOf(IngestFailure.class)
                .matches(e -> ((IngestFailure) e).permanent());
    }

    private static byte[] pdf(List<String> pages) throws IOException {
        try (PDDocument doc = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PDType1Font font = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            for (String text : pages) {
                PDPage page = new PDPage();
                doc.addPage(page);
                if (!text.isEmpty()) {
                    try (PDPageContentStream content = new PDPageContentStream(doc, page)) {
                        content.beginText();
                        content.setFont(font, 11);
                        content.newLineAtOffset(50, 700);
                        content.showText(text);
                        content.endText();
                    }
                }
            }
            doc.save(out);
            return out.toByteArray();
        }
    }
}
