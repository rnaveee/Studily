package com.rnave.studily.flashcard;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.SlidingWindowRateLimiter;
import com.rnave.studily.config.TooManyRequestsException;
import com.rnave.studily.flashcard.FlashcardImageService.FlashcardImageDto;
import com.rnave.studily.flashcard.FlashcardImageService.ImageContent;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;

@RestController
public class FlashcardImageController {

    private static final long UPLOAD_WINDOW_MS = 10 * 60_000;

    private final SlidingWindowRateLimiter uploadLimiter = new SlidingWindowRateLimiter(60, UPLOAD_WINDOW_MS);

    private final FlashcardImageService imageService;
    private final CurrentUser currentUser;

    public FlashcardImageController(FlashcardImageService imageService, CurrentUser currentUser) {
        this.imageService = imageService;
        this.currentUser = currentUser;
    }

    @PostMapping("/api/flashcard-images")
    @ResponseStatus(HttpStatus.CREATED)
    public FlashcardImageDto upload(@RequestParam("file") MultipartFile file) {
        if (!uploadLimiter.tryConsume("user:" + currentUser.id())) {
            throw new TooManyRequestsException("You're uploading too many images. Please wait a few minutes.");
        }
        return imageService.upload(file);
    }

    @GetMapping("/api/public/flashcard-images/{key}")
    public ResponseEntity<byte[]> serve(@PathVariable String key) {
        ImageContent content = imageService.content(key);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(content.contentType()))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                .body(content.data());
    }

    @Scheduled(fixedRate = 10 * UPLOAD_WINDOW_MS)
    void evictStaleUploadWindows() {
        uploadLimiter.evictStale();
    }
}
