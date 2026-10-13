package com.rnave.studily.flashcard;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseService;
import com.rnave.studily.flashcard.FlashcardDtos.CopiedFromDto;
import com.rnave.studily.flashcard.FlashcardDtos.FlashcardDto;
import com.rnave.studily.flashcard.FlashcardDtos.FlashcardSetDto;
import com.rnave.studily.flashcard.FlashcardDtos.FlashcardSetRequest;
import com.rnave.studily.flashcard.FlashcardDtos.FlashcardSetSummaryDto;
import com.rnave.studily.flashcard.FlashcardDtos.SetOwnerDto;
import com.rnave.studily.flashcard.FlashcardDtos.SetPagePreview;
import com.rnave.studily.flashcard.FlashcardDtos.SharedFlashcardSetDto;
import com.rnave.studily.friend.FriendRequestRepository;
import com.rnave.studily.friend.FriendRequestStatus;
import com.rnave.studily.user.Flairs;
import com.rnave.studily.user.User;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
public class FlashcardSetService {

    private final FlashcardSetRepository flashcardSetRepository;
    private final CurrentUser currentUser;
    private final CourseService courseService;
    private final FriendRequestRepository friendRequestRepository;
    private final Flairs flairs;
    private final FlashcardImageRepository imageRepository;

    public FlashcardSetService(FlashcardSetRepository flashcardSetRepository, CurrentUser currentUser,
                               @Lazy CourseService courseService, FriendRequestRepository friendRequestRepository,
                               Flairs flairs, FlashcardImageRepository imageRepository) {
        this.flashcardSetRepository = flashcardSetRepository;
        this.currentUser = currentUser;
        this.courseService = courseService;
        this.friendRequestRepository = friendRequestRepository;
        this.flairs = flairs;
        this.imageRepository = imageRepository;
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
        return ownerDto(requireOwned(id));
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
        return ownerDto(set);
    }

    @Transactional(readOnly = true)
    public SharedFlashcardSetDto shared(Long id) {
        Long viewerId = currentUser.maybe().map(User::getId).orElse(null);
        FlashcardSet set = requireViewable(id, viewerId);
        return SharedFlashcardSetDto.from(set, set.getUser().getId().equals(viewerId), flairs);
    }

    @Transactional(readOnly = true)
    public List<FlashcardSetSummaryDto> visibleSetsOf(Long userId) {
        Long viewerId = currentUser.id();
        EnumSet<FlashcardSetVisibility> visible = viewerId.equals(userId) || areFriends(viewerId, userId)
                ? EnumSet.of(FlashcardSetVisibility.PUBLIC, FlashcardSetVisibility.FRIENDS)
                : EnumSet.of(FlashcardSetVisibility.PUBLIC);
        return flashcardSetRepository
                .findByUserIdAndVisibilityInOrderByCreatedAtDesc(userId, visible)
                .stream().map(FlashcardSetSummaryDto::from).toList();
    }

    @Transactional(readOnly = true)
    public Optional<SetPagePreview> publicPreview(Long id) {
        return flashcardSetRepository.findById(id)
                .filter(s -> s.getVisibility() == FlashcardSetVisibility.PUBLIC)
                .map(s -> {
                    Course course = s.getCourse();
                    return new SetPagePreview(s.getId(), s.getTitle(), s.getDescription(), s.getUser().getName(),
                            s.getUser().getUsername(), s.getCards().size(),
                            course != null ? course.getCode() : null,
                            course != null ? course.getName() : null,
                            course != null ? course.getColor() : null);
                });
    }

    @Transactional
    public FlashcardSetDto copy(Long id) {
        User me = currentUser.entity();
        FlashcardSet source = requireViewable(id, me.getId());
        FlashcardSet copy = new FlashcardSet();
        copy.setUser(me);
        copy.setTitle(source.getTitle());
        copy.setDescription(source.getDescription());
        copy.setVisibility(FlashcardSetVisibility.PRIVATE);
        if (!source.getUser().getId().equals(me.getId())) {
            copy.setCopiedFromSet(source);
            copy.setCopiedFromUser(source.getUser());
        }
        for (Flashcard c : source.getCards()) {
            Flashcard card = new Flashcard();
            card.setSet(copy);
            card.setFront(c.getFront());
            card.setBack(c.getBack());
            card.setFrontImageKey(c.getFrontImageKey());
            card.setBackImageKey(c.getBackImageKey());
            card.setPosition(c.getPosition());
            copy.getCards().add(card);
        }
        return ownerDto(flashcardSetRepository.save(copy));
    }

