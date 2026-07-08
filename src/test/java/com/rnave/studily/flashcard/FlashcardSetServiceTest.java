package com.rnave.studily.flashcard;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.course.CourseService;
import com.rnave.studily.flashcard.FlashcardDtos.FlashcardDto;
import com.rnave.studily.flashcard.FlashcardDtos.FlashcardSetRequest;
import com.rnave.studily.flashcard.Sm2.Grade;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class FlashcardSetServiceTest {

    private FlashcardSetRepository flashcardSetRepository;
    private CurrentUser currentUser;
    private FlashcardSetService service;

    @BeforeEach
    void setUp() {
        flashcardSetRepository = mock(FlashcardSetRepository.class);
        currentUser = mock(CurrentUser.class);
        service = new FlashcardSetService(flashcardSetRepository, currentUser, mock(CourseService.class));
        when(currentUser.id()).thenReturn(1L);
        when(flashcardSetRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private FlashcardSet ownedSetWithCard(long setId, long cardId) {
        FlashcardSet set = new FlashcardSet();
        set.setId(setId);
        Flashcard card = new Flashcard();
        card.setId(cardId);
        card.setSet(set);
        card.setFront("f");
        card.setBack("b");
        set.getCards().add(card);
        when(flashcardSetRepository.findByIdAndUserId(setId, 1L)).thenReturn(Optional.of(set));
        return set;
    }

    @Test
    void reviewGradesCardAndSchedulesIt() {
        FlashcardSet set = ownedSetWithCard(10L, 100L);

        FlashcardDto dto = service.review(10L, 100L, Grade.GOOD);

        Flashcard card = set.getCards().get(0);
        assertThat(card.getRepetitions()).isEqualTo(1);
        assertThat(card.getIntervalDays()).isEqualTo(1);
        assertThat(card.getLastReviewedAt()).isNotNull();
        assertThat(card.getDueAt()).isAfter(Instant.now().plus(23, ChronoUnit.HOURS));
        assertThat(dto.intervalDays()).isEqualTo(1);
    }

    @Test
    void reviewWithAgainKeepsCardDueNow() {
        FlashcardSet set = ownedSetWithCard(10L, 100L);
        Flashcard card = set.getCards().get(0);
        card.setRepetitions(3);
        card.setIntervalDays(15);

        service.review(10L, 100L, Grade.AGAIN);

        assertThat(card.getRepetitions()).isZero();
        assertThat(card.getIntervalDays()).isZero();
        assertThat(card.getDueAt()).isBeforeOrEqualTo(Instant.now());
    }

    @Test
    void reviewRejectsCardFromAnotherSet() {
        ownedSetWithCard(10L, 100L);

        assertThatThrownBy(() -> service.review(10L, 999L, Grade.GOOD))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void reviewRejectsSetTheCallerDoesNotOwn() {
        when(flashcardSetRepository.findByIdAndUserId(77L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.review(77L, 100L, Grade.GOOD))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void updateKeepsReviewStateOfExistingCards() {
        FlashcardSet set = ownedSetWithCard(10L, 100L);
        Flashcard card = set.getCards().get(0);
        card.setRepetitions(4);
        card.setEaseFactor(2.7);
        card.setIntervalDays(30);
        Instant due = Instant.now().plus(30, ChronoUnit.DAYS);
        card.setDueAt(due);

        service.update(10L, new FlashcardSetRequest("Title", null, null, List.of(
                new FlashcardDto(100L, "edited front", "edited back", null, null, null, null),
                new FlashcardDto(null, "brand new", "card", null, null, null, null))));

        assertThat(set.getCards()).hasSize(2);
        Flashcard kept = set.getCards().get(0);
        assertThat(kept).isSameAs(card);
        assertThat(kept.getFront()).isEqualTo("edited front");
        assertThat(kept.getRepetitions()).isEqualTo(4);
        assertThat(kept.getEaseFactor()).isEqualTo(2.7);
        assertThat(kept.getIntervalDays()).isEqualTo(30);
        assertThat(kept.getDueAt()).isEqualTo(due);

        Flashcard added = set.getCards().get(1);
        assertThat(added.getRepetitions()).isZero();
        assertThat(added.getDueAt()).isBeforeOrEqualTo(Instant.now());
    }

    @Test
    void updateIgnoresForeignCardIdsAndCreatesFreshCards() {
        // A card id that isn't in the owned set (e.g. another user's card) must not be adopted.
        FlashcardSet set = ownedSetWithCard(10L, 100L);

        service.update(10L, new FlashcardSetRequest("Title", null, null, List.of(
                new FlashcardDto(31337L, "front", "back", null, null, null, null))));

        assertThat(set.getCards()).hasSize(1);
        assertThat(set.getCards().get(0).getId()).isNull();
        assertThat(set.getCards().get(0).getRepetitions()).isZero();
    }
}
