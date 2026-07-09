package com.rnave.studily.flashcard;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseService;
import com.rnave.studily.flashcard.FlashcardDtos.FlashcardDto;
import com.rnave.studily.flashcard.FlashcardDtos.FlashcardSetDto;
import com.rnave.studily.flashcard.FlashcardDtos.FlashcardSetRequest;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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
        apply(set, req);
        return FlashcardSetDto.from(flashcardSetRepository.save(set));
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
