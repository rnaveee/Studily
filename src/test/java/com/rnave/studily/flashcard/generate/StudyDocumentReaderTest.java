package com.rnave.studily.flashcard.generate;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.parse.PageSelection;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.encryption.AccessPermission;
import org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.poi.sl.usermodel.PictureData;
import org.apache.poi.xslf.usermodel.XMLSlideShow;
import org.apache.poi.xslf.usermodel.XSLFPictureData;
import org.apache.poi.xslf.usermodel.XSLFSlide;
import org.apache.poi.xslf.usermodel.XSLFTextBox;
import org.apache.poi.xwpf.usermodel.Document;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.util.Units;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.Rectangle;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class StudyDocumentReaderTest {

    private final StudyDocumentReader reader = new StudyDocumentReader();

    @Test
    void pdf_keepsTextPerPageRendersVisualPagesAndDropsRepeatedLogos() throws IOException {
        byte[] pdf = pdf(4, true);

        StudyDocument doc = reader.read("lecture.pdf", pdf);

        assertThat(doc.kind()).isEqualTo(FileKind.PDF);
        assertThat(doc.unit()).isEqualTo("Page");
        assertThat(doc.pages()).hasSize(4);
        assertThat(doc.pages().get(0).text()).contains("Page one about mitochondria");
        assertThat(doc.figures()).hasSize(1);
        assertThat(doc.figures().get(0).page()).isEqualTo(2);
        assertThat(doc.pages().get(1).render()).isNotNull();
        StudyDocument.Picture render = doc.pages().get(1).render();
        assertThat(Math.max(render.width(), render.height())).isBetween(StudyDocumentReader.RENDER_SIDE - 2,
                StudyDocumentReader.RENDER_SIDE);
        assertThat(doc.pages().get(0).render()).isNotNull();
    }

    @Test
    void pdf_readsOnlyThePickedPagesAndKeepsTheirNumbers() throws IOException {
        byte[] pdf = pdf(StudyDocumentReader.MAX_PAGES + 20, false);

        StudyDocument doc = reader.read("long.pdf", pdf, PageSelection.parse("8-11, 95-end"));

        assertThat(doc.pages()).extracting(StudyDocument.Page::number).containsExactly(8, 9, 10, 11, 95, 96, 97, 98, 99, 100);
        assertThat(doc.pages().get(0).text()).contains("Page 8 about mitochondria");
        assertThat(doc.pages().get(9).text()).contains("Page 100 about mitochondria");
    }

    @Test
    void pdf_rangePastTheLastPageIsRejected() throws IOException {
        byte[] pdf = pdf(4, false);

        assertThatThrownBy(() -> reader.read("short.pdf", pdf, PageSelection.parse("9-end")))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("only has 4 pages");
    }

    @Test
    void pdf_withTooManyPagesIsRejected() throws IOException {
        byte[] pdf = pdf(StudyDocumentReader.MAX_PAGES + 1, false);

        assertThatThrownBy(() -> reader.read("long.pdf", pdf))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("81 pages");
    }

    @Test
    void pdf_withAPasswordIsRejected() throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (PDDocument doc = new PDDocument()) {
            doc.addPage(new PDPage());
            StandardProtectionPolicy policy = new StandardProtectionPolicy("owner", "user", new AccessPermission());
            policy.setEncryptionKeyLength(128);
            doc.protect(policy);
            doc.save(out);
        }

        assertThatThrownBy(() -> reader.read("locked.pdf", out.toByteArray()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("password-protected");
    }

    @Test
    void pptx_readsSlideTextNotesAndPictures() throws IOException {
        byte[] pptx;
        try (XMLSlideShow show = new XMLSlideShow(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            XSLFSlide first = show.createSlide();
            XSLFTextBox box = first.createTextBox();
            box.setAnchor(new Rectangle(40, 40, 500, 80));
            box.setText("Third angle projection puts the paper between you and the object.");
            show.getNotesSlide(first).createTextBox().setText("Used in North America.");
            XSLFSlide second = show.createSlide();
            XSLFPictureData data = show.addPicture(png(320, 240, Color.BLUE), PictureData.PictureType.PNG);
            second.createPicture(data).setAnchor(new Rectangle(40, 40, 320, 240));
            show.write(out);
            pptx = out.toByteArray();
        }

        StudyDocument doc = reader.read("slides.pptx", pptx);

        assertThat(doc.kind()).isEqualTo(FileKind.PPTX);
        assertThat(doc.unit()).isEqualTo("Slide");
        assertThat(doc.pages()).hasSize(2);
        assertThat(doc.pages().get(0).text()).contains("Third angle projection").contains("Used in North America");
        assertThat(doc.figures()).hasSize(1);
        assertThat(doc.figures().get(0).page()).isEqualTo(2);
        assertThat(doc.pages().get(1).render()).isNotNull();
    }

    @Test
    void docx_readsParagraphsTablesAndPictures() throws Exception {
        byte[] docx;
        try (XWPFDocument doc = new XWPFDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            doc.createParagraph().createRun().setText("Ohm's law: V = IR");
            var table = doc.createTable(1, 2);
            table.getRow(0).getCell(0).setText("Resistor");
            table.getRow(0).getCell(1).setText("Limits current");
            XWPFRun run = doc.createParagraph().createRun();
            run.addPicture(new ByteArrayInputStream(png(300, 200, Color.RED)), Document.PICTURE_TYPE_PNG, "fig.png",
                    Units.toEMU(300), Units.toEMU(200));
            doc.write(out);
            docx = out.toByteArray();
        }

        StudyDocument doc = reader.read("notes.docx", docx);

        assertThat(doc.kind()).isEqualTo(FileKind.DOCX);
        assertThat(doc.pages().get(0).text()).contains("V = IR").contains("Resistor | Limits current");
        assertThat(doc.figures()).hasSize(1);
    }

    @Test
    void text_isSplitIntoSections() {
        String text = ("Line about circuits.\n").repeat(400);

        StudyDocument doc = reader.read("notes.txt", text.getBytes(StandardCharsets.UTF_8));

        assertThat(doc.kind()).isEqualTo(FileKind.TEXT);
        assertThat(doc.pages().size()).isGreaterThan(1);
        assertThat(doc.figures()).isEmpty();
    }

    @Test
    void text_thatIsTooLongIsRejectedRatherThanCut() {
        byte[] text = "a".repeat(StudyDocumentReader.MAX_TEXT_CHARS + 1).getBytes(StandardCharsets.UTF_8);

        assertThatThrownBy(() -> reader.read("huge.txt", text))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("too long");
    }

    @Test
    void photo_becomesOnePageWithItsOwnFigure() throws IOException {
        StudyDocument doc = reader.read("board.png", png(800, 600, Color.GREEN));

        assertThat(doc.pages()).hasSize(1);
        assertThat(doc.pages().get(0).render()).isNotNull();
        assertThat(doc.figures()).hasSize(1);
    }

    @Test
    void visualPages_prefersPagesWithLittleText() {
        List<String> texts = List.of("x".repeat(500), "", "y".repeat(50), "z".repeat(400));

        assertThat(StudyDocumentReader.visualPages(texts, List.of())).containsExactly(2, 3);
    }

    private static byte[] pdf(int pages, boolean withImages) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (PDDocument doc = new PDDocument()) {
            PDImageXObject logo = withImages ? LosslessFactory.createFromImage(doc, image(200, 200, Color.GRAY)) : null;
            PDImageXObject diagram = withImages ? LosslessFactory.createFromImage(doc, image(400, 300, Color.BLUE)) : null;
            PDType1Font font = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            String[] words = {"one", "two", "three", "four"};
            for (int i = 0; i < pages; i++) {
                PDPage page = new PDPage();
                doc.addPage(page);
                try (PDPageContentStream content = new PDPageContentStream(doc, page)) {
                    content.beginText();
                    content.setFont(font, 12);
                    content.newLineAtOffset(50, 700);
                    content.showText("Page " + (i < words.length ? words[i] : String.valueOf(i + 1))
                            + " about mitochondria");
                    content.endText();
                    if (withImages && i < 3) {
                        content.drawImage(logo, 500, 700, 50, 50);
                    }
                    if (withImages && i == 1) {
                        content.drawImage(diagram, 50, 300, 400, 300);
                    }
                }
            }
            doc.save(out);
        }
        return out.toByteArray();
    }

    private static BufferedImage image(int width, int height, Color color) {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        g.setColor(color);
        g.fillRect(0, 0, width, height);
        g.setColor(Color.WHITE);
        g.drawLine(0, 0, width, height);
        g.dispose();
        return image;
    }

    private static byte[] png(int width, int height, Color color) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image(width, height, color), "png", out);
        return out.toByteArray();
    }
}
