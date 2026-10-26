package com.rnave.studily.flashcard;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseService;
import com.rnave.studily.flashcard.FlashcardDtos.StudyCardDto;
import com.rnave.studily.flashcard.FlashcardDtos.StudyGroupDto;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
public class FlashcardStudyService {

    static final int MAX_CARDS = 500;

    private final FlashcardSetService setService;
    private final FlashcardFolderService folderService;
    private final CourseService courseService;

    public FlashcardStudyService(FlashcardSetService setService, FlashcardFolderService folderService,
                                 @Lazy CourseService courseService) {
        this.setService = setService;
        this.folderService = folderService;
        this.courseService = courseService;
    }

    @Transactional(readOnly = true)
    public StudyGroupDto group(Long folderId, Long courseId) {
        if ((folderId == null) == (courseId == null)) {
            throw new BadRequestException("Pass either folderId or courseId");
        }
        String kind;
        Long id;
        String title;
        if (folderId != null) {
            kind = "folder";
            id = folderId;
            title = folderService.requireOwned(folderId).getName();
        } else {
            Course course = courseService.requireOwned(courseId);
            kind = "course";
            id = courseId;
            title = course.getCode() != null && !course.getCode().isBlank() ? course.getCode() : course.getName();
        }
        List<FlashcardSet> sets = setService.ownedGroupSets(folderId, courseId);
        List<StudyCardDto> cards = new ArrayList<>();
        boolean truncated = false;
        for (FlashcardSet set : sets) {
            for (Flashcard card : set.completeCards()) {
                if (cards.size() >= MAX_CARDS) {
                    truncated = true;
                    break;
                }
                cards.add(StudyCardDto.from(card));
            }
        }
        return new StudyGroupDto(kind, id, title, sets.size(), truncated, cards);
    }
}
