package com.rnave.studily.flashcard;

import com.rnave.studily.flashcard.FlashcardDtos.FlashcardDto;
import com.rnave.studily.flashcard.FlashcardDtos.FlashcardSetDto;
import com.rnave.studily.flashcard.FlashcardDtos.FlashcardSetRequest;
import com.rnave.studily.flashcard.FlashcardDtos.ReviewRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/flashcard-sets")
public class FlashcardSetController {

    private final FlashcardSetService flashcardSetService;

    public FlashcardSetController(FlashcardSetService flashcardSetService) {
        this.flashcardSetService = flashcardSetService;
    }

    @GetMapping
    public List<FlashcardSetDto> list(@RequestParam(required = false) Long courseId) {
        return flashcardSetService.list(courseId);
    }

    @GetMapping("/{id}")
    public FlashcardSetDto get(@PathVariable Long id) {
        return flashcardSetService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FlashcardSetDto create(@Valid @RequestBody FlashcardSetRequest req) {
        return flashcardSetService.create(req);
    }

    @PutMapping("/{id}")
    public FlashcardSetDto update(@PathVariable Long id, @Valid @RequestBody FlashcardSetRequest req) {
        return flashcardSetService.update(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        flashcardSetService.delete(id);
    }

    @PostMapping("/{setId}/cards/{cardId}/review")
    public FlashcardDto review(@PathVariable Long setId, @PathVariable Long cardId,
                               @Valid @RequestBody ReviewRequest req) {
        return flashcardSetService.review(setId, cardId, req.grade());
    }
}
