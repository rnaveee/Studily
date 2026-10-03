package com.rnave.studily.flashcard;

import com.rnave.studily.flashcard.FlashcardDtos.FlashcardSetSummaryDto;
import com.rnave.studily.flashcard.FlashcardDtos.SharedFlashcardSetDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class SharedFlashcardController {

    private final FlashcardSetService flashcardSetService;

    public SharedFlashcardController(FlashcardSetService flashcardSetService) {
        this.flashcardSetService = flashcardSetService;
    }

    @GetMapping("/api/public/flashcard-sets/{id}")
    public SharedFlashcardSetDto shared(@PathVariable Long id) {
        return flashcardSetService.shared(id);
    }

    @GetMapping("/api/users/{userId}/flashcard-sets")
    public List<FlashcardSetSummaryDto> publicSets(@PathVariable Long userId) {
        return flashcardSetService.publicSetsOf(userId);
    }
}
