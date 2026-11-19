package com.rnave.studily.flashcard;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.CurrentUser;
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
    private final CurrentUser currentUser;

    public FlashcardStudyService(FlashcardSetService setService, FlashcardFolderService folderService,
                                 @Lazy CourseService courseService, CurrentUser currentUser) {
        this.currentUser = currentUser;
        this.setService = setService;
        this.folderService = folderService;
        this.courseService = courseService;
    }

    @Transactional(readOnly = true)
    public StudyGroupDto group(Long folderId, Long courseId, List<Long> setIds) {
        int scopes = (folderId != null ? 1 : 0) + (courseId != null ? 1 : 0) + (setIds != null ? 1 : 0);
        if (scopes != 1) {
            throw new BadRequestException("Pass exactly one of folderId, courseId or setIds");
        }
        String kind;
        Long id;
        String title;
        List<FlashcardSet> sets;
        if (setIds != null) {
            sets = setService.requireViewableAll(setIds, currentUser.id());
            kind = "selection";
            id = null;
            title = sets.size() + (sets.size() == 1 ? " set" : " sets");
        } else if (folderId != null) {
            kind = "folder";
            id = folderId;
            title = folderService.requireOwned(folderId).getName();
            sets = setService.ownedGroupSets(folderId, courseId);
        } else {
            Course course = courseService.requireOwned(courseId);
            kind = "course";
            id = courseId;
            title = course.getCode() != null && !course.getCode().isBlank() ? course.getCode() : course.getName();
            sets = setService.ownedGroupSets(folderId, courseId);
        }
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