    @Transactional(readOnly = true)
    public FlashcardSet requireViewable(Long id, Long viewerId) {
        return flashcardSetRepository.findById(id)
                .filter(s -> canView(s, viewerId))
                .orElseThrow(() -> new NotFoundException("Flashcard set not found"));
    }

    private boolean canView(FlashcardSet set, Long viewerId) {
        Long ownerId = set.getUser().getId();
        if (ownerId.equals(viewerId)) return true;
        return switch (set.getVisibility()) {
            case PUBLIC -> true;
            case FRIENDS -> viewerId != null && areFriends(viewerId, ownerId);
            case PRIVATE -> false;
        };
    }

    private boolean areFriends(Long a, Long b) {
        return friendRequestRepository.findBetween(a, b)
                .map(f -> f.getStatus() == FriendRequestStatus.ACCEPTED)
                .orElse(false);
    }

    private FlashcardSetDto ownerDto(FlashcardSet set) {
        return FlashcardSetDto.from(set, copiedFrom(set));
    }

    private CopiedFromDto copiedFrom(FlashcardSet set) {
        User originalOwner = set.getCopiedFromUser();
        if (originalOwner == null) return null;
        FlashcardSet source = set.getCopiedFromSet();
        boolean visible = source != null && canView(source, set.getUser().getId());
        return new CopiedFromDto(
                visible ? source.getId() : null,
                visible ? source.getTitle() : null,
                SetOwnerDto.from(originalOwner, flairs));
    }

    @Transactional
    public FlashcardSetDto update(Long id, FlashcardSetRequest req) {
        FlashcardSet set = requireOwned(id);
        apply(set, req);
        return ownerDto(flashcardSetRepository.save(set));
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
        Set<String> knownImages = new HashSet<>();
        for (Flashcard c : set.getCards()) {
            if (c.getId() != null) existing.put(c.getId(), c);
            if (c.getFrontImageKey() != null) knownImages.add(c.getFrontImageKey());
            if (c.getBackImageKey() != null) knownImages.add(c.getBackImageKey());
        }

        Set<String> newImages = new HashSet<>();
        set.getCards().clear();
        if (req.cards() != null) {
            int position = 0;
            for (FlashcardDto dto : req.cards()) {
                String front = trimToEmpty(dto.front());
                String back = trimToEmpty(dto.back());
                String frontImage = trimToNull(dto.frontImage());
                String backImage = trimToNull(dto.backImage());
                if ((front.isEmpty() && frontImage == null) || (back.isEmpty() && backImage == null)) {
                    throw new BadRequestException("Each side of a card needs text or an image");
                }
                for (String key : new String[] {frontImage, backImage}) {
                    if (key != null && !knownImages.contains(key)) newImages.add(key);
                }
                Flashcard card = dto.id() != null ? existing.get(dto.id()) : null;
                if (card == null) {
                    card = new Flashcard();
                    card.setSet(set);
                }
                card.setFront(front);
                card.setBack(back);
                card.setFrontImageKey(frontImage);
                card.setBackImageKey(backImage);
                card.setPosition(position++);
                set.getCards().add(card);
            }
        }
        requireOwnImages(newImages);
    }

    private void requireOwnImages(Set<String> keys) {
        if (keys.isEmpty()) return;
        Long me = currentUser.id();
        long owned = imageRepository.findByImageKeyIn(keys).stream()
                .filter(i -> me.equals(i.getOwnerId()))
                .count();
        if (owned != keys.size()) {
            throw new BadRequestException("One of these images couldn't be found. Try adding it again.");
        }
    }

    private static String trimToEmpty(String s) {
        return s == null ? "" : s.trim();
    }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
