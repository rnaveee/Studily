package com.rnave.studily.flashcard;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.conversation.AttachmentProcessor;
import com.rnave.studily.conversation.AttachmentProcessor.Processed;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.util.Base64;
import java.util.regex.Pattern;

@Service
public class FlashcardImageService {

    private static final Logger log = LoggerFactory.getLogger(FlashcardImageService.class);
    static final int MAX_DIMENSION = 1200;
    static final int MAX_STORED_BYTES = 4 * 1024 * 1024;
    static final long MAX_BYTES_PER_USER = 200L * 1024 * 1024;
    static final Duration ORPHAN_GRACE = Duration.ofHours(24);
    static final Pattern KEY_PATTERN = Pattern.compile("[A-Za-z0-9_-]{22}");

    public record FlashcardImageDto(String key, int width, int height) {
    }

    public record ImageContent(String contentType, byte[] data) {
    }

    private final FlashcardImageRepository imageRepository;
    private final FlashcardImageDataRepository dataRepository;
    private final AttachmentProcessor processor;
    private final CurrentUser currentUser;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public FlashcardImageService(FlashcardImageRepository imageRepository, FlashcardImageDataRepository dataRepository,
                                 AttachmentProcessor processor, CurrentUser currentUser, Clock clock) {
        this.imageRepository = imageRepository;
        this.dataRepository = dataRepository;
        this.processor = processor;
        this.currentUser = currentUser;
        this.clock = clock;
    }

    @Transactional
    public FlashcardImageDto upload(MultipartFile file) {
        return save(currentUser.id(), processor.processImageOnly(file, MAX_DIMENSION));
    }

    @Transactional
    public FlashcardImageDto storeGenerated(Long userId, String contentType, byte[] bytes) {
        return save(userId, processor.processBytes(contentType, bytes, MAX_DIMENSION));
    }

    private FlashcardImageDto save(Long userId, Processed processed) {
        byte[] data = processed.data();
        if (data.length > MAX_STORED_BYTES) {
            throw new BadRequestException("That image is too large. Try one under 4MB.");
        }
        if (imageRepository.sumSizeBytesByOwnerId(userId) + data.length > MAX_BYTES_PER_USER) {
            throw new ConflictException("You've used all of your flashcard image storage");
        }
        FlashcardImage image = new FlashcardImage();
        image.setImageKey(newKey());
        image.setOwnerId(userId);
        image.setContentType(processed.contentType());
        image.setWidth(processed.width());
        image.setHeight(processed.height());
        image.setSizeBytes(data.length);
        image.setCreatedAt(clock.instant());
        imageRepository.save(image);
        FlashcardImageData blob = new FlashcardImageData();
        blob.setImageId(image.getId());
        blob.setData(data);
        dataRepository.save(blob);
        return new FlashcardImageDto(image.getImageKey(), image.getWidth(), image.getHeight());
    }

    @Transactional(readOnly = true)
    public ImageContent content(String key) {
        if (!isKey(key)) {
            throw new NotFoundException("Image not found");
        }
        FlashcardImage image = imageRepository.findByImageKey(key)
                .orElseThrow(() -> new NotFoundException("Image not found"));
        FlashcardImageData blob = dataRepository.findById(image.getId())
                .orElseThrow(() -> new NotFoundException("Image not found"));
        return new ImageContent(image.getContentType(), blob.getData());
    }

    @Scheduled(fixedDelay = 60 * 60_000, initialDelay = 5 * 60_000)
    @Transactional
    public void sweepOrphans() {
        int removed = imageRepository.deleteUnreferencedBefore(clock.instant().minus(ORPHAN_GRACE));
        if (removed > 0) {
            log.info("Removed {} unused flashcard images", removed);
        }
    }

    static boolean isKey(String key) {
        return key != null && KEY_PATTERN.matcher(key).matches();
    }

    private String newKey() {
        byte[] bytes = new byte[16];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
