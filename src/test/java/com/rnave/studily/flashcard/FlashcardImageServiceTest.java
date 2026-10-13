package com.rnave.studily.flashcard;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.conversation.AttachmentProcessor;
import com.rnave.studily.flashcard.FlashcardImageService.FlashcardImageDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FlashcardImageServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-13T12:00:00Z");

    private FlashcardImageRepository imageRepository;
    private FlashcardImageDataRepository dataRepository;
    private FlashcardImageService service;

    @BeforeEach
    void setUp() {
        imageRepository = mock(FlashcardImageRepository.class);
        dataRepository = mock(FlashcardImageDataRepository.class);
        CurrentUser currentUser = mock(CurrentUser.class);
        when(currentUser.id()).thenReturn(1L);
        when(imageRepository.save(any(FlashcardImage.class))).thenAnswer(inv -> {
            FlashcardImage i = inv.getArgument(0);
            i.setId(9L);
            return i;
        });
        service = new FlashcardImageService(imageRepository, dataRepository, new AttachmentProcessor(), currentUser,
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private static byte[] png(int width, int height) throws IOException {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        return out.toByteArray();
    }

    @Test
    void upload_storesTheImageUnderARandomKey() throws IOException {
        MockMultipartFile file = new MockMultipartFile("file", "cell.png", "image/png", png(1800, 900));

        FlashcardImageDto dto = service.upload(file);

        assertThat(FlashcardImageService.isKey(dto.key())).isTrue();
        assertThat(dto.width()).isEqualTo(1200);
        assertThat(dto.height()).isEqualTo(600);
        verify(imageRepository).save(argThat(i ->
                i.getOwnerId().equals(1L) && i.getContentType().equals("image/jpeg")
                        && i.getCreatedAt().equals(NOW) && i.getSizeBytes() > 0));
        verify(dataRepository).save(argThat(d -> d.getImageId().equals(9L)));
    }

    @Test
    void upload_keysAreUnique() throws IOException {
        String a = service.upload(new MockMultipartFile("file", "a.png", "image/png", png(10, 10))).key();
        String b = service.upload(new MockMultipartFile("file", "b.png", "image/png", png(10, 10))).key();

        assertThat(a).isNotEqualTo(b);
    }

    @Test
    void upload_overTheStorageCap_throwsConflict() throws IOException {
        when(imageRepository.sumSizeBytesByOwnerId(1L)).thenReturn(FlashcardImageService.MAX_BYTES_PER_USER);

        assertThatThrownBy(() -> service.upload(new MockMultipartFile("file", "a.png", "image/png", png(10, 10))))
                .isInstanceOf(ConflictException.class);
        verify(dataRepository, never()).save(any());
    }

    @Test
    void upload_document_throwsBadRequest() {
        MockMultipartFile file = new MockMultipartFile("file", "a.txt", "text/plain", "hi".getBytes());

        assertThatThrownBy(() -> service.upload(file)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void content_malformedKey_isNotFoundWithoutTouchingTheDatabase() {
        assertThatThrownBy(() -> service.content("../etc/passwd")).isInstanceOf(NotFoundException.class);
        verify(imageRepository, never()).findByImageKey(any());
    }

    @Test
    void content_returnsTheStoredBytes() {
        FlashcardImage image = new FlashcardImage();
        image.setId(9L);
        image.setContentType("image/png");
        FlashcardImageData data = new FlashcardImageData();
        data.setImageId(9L);
        data.setData(new byte[] {1, 2, 3});
        when(imageRepository.findByImageKey("abcdefghijklmnopqrstuv")).thenReturn(Optional.of(image));
        when(dataRepository.findById(9L)).thenReturn(Optional.of(data));

        FlashcardImageService.ImageContent content = service.content("abcdefghijklmnopqrstuv");

        assertThat(content.contentType()).isEqualTo("image/png");
        assertThat(content.data()).containsExactly(1, 2, 3);
    }

    @Test
    void sweepOrphans_usesATwentyFourHourGrace() {
        service.sweepOrphans();

        verify(imageRepository).deleteUnreferencedBefore(NOW.minusSeconds(24 * 3600));
    }
}
