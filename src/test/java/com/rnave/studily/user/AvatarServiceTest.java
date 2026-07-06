package com.rnave.studily.user;

import com.rnave.studily.config.CurrentUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AvatarServiceTest {

    private UserRepository userRepository;
    private CurrentUser currentUser;
    private AvatarService avatarService;
    private User user;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        currentUser = mock(CurrentUser.class);
        avatarService = new AvatarService(userRepository, currentUser);

        user = new User();
        user.setId(1L);
        when(currentUser.entity()).thenReturn(user);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void rejectsEmptyFile() {
        MockMultipartFile file = new MockMultipartFile("file", "a.png", "image/png", new byte[0]);
        assertThatThrownBy(() -> avatarService.upload(file)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsDisallowedContentType() {
        MockMultipartFile file = new MockMultipartFile("file", "a.pdf", "application/pdf", new byte[]{1, 2, 3});
        assertThatThrownBy(() -> avatarService.upload(file)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsOversizedFile() {
        byte[] tooBig = new byte[6 * 1024 * 1024];
        MockMultipartFile file = new MockMultipartFile("file", "a.png", "image/png", tooBig);
        assertThatThrownBy(() -> avatarService.upload(file)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsImageWithHugeDeclaredDimensions() throws IOException {
        MockMultipartFile file = new MockMultipartFile("file", "a.png", "image/png", pngBytes(8001, 1));
        assertThatThrownBy(() -> avatarService.upload(file)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsUnreadableImageBytes() {
        MockMultipartFile file = new MockMultipartFile("file", "a.png", "image/png", new byte[]{1, 2, 3, 4});
        assertThatThrownBy(() -> avatarService.upload(file)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void uploadResizesAndStoresImage() throws IOException {
        MockMultipartFile file = new MockMultipartFile("file", "a.png", "image/png", pngBytes(800, 600));

        UserDto dto = avatarService.upload(file);

        assertThat(user.getAvatarImage()).isNotEmpty();
        assertThat(user.getAvatarContentType()).isEqualTo("image/jpeg");
        assertThat(user.getAvatarVersion()).isEqualTo(1);
        assertThat(dto.avatarUrl()).isEqualTo("/api/users/1/avatar?v=1");

        BufferedImage stored = ImageIO.read(new java.io.ByteArrayInputStream(user.getAvatarImage()));
        assertThat(Math.max(stored.getWidth(), stored.getHeight())).isLessThanOrEqualTo(480);
    }

    @Test
    void deleteClearsImageAndBumpsVersion() {
        user.setAvatarImage(new byte[]{1});
        user.setAvatarContentType("image/jpeg");
        user.setAvatarVersion(3);

        UserDto dto = avatarService.delete();

        assertThat(user.getAvatarImage()).isNull();
        assertThat(user.getAvatarContentType()).isNull();
        assertThat(user.getAvatarVersion()).isEqualTo(4);
        assertThat(dto.avatarUrl()).isNull();
    }

    private byte[] pngBytes(int width, int height) throws IOException {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        return out.toByteArray();
    }
}
