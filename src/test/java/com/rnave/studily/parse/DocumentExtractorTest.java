package com.rnave.studily.parse;

import com.rnave.studily.config.BadRequestException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DocumentExtractorTest {

    private final DocumentExtractor extractor = new DocumentExtractor();

    @Test
    void extract_rejectsZipArchivesEvenWhenNamedAsPdf() {
        byte[] zip = {0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00};
        MockMultipartFile file = new MockMultipartFile(
                "files", "outline.pdf", "application/pdf", zip);

        assertThatThrownBy(() -> extractor.extract(List.of(file), null))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Archives are not supported");
    }

    @Test
    void extract_rejectsUnknownTypesRegardlessOfDeclaredContentType() {
        MockMultipartFile file = new MockMultipartFile(
                "files", "outline.png", "image/png", "not an image at all".getBytes(StandardCharsets.UTF_8));

        assertThatThrownBy(() -> extractor.extract(List.of(file), null))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Unsupported file type");
    }

    @Test
    void extract_rejectsMoreThanFiveFiles() throws Exception {
        MockMultipartFile image = pngFile(10, 10);
        List<org.springframework.web.multipart.MultipartFile> files =
                List.of(image, image, image, image, image, image);

        assertThatThrownBy(() -> extractor.extract(files, null))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("at most 5 files");
    }

    @Test
    void extract_rejectsTotalOverEightMegabytes() {
        byte[] big = new byte[5 * 1024 * 1024];
        big[0] = 0x25;
        big[1] = 0x50;
        big[2] = 0x44;
        big[3] = 0x46;
        big[4] = 0x2D;
        MockMultipartFile file = new MockMultipartFile("files", "a.pdf", "application/pdf", big);

        assertThatThrownBy(() -> extractor.extract(List.of(file, file), null))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("under 8 MB");
    }

    @Test
    void extract_readsPngAndReportsImagesOnly() throws Exception {
        ExtractedInput input = extractor.extract(List.of(pngFile(200, 100)), null);

        assertThat(input.images()).hasSize(1);
        assertThat(input.images().get(0).mediaType()).isEqualTo("image/png");
        assertThat(input.imagesOnly()).isTrue();
        assertThat(input.isEmpty()).isFalse();
    }

    @Test
    void extract_capsTotalImagesAcrossEveryFile() throws Exception {
        MockMultipartFile image = pngFile(50, 50);
        List<org.springframework.web.multipart.MultipartFile> files =
                List.of(image, image, image, image, image);

        ExtractedInput input = extractor.extract(files, null);

        assertThat(input.images().size())
                .isLessThanOrEqualTo(DocumentExtractor.MAX_TOTAL_IMAGES);
    }

    @Test
    void extract_truncatesPastedTextToTheCap() {
        String huge = "x".repeat(DocumentExtractor.MAX_TEXT_CHARS + 5_000);

        ExtractedInput input = extractor.extract(List.of(), huge);

        assertThat(input.text().length()).isLessThanOrEqualTo(DocumentExtractor.MAX_TEXT_CHARS);
        assertThat(input.imagesOnly()).isFalse();
    }

    @Test
    void extract_isEmptyWhenNothingSupplied() {
        assertThat(extractor.extract(List.of(), "   ").isEmpty()).isTrue();
    }

    @Test
    void sniff_recognisesEachAllowedMagicNumber() {
        assertThat(DocumentExtractor.sniff("%PDF-1.7".getBytes(StandardCharsets.UTF_8)))
                .isEqualTo(DocumentExtractor.Kind.PDF);
        assertThat(DocumentExtractor.sniff(new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D}))
                .isEqualTo(DocumentExtractor.Kind.IMAGE);
        assertThat(DocumentExtractor.sniff(new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0}))
                .isEqualTo(DocumentExtractor.Kind.IMAGE);
        assertThat(DocumentExtractor.sniff("RIFF____WEBPVP8 ".getBytes(StandardCharsets.UTF_8)))
                .isEqualTo(DocumentExtractor.Kind.IMAGE);
        assertThat(DocumentExtractor.sniff("RIFF____WAVEfmt ".getBytes(StandardCharsets.UTF_8)))
                .isEqualTo(DocumentExtractor.Kind.UNKNOWN);
        assertThat(DocumentExtractor.sniff(new byte[]{0x00}))
                .isEqualTo(DocumentExtractor.Kind.UNKNOWN);
    }

    private MockMultipartFile pngFile(int width, int height) throws Exception {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        return new MockMultipartFile("files", "shot.png", "image/png", out.toByteArray());
    }
}
