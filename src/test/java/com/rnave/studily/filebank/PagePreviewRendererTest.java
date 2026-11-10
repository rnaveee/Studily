package com.rnave.studily.filebank;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.NotFoundException;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.poi.xslf.usermodel.XMLSlideShow;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PagePreviewRendererTest {

    private final PagePreviewRenderer renderer = new PagePreviewRenderer();

    @Test
    void rendersAPdfPageAsAPngWithTheLongSideAtRenderSize() throws IOException {
        byte[] png = renderer.render(BankFormat.PDF, "lecture.pdf", twoPagePdf(), 1);

        BufferedImage image = ImageIO.read(new ByteArrayInputStream(png));
        assertThat(image).isNotNull();
        assertThat(Math.max(image.getWidth(), image.getHeight())).isEqualTo(PagePreviewRenderer.RENDER_SIDE);
    }

    @Test
    void aPdfPageOutOfRangeIsNotFound() throws IOException {
        assertThatThrownBy(() -> renderer.render(BankFormat.PDF, "lecture.pdf", twoPagePdf(), 3))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void rendersASlideAsAPng() throws IOException {
        byte[] png = renderer.render(BankFormat.PPTX, "deck.pptx", oneSlidePptx(), 1);

        BufferedImage image = ImageIO.read(new ByteArrayInputStream(png));
        assertThat(image).isNotNull();
        assertThat(image.getWidth()).isEqualTo(PagePreviewRenderer.RENDER_SIDE);
    }

    @Test
    void aSlideOutOfRangeIsNotFound() throws IOException {
        assertThatThrownBy(() -> renderer.render(BankFormat.PPTX, "deck.pptx", oneSlidePptx(), 2))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void formatsWithoutPagesAreNotFound() {
        assertThatThrownBy(() -> renderer.render(BankFormat.DOCX, "essay.docx", new byte[] {1}, 1))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void aDamagedPdfIsABadRequest() {
        byte[] broken = "%PDF-1.4 this is not a real document".getBytes(StandardCharsets.US_ASCII);

        assertThatThrownBy(() -> renderer.render(BankFormat.PDF, "broken.pdf", broken, 1))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("could not be previewed");
    }

    private static byte[] twoPagePdf() throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (PDDocument doc = new PDDocument()) {
            doc.addPage(new PDPage());
            doc.addPage(new PDPage());
            doc.save(out);
        }
        return out.toByteArray();
    }

    private static byte[] oneSlidePptx() throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (XMLSlideShow show = new XMLSlideShow()) {
            show.createSlide().createTextBox().setText("Entropy");
            show.write(out);
        }
        return out.toByteArray();
    }
}
