package com.rnave.studily.bot;

import com.rnave.studily.bot.BotDtos.ImageInput;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.filebank.FileStorage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.util.Base64;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ChatImagesTest {

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10};
    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0, 1};

    private FileStorage storage;
    private JdbcTemplate jdbc;
    private ChatImages images;

    @BeforeEach
    void setUp() {
        storage = mock(FileStorage.class);
        jdbc = mock(JdbcTemplate.class);
        when(storage.configured()).thenReturn(true);
        images = new ChatImages(storage, jdbc, 1024);
    }

    private static ImageInput encoded(byte[] bytes) {
        return new ImageInput(Base64.getEncoder().encodeToString(bytes));
    }

    @Test
    void decodesPngAndJpegBySniffingTheBytes() {
        List<PracticeTutor.Photo> photos = images.decode(List.of(encoded(PNG), encoded(JPEG)));

        assertThat(photos).extracting(PracticeTutor.Photo::mimeType).containsExactly("image/png", "image/jpeg");
    }

    @Test
    void noImagesIsFine() {
        assertThat(images.decode(null)).isEmpty();
        assertThat(images.decode(List.of())).isEmpty();
    }

    @Test
    void rejectsMoreThanFourImages() {
        assertThatThrownBy(() -> images.decode(Collections.nCopies(5, encoded(PNG))))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("up to 4");
    }

    @Test
    void rejectsBrokenBase64EmptyAndUnknownTypes() {
        assertThatThrownBy(() -> images.decode(List.of(new ImageInput("not base64!!"))))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> images.decode(List.of(new ImageInput(""))))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> images.decode(List.of(encoded("%PDF-1.7".getBytes()))))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("JPEG, PNG or WebP");
    }

    @Test
    void rejectsImagesOverTheSizeLimit() {
        byte[] big = new byte[2048];
        System.arraycopy(PNG, 0, big, 0, PNG.length);

        assertThatThrownBy(() -> images.decode(List.of(encoded(big))))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("too big");
    }

    @Test
    void rejectsImagesWhenStorageIsOff() {
        when(storage.configured()).thenReturn(false);

        assertThatThrownBy(() -> images.decode(List.of(encoded(PNG)))).isInstanceOf(BadRequestException.class);
    }

    @Test
    void savesTheRowBeforeTheObjectUnderAPerUserKey() {
        String id = UUID.randomUUID().toString();

        images.save(7L, 40L, List.of(id), List.of(new PracticeTutor.Photo("image/png", PNG)));

        var order = inOrder(jdbc, storage);
        order.verify(jdbc).update(anyString(), eq(UUID.fromString(id)), eq(40L), eq(7L),
                eq("bot-images/7/" + id), eq("image/png"), eq(PNG.length), eq(0));
        order.verify(storage).put("bot-images/7/" + id, PNG, "image/png");
    }

    @Test
    @SuppressWarnings("unchecked")
    void anotherUsersImageIsNotFound() {
        when(jdbc.query(anyString(), any(RowMapper.class), any(), any(), any(), any())).thenReturn(List.of());

        assertThatThrownBy(() -> images.find(7L, 3L, UUID.randomUUID())).isInstanceOf(NotFoundException.class);
        verifyNoInteractions(storage);
    }

    @Test
    @SuppressWarnings("unchecked")
    void findsTheOwnersImage() {
        when(jdbc.query(anyString(), any(RowMapper.class), any(), any(), any(), any()))
                .thenReturn(List.<String[]>of(new String[]{"bot-images/7/x", "image/png"}));
        when(storage.get("bot-images/7/x")).thenReturn(PNG);

        ChatImages.Stored stored = images.find(7L, 3L, UUID.randomUUID());

        assertThat(stored.mimeType()).isEqualTo("image/png");
        assertThat(stored.bytes()).isEqualTo(PNG);
        verify(storage).get("bot-images/7/x");
    }
}
