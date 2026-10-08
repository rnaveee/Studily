package com.rnave.studily.flashcard;

import com.rnave.studily.flashcard.FlashcardRunDtos.CompleteRunRequest;
import com.rnave.studily.flashcard.FlashcardRunDtos.FlashcardRunResult;
import com.rnave.studily.flashcard.FlashcardRunDtos.FlashcardRunStart;
import com.rnave.studily.flashcard.FlashcardRunDtos.StartRunRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class FlashcardRunController {

    private final FlashcardRunService flashcardRunService;

    public FlashcardRunController(FlashcardRunService flashcardRunService) {
        this.flashcardRunService = flashcardRunService;
    }

    @PostMapping("/api/flashcard-sets/{id}/runs")
    public FlashcardRunStart start(@PathVariable Long id, @Valid @RequestBody StartRunRequest req) {
        return flashcardRunService.start(id, req.mode());
    }

    @PostMapping("/api/flashcard-runs/{runId}/complete")
    public FlashcardRunResult complete(@PathVariable Long runId, @Valid @RequestBody CompleteRunRequest req) {
        return flashcardRunService.complete(runId, req.results());
    }
}
