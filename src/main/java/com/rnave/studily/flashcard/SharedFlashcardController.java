package com.rnave.studily.flashcard;

import com.rnave.studily.flashcard.FlashcardDtos.FlashcardSetSummaryDto;
import com.rnave.studily.flashcard.FlashcardDtos.SharedFlashcardSetDto;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;

@RestController
public class SharedFlashcardController {

    private final FlashcardSetService flashcardSetService;
    private final SetPreviewImages previewImages;

    public SharedFlashcardController(FlashcardSetService flashcardSetService, SetPreviewImages previewImages) {
        this.flashcardSetService = flashcardSetService;
        this.previewImages = previewImages;
    }

    @GetMapping("/api/public/flashcard-sets/{id}")
    public SharedFlashcardSetDto shared(@PathVariable Long id) {
        return flashcardSetService.shared(id);
    }

    @GetMapping(value = "/api/public/flashcard-sets/{id}/preview.png", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> preview(@PathVariable Long id) {
        return flashcardSetService.publicPreview(id)
                .map(preview -> ResponseEntity.ok()
                        .cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePublic())
                        .contentType(MediaType.IMAGE_PNG)
                        .body(previewImages.png(preview)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/api/users/{userId}/flashcard-sets")
    public List<FlashcardSetSummaryDto> visibleSets(@PathVariable Long userId) {
        return flashcardSetService.visibleSetsOf(userId);
    }
}
