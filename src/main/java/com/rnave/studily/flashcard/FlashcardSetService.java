package com.rnave.studily.flashcard;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseService;
import com.rnave.studily.flashcard.FlashcardDtos.FlashcardDto;
import com.rnave.studily.flashcard.FlashcardDtos.FlashcardSetDto;
import com.rnave.studily.flashcard.FlashcardDtos.FlashcardSetRequest;
import com.rnave.studily.flashcard.FlashcardDtos.FlashcardSetSummaryDto;
import com.rnave.studily.flashcard.FlashcardDtos.SharedFlashcardSetDto;
import com.rnave.studily.user.User;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class FlashcardSetService {

    private final FlashcardSetRepository flashcardSetRepository;
    private final CurrentUser currentUser;
    private final CourseService courseService;

    public FlashcardSetService(FlashcardSetRepository flashcardSetRepository, CurrentUser currentUser,
                               @Lazy CourseService courseService) {
        this.flashcardSetRepository = flashcardSetRepository;
        this.currentUser = currentUser;
        this.courseService = courseService;
    }

    @Transactional(readOnly = true)
    public List<FlashcardSetDto> list(Long courseId) {
        Long userId = currentUser.id();
        if (courseId != null) {
            return flashcardSetRepository.findByUserIdAndCourseIdOrderByCreatedAtDesc(userId, courseId)
                    .stream().map(FlashcardSetDto::from).toList();
        }
        return flashcardSetRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().map(FlashcardSetDto::from).toList();
    }

    @Transactional(readOnly = true)
    public FlashcardSetDto get(Long id) {
        return FlashcardSetDto.from(requireOwned(id));
    }

    @Transactional(readOnly = true)
    public FlashcardSet requireOwned(Long id) {
        return flashcardSetRepository.findByIdAndUserId(id, currentUser.id())
                .orElseThrow(() -> new NotFoundException("Flashcard set not found"));
    }

    @Transactional
    public FlashcardSetDto create(FlashcardSetRequest req) {
        FlashcardSet set = new FlashcardSet();
        set.setUser(currentUser.entity());
        set.setVisibility(req.visibility() != null ? req.visibility() : FlashcardSetVisibility.PRIVATE);
        apply(set, req);
        return FlashcardSetDto.from(flashcardSetRepository.save(set));
    }

    @Transactional
    public FlashcardSetDto setVisibility(Long id, FlashcardSetVisibility visibility) {
        FlashcardSet set = requireOwned(id);
        set.setVisibility(visibility);
        return FlashcardSetDto.from(set);
    }

    @Transactional(readOnly = true)
    public SharedFlashcardSetDto shared(Long id) {
        Long viewerId = currentUser.maybe().map(User::getId).orElse(null);
        FlashcardSet set = requireViewable(id, viewerId);
        return SharedFlashcardSetDto.from(set, set.getUser().getId().equals(viewerId));
    }

    @Transactional(readOnly = true)
    public List<FlashcardSetSummaryDto> publicSetsOf(Long userId) {
        return flashcardSetRepository
                .findByUserIdAndVisibilityOrderByCreatedAtDesc(userId, FlashcardSetVisibility.PUBLIC)
                .stream().map(FlashcardSetSummaryDto::from).toList();
    }

    @Transactional
    public FlashcardSetDto copy(Long id) {
        FlashcardSet source = requireViewable(id, currentUser.id());
        FlashcardSet copy = new FlashcardSet();
        copy.setUser(currentUser.entity());
        copy.setTitle(source.getTitle());
        copy.setDescription(source.getDescription());
        copy.setVisibility(FlashcardSetVisibility.PRIVATE);
        for (Flashcard c : source.getCards()) {
            Flashcard card = new Flashcard();
            card.setSet(copy);
            card.setFront(c.getFront());
            card.setBack(c.getBack());
            card.setPosition(c.getPosition());
            copy.getCards().add(card);
        }
        return FlashcardSetDto.from(flashcardSetRepository.save(copy));
    }

    private FlashcardSet requireViewable(Long id, Long viewerId) {
        Optional<FlashcardSet> found = flashcardSetRepository.findById(id);
        return found
                .filter(s -> s.getVisibility() == FlashcardSetVisibility.PUBLIC
                        || s.getUser().getId().equals(viewerId))
                .orElseThrow(() -> new NotFoundException("Flashcard set not found"));
    }

    @Transactional
    public FlashcardSetDto update(Long id, FlashcardSetRequest req) {
        FlashcardSet set = requireOwned(id);
        apply(set, req);
        return FlashcardSetDto.from(flashcardSetRepository.save(set));
    }

    @Transactional
    public void delete(Long id) {
        flashcardSetRepository.delete(requireOwned(id));
    }

    @Transactional
    public FlashcardDto review(Long setId, Long cardId, Sm2.Grade grade) {
        FlashcardSet set = requireOwned(setId);
        Flashcard card = set.getCards().stream()
                .filter(c -> c.getId() != null && c.getId().equals(cardId))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Flashcard not found"));

        Sm2.Result result = Sm2.review(card.getRepetitions(), card.getEaseFactor(), card.getIntervalDays(), grade);
        Instant now = Instant.now();
        card.setRepetitions(result.repetitions());
        card.setEaseFactor(result.easeFactor());
        card.setIntervalDays(result.intervalDays());
        card.setLastReviewedAt(now);
        card.setDueAt(now.plus(result.intervalDays(), ChronoUnit.DAYS));
        return FlashcardDto.from(card);
    }

    private void apply(FlashcardSet set, FlashcardSetRequest req) {
        set.setTitle(req.title().trim());
        set.setDescription(trimToNull(req.description()));

        if (req.courseId() != null) {
            Course course = courseService.requireOwned(req.courseId());
            set.setCourse(course);
        } else {
            set.setCourse(null);
        }

        Map<Long, Flashcard> existing = new HashMap<>();
        for (Flashcard c : set.getCards()) {
            if (c.getId() != null) existing.put(c.getId(), c);
        }

        set.getCards().clear();
        if (req.cards() != null) {
            int position = 0;
            for (FlashcardDto dto : req.cards()) {
                Flashcard card = dto.id() != null ? existing.get(dto.id()) : null;
                if (card == null) {
                    card = new Flashcard();
                    card.setSet(set);
                }
                card.setFront(dto.front().trim());
                card.setBack(dto.back().trim());
                card.setPosition(position++);
                set.getCards().add(card);
            }
        }
    }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
