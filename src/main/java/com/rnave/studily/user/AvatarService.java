package com.rnave.studily.user;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Set;

@Service
public class AvatarService {

    private static final int MAX_DIMENSION = 480;
    private static final long MAX_UPLOAD_BYTES = 5L * 1024 * 1024;
    private static final Set<String> ALLOWED_TYPES = Set.of("image/jpeg", "image/png", "image/webp");

    private final UserRepository userRepository;
    private final CurrentUser currentUser;

    public AvatarService(UserRepository userRepository, CurrentUser currentUser) {
        this.userRepository = userRepository;
        this.currentUser = currentUser;
    }

    @Transactional
    public UserDto upload(MultipartFile file) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }
        if (file.getSize() > MAX_UPLOAD_BYTES) {
            throw new IllegalArgumentException("Image must be smaller than 5MB");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_TYPES.contains(contentType)) {
            throw new IllegalArgumentException("Only JPEG, PNG, or WEBP images are supported");
        }

        BufferedImage original;
        try {
            original = ImageIO.read(file.getInputStream());
        } catch (IOException e) {
            throw new IllegalArgumentException("Could not read image");
        }
        if (original == null) {
            throw new IllegalArgumentException("Could not read image");
        }

        User user = currentUser.entity();
        user.setAvatarImage(resizeToJpeg(original));
        user.setAvatarContentType("image/jpeg");
        user.setAvatarVersion(user.getAvatarVersion() + 1);
        return UserDto.from(userRepository.save(user));
    }

    @Transactional
    public UserDto delete() {
        User user = currentUser.entity();
        user.setAvatarImage(null);
        user.setAvatarContentType(null);
        user.setAvatarVersion(user.getAvatarVersion() + 1);
        return UserDto.from(userRepository.save(user));
    }

    @Transactional(readOnly = true)
    public User requireForServing(Long userId) {
        return userRepository.findById(userId)
                .filter(u -> u.getAvatarImage() != null)
                .orElseThrow(() -> new NotFoundException("No avatar"));
    }

    private byte[] resizeToJpeg(BufferedImage original) {
        int width = original.getWidth();
        int height = original.getHeight();
        double scale = Math.min(1.0, (double) MAX_DIMENSION / Math.max(width, height));
        int targetWidth = Math.max(1, (int) Math.round(width * scale));
        int targetHeight = Math.max(1, (int) Math.round(height * scale));

        BufferedImage resized = new BufferedImage(targetWidth, targetHeight, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = resized.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, targetWidth, targetHeight);
        g.drawImage(original, 0, 0, targetWidth, targetHeight, null);
        g.dispose();

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            ImageIO.write(resized, "jpg", out);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to encode image", e);
        }
        return out.toByteArray();
    }
}
