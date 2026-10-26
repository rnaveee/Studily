package com.rnave.studily.flashcard;

import com.rnave.studily.flashcard.FlashcardDtos.FlashcardSetDto;
import com.rnave.studily.flashcard.FlashcardDtos.FolderDto;
import com.rnave.studily.flashcard.FlashcardDtos.FolderRequest;
import com.rnave.studily.flashcard.FlashcardDtos.SetFolderRequest;
import com.rnave.studily.flashcard.FlashcardDtos.StudyGroupDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class FlashcardFolderController {

    private final FlashcardFolderService folderService;
    private final FlashcardStudyService studyService;

    public FlashcardFolderController(FlashcardFolderService folderService, FlashcardStudyService studyService) {
        this.folderService = folderService;
        this.studyService = studyService;
    }

    @GetMapping("/api/flashcard-folders")
    public List<FolderDto> list() {
        return folderService.list();
    }

    @PostMapping("/api/flashcard-folders")
    @ResponseStatus(HttpStatus.CREATED)
    public FolderDto create(@Valid @RequestBody FolderRequest req) {
        return folderService.create(req);
    }

    @PutMapping("/api/flashcard-folders/{id}")
    public FolderDto update(@PathVariable Long id, @Valid @RequestBody FolderRequest req) {
        return folderService.update(id, req);
    }

    @DeleteMapping("/api/flashcard-folders/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        folderService.delete(id);
    }

    @PutMapping("/api/flashcard-sets/{id}/folder")
    public FlashcardSetDto moveSet(@PathVariable Long id, @RequestBody SetFolderRequest req) {
        return folderService.moveSet(id, req.folderId());
    }

    @GetMapping("/api/flashcard-study")
    public StudyGroupDto study(@RequestParam(required = false) Long folderId,
                               @RequestParam(required = false) Long courseId) {
        return studyService.group(folderId, courseId);
    }
}
