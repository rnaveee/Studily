package com.rnave.studily.conversation;

import com.rnave.studily.config.BadRequestException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AttachmentProcessorTest {

    private final AttachmentProcessor processor = new AttachmentProcessor();

    @Test
    void storesGifBytesUntouched() throws IOException {
        byte[] bytes = gifBytes(200, 100);
        MockMultipartFile file = new MockMultipartFile("file", "party.gif", "image/gif", bytes);

        AttachmentProcessor.Processed processed = processor.process(file);

        assertThat(processed.contentType()).isEqualTo("image/gif");
        assertThat(processed.filename()).isEqualTo("party.gif");
        assertThat(processed.data()).isEqualTo(bytes);
        assertThat(processed.width()).isEqualTo(200);
        assertThat(processed.height()).isEqualTo(100);
    }

    @Test
    void rejectsGifWithWrongMagicBytes() throws IOException {
        MockMultipartFile file = new MockMultipartFile("file", "fake.gif", "image/gif", pngBytes(10, 10));

        assertThatThrownBy(() -> processor.process(file))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("valid GIF");
    }

    @Test
    void rejectsGifThatIsTooLargeToDisplay() throws IOException {
        MockMultipartFile file = new MockMultipartFile("file", "huge.gif", "image/gif", gifBytes(1601, 10));

        assertThatThrownBy(() -> processor.process(file))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("too large");
    }

    @Test
    void stillReencodesOpaqueImagesToJpeg() throws IOException {
        MockMultipartFile file = new MockMultipartFile("file", "photo.png", "image/png", pngBytes(800, 600));

        AttachmentProcessor.Processed processed = processor.process(file);

        assertThat(processed.contentType()).isEqualTo("image/jpeg");
        assertThat(processed.filename()).isEqualTo("photo.jpg");
        assertThat(processed.width()).isEqualTo(800);
        assertThat(processed.height()).isEqualTo(600);
    }

    @Test
    void rejectsImageTypesThatAreNotSupported() {
        MockMultipartFile file = new MockMultipartFile("file", "a.bmp", "image/bmp", new byte[]{1, 2, 3, 4});

        assertThatThrownBy(() -> processor.process(file))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("GIF");
    }

    private byte[] gifBytes(int width, int height) throws IOException {
        return encode(width, height, "gif");
    }

    private byte[] pngBytes(int width, int height) throws IOException {
        return encode(width, height, "png");
    }

    private byte[] encode(int width, int height, String format) throws IOException {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, format, out);
        return out.toByteArray();
    }
}
