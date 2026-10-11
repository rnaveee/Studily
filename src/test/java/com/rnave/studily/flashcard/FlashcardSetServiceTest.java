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
import com.rnave.studily.friend.FriendRequest;
import com.rnave.studily.friend.FriendRequestRepository;
import com.rnave.studily.friend.FriendRequestStatus;
import com.rnave.studily.progress.Flair;
import com.rnave.studily.progress.FlairRepository;
import com.rnave.studily.user.Flairs;
import com.rnave.studily.user.User;
import com.rnave.studily.flashcard.Sm2.Grade;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class FlashcardSetServiceTest {

    private FlashcardSetRepository flashcardSetRepository;
    private CurrentUser currentUser;
    private FriendRequestRepository friendRequestRepository;
    private FlairRepository flairRepository;
    private FlashcardSetService service;

    @BeforeEach
    void setUp() {
        flashcardSetRepository = mock(FlashcardSetRepository.class);
        currentUser = mock(CurrentUser.class);
        friendRequestRepository = mock(FriendRequestRepository.class);
        flairRepository = mock(FlairRepository.class);
        service = new FlashcardSetService(flashcardSetRepository, currentUser, mock(CourseService.class),
                friendRequestRepository,
                new Flairs(flairRepository, Clock.systemUTC(), "https://badges.studily.ca/flairs/v1"));
        when(friendRequestRepository.findBetween(any(), any())).thenReturn(Optional.empty());
        when(currentUser.id()).thenReturn(1L);
        when(currentUser.maybe()).thenReturn(Optional.of(user(1L)));
        when(currentUser.entity()).thenReturn(user(1L));
        when(flashcardSetRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private static User user(long id) {
        User u = new User();
        u.setId(id);
        u.setUsername("user" + id);
        u.setName("User " + id);
        return u;
    }

    private void befriend(long a, long b, FriendRequestStatus status) {
        FriendRequest request = new FriendRequest();
        request.setRequester(user(a));
        request.setAddressee(user(b));
        request.setStatus(status);
        when(friendRequestRepository.findBetween(a, b)).thenReturn(Optional.of(request));
        when(friendRequestRepository.findBetween(b, a)).thenReturn(Optional.of(request));
    }

    private FlashcardSet setOwnedBy(long setId, long ownerId, FlashcardSetVisibility visibility) {
        FlashcardSet set = new FlashcardSet();
        set.setId(setId);
        set.setUser(user(ownerId));
        set.setTitle("Cells");
        set.setDescription("Organelles");
        set.setVisibility(visibility);
        Flashcard card = new Flashcard();
        card.setId(500L);
        card.setSet(set);
        card.setFront("Mitochondria");
        card.setBack("Powerhouse");
        card.setPosition(0);
        card.setRepetitions(6);
        card.setEaseFactor(2.9);
        card.setIntervalDays(40);
        card.setDueAt(Instant.now().plus(40, ChronoUnit.DAYS));
        set.getCards().add(card);
        when(flashcardSetRepository.findById(setId)).thenReturn(Optional.of(set));
        return set;
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
                new FlashcardDto(null, "brand new", "card", null, null, null, null)), null));

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
        FlashcardSet set = ownedSetWithCard(10L, 100L);

        service.update(10L, new FlashcardSetRequest("Title", null, null, List.of(
                new FlashcardDto(31337L, "front", "back", null, null, null, null)), null));

        assertThat(set.getCards()).hasSize(1);
        assertThat(set.getCards().get(0).getId()).isNull();
        assertThat(set.getCards().get(0).getRepetitions()).isZero();
    }

    @Test
    void sharedReturnsPublicSetToStranger() {
        setOwnedBy(20L, 2L, FlashcardSetVisibility.PUBLIC);

        SharedFlashcardSetDto dto = service.shared(20L);

        assertThat(dto.viewerIsOwner()).isFalse();
        assertThat(dto.owner().username()).isEqualTo("user2");
        assertThat(dto.owner().flair()).isNull();
        assertThat(dto.cardCount()).isEqualTo(1);
        assertThat(dto.cards().get(0).front()).isEqualTo("Mitochondria");
    }

    @Test
    void shared_ownerWithEquippedFlair_ownerCarriesFlairRef() {
        Flair galaxy = new Flair();
        galaxy.setCode("ring_galaxy");
        galaxy.setImageKey("galaxy.webp");
        when(flairRepository.findAll()).thenReturn(List.of(galaxy));
        FlashcardSet set = setOwnedBy(20L, 2L, FlashcardSetVisibility.PUBLIC);
        set.getUser().setEquippedFlairCode("ring_galaxy");

        SharedFlashcardSetDto dto = service.shared(20L);

        assertThat(dto.owner().flair()).isNotNull();
        assertThat(dto.owner().flair().code()).isEqualTo("ring_galaxy");
        assertThat(dto.owner().flair().imageUrl()).isEqualTo("https://badges.studily.ca/flairs/v1/galaxy.webp");
    }

    @Test
    void copy_originalOwnerWithEquippedFlair_attributionCarriesFlairRef() {
        FlashcardSet source = setOwnedBy(20L, 2L, FlashcardSetVisibility.PUBLIC);
        source.getUser().setEquippedFlairCode("ring_mint");

        FlashcardSetDto dto = service.copy(20L);

        assertThat(dto.copiedFrom().owner().flair()).isNotNull();
        assertThat(dto.copiedFrom().owner().flair().code()).isEqualTo("ring_mint");
        assertThat(dto.copiedFrom().owner().flair().imageUrl()).isNull();
    }

    @Test
    void sharedReturnsPublicSetToAnonymousVisitor() {
        when(currentUser.maybe()).thenReturn(Optional.empty());
        setOwnedBy(20L, 2L, FlashcardSetVisibility.PUBLIC);

        SharedFlashcardSetDto dto = service.shared(20L);

        assertThat(dto.viewerIsOwner()).isFalse();
        assertThat(dto.title()).isEqualTo("Cells");
    }

    @Test
    void sharedHidesPrivateSetFromStranger() {
        setOwnedBy(20L, 2L, FlashcardSetVisibility.PRIVATE);

        assertThatThrownBy(() -> service.shared(20L)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void sharedHidesPrivateSetFromAnonymousVisitor() {
        when(currentUser.maybe()).thenReturn(Optional.empty());
        setOwnedBy(20L, 2L, FlashcardSetVisibility.PRIVATE);

        assertThatThrownBy(() -> service.shared(20L)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void sharedShowsPrivateSetToItsOwner() {
        setOwnedBy(20L, 1L, FlashcardSetVisibility.PRIVATE);

        assertThat(service.shared(20L).viewerIsOwner()).isTrue();
    }

    @Test
    void copyOfPublicSetIsPrivateWithFreshReviewState() {
        FlashcardSet source = setOwnedBy(20L, 2L, FlashcardSetVisibility.PUBLIC);

        FlashcardSetDto dto = service.copy(20L);

        assertThat(dto.visibility()).isEqualTo(FlashcardSetVisibility.PRIVATE);
        assertThat(dto.courseId()).isNull();
        assertThat(dto.title()).isEqualTo("Cells");
        assertThat(dto.description()).isEqualTo("Organelles");
        assertThat(dto.cards()).hasSize(1);
        FlashcardDto card = dto.cards().get(0);
        assertThat(card.front()).isEqualTo("Mitochondria");
        assertThat(card.back()).isEqualTo("Powerhouse");
        assertThat(card.repetitions()).isZero();
        assertThat(card.easeFactor()).isEqualTo(2.5);
        assertThat(card.intervalDays()).isZero();
        assertThat(card.dueAt()).isBeforeOrEqualTo(Instant.now());

        Flashcard original = source.getCards().get(0);
        assertThat(original.getRepetitions()).isEqualTo(6);
        assertThat(original.getIntervalDays()).isEqualTo(40);
    }

    @Test
    void copyRejectsSomeoneElsesPrivateSet() {
        setOwnedBy(20L, 2L, FlashcardSetVisibility.PRIVATE);

        assertThatThrownBy(() -> service.copy(20L)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void setVisibilityRejectsSetTheCallerDoesNotOwn() {
        when(flashcardSetRepository.findByIdAndUserId(77L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.setVisibility(77L, FlashcardSetVisibility.PUBLIC))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void setVisibilityUpdatesOwnedSet() {
        FlashcardSet set = ownedSetWithCard(10L, 100L);

        FlashcardSetDto dto = service.setVisibility(10L, FlashcardSetVisibility.PUBLIC);

        assertThat(set.getVisibility()).isEqualTo(FlashcardSetVisibility.PUBLIC);
        assertThat(dto.visibility()).isEqualTo(FlashcardSetVisibility.PUBLIC);
    }

    @Test
    void createDefaultsToPrivate() {
        FlashcardSetDto dto = service.create(new FlashcardSetRequest("Title", null, null, List.of(), null));

        assertThat(dto.visibility()).isEqualTo(FlashcardSetVisibility.PRIVATE);
    }

    @Test
    void visibleSetsOfStrangerAreOnlyPublic() {
        FlashcardSet publicSet = setOwnedBy(20L, 2L, FlashcardSetVisibility.PUBLIC);
        when(flashcardSetRepository.findByUserIdAndVisibilityInOrderByCreatedAtDesc(
                eq(2L), eq(EnumSet.of(FlashcardSetVisibility.PUBLIC))))
                .thenReturn(List.of(publicSet));

        List<FlashcardSetSummaryDto> sets = service.visibleSetsOf(2L);

        assertThat(sets).extracting(FlashcardSetSummaryDto::id).containsExactly(20L);
        assertThat(sets.get(0).cardCount()).isEqualTo(1);
    }

    @Test
    void visibleSetsOfFriendIncludeFriendsOnlySets() {
        befriend(1L, 2L, FriendRequestStatus.ACCEPTED);
        FlashcardSet friendsSet = setOwnedBy(21L, 2L, FlashcardSetVisibility.FRIENDS);
        when(flashcardSetRepository.findByUserIdAndVisibilityInOrderByCreatedAtDesc(
                eq(2L), eq(EnumSet.of(FlashcardSetVisibility.PUBLIC, FlashcardSetVisibility.FRIENDS))))
                .thenReturn(List.of(friendsSet));

        assertThat(service.visibleSetsOf(2L)).extracting(FlashcardSetSummaryDto::visibility)
                .containsExactly(FlashcardSetVisibility.FRIENDS);
    }

    @Test
    void visibleSetsOfPendingFriendAreOnlyPublic() {
        befriend(1L, 2L, FriendRequestStatus.PENDING);

        service.visibleSetsOf(2L);

        org.mockito.Mockito.verify(flashcardSetRepository).findByUserIdAndVisibilityInOrderByCreatedAtDesc(
                2L, EnumSet.of(FlashcardSetVisibility.PUBLIC));
    }

    @Test
    void visibleSetsOfSelfIncludeFriendsOnlySets() {
        service.visibleSetsOf(1L);

        org.mockito.Mockito.verify(flashcardSetRepository).findByUserIdAndVisibilityInOrderByCreatedAtDesc(
                1L, EnumSet.of(FlashcardSetVisibility.PUBLIC, FlashcardSetVisibility.FRIENDS));
    }

    @Test
    void friendsOnlySetIsSharedWithFriends() {
        befriend(1L, 2L, FriendRequestStatus.ACCEPTED);
        setOwnedBy(20L, 2L, FlashcardSetVisibility.FRIENDS);

        SharedFlashcardSetDto dto = service.shared(20L);

        assertThat(dto.visibility()).isEqualTo(FlashcardSetVisibility.FRIENDS);
        assertThat(dto.viewerIsOwner()).isFalse();
    }

    @Test
    void friendsOnlySetIsHiddenFromNonFriends() {
        befriend(1L, 2L, FriendRequestStatus.PENDING);
        setOwnedBy(20L, 2L, FlashcardSetVisibility.FRIENDS);

        assertThatThrownBy(() -> service.shared(20L)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.copy(20L)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void friendsOnlySetIsHiddenFromAnonymousVisitors() {
        when(currentUser.maybe()).thenReturn(Optional.empty());
        setOwnedBy(20L, 2L, FlashcardSetVisibility.FRIENDS);

        assertThatThrownBy(() -> service.shared(20L)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void friendCanCopyFriendsOnlySet() {
        befriend(1L, 2L, FriendRequestStatus.ACCEPTED);
        setOwnedBy(20L, 2L, FlashcardSetVisibility.FRIENDS);

        assertThat(service.copy(20L).visibility()).isEqualTo(FlashcardSetVisibility.PRIVATE);
    }

    @Test
    void copyRecordsWhereItCameFrom() {
        FlashcardSet source = setOwnedBy(20L, 2L, FlashcardSetVisibility.PUBLIC);

        FlashcardSetDto dto = service.copy(20L);

        assertThat(dto.copiedFrom()).isNotNull();
        assertThat(dto.copiedFrom().setId()).isEqualTo(20L);
        assertThat(dto.copiedFrom().title()).isEqualTo("Cells");
        assertThat(dto.copiedFrom().owner().username()).isEqualTo("user2");
        assertThat(source.getUser().getId()).isEqualTo(2L);
    }

    @Test
    void copyOfOwnSetHasNoAttribution() {
        setOwnedBy(20L, 1L, FlashcardSetVisibility.PRIVATE);

        assertThat(service.copy(20L).copiedFrom()).isNull();
    }

    @Test
    void attributionHidesSourceThatIsNoLongerVisible() {
        FlashcardSet source = setOwnedBy(20L, 2L, FlashcardSetVisibility.PRIVATE);
        FlashcardSet copy = ownedSetWithCard(10L, 100L);
        copy.setUser(user(1L));
        copy.setCopiedFromSet(source);
        copy.setCopiedFromUser(source.getUser());

        FlashcardSetDto dto = service.get(10L);

        assertThat(dto.copiedFrom().setId()).isNull();
        assertThat(dto.copiedFrom().title()).isNull();
        assertThat(dto.copiedFrom().owner().username()).isEqualTo("user2");
    }

    @Test
    void attributionIsEmptyWhenOriginalOwnerIsGone() {
        FlashcardSet copy = ownedSetWithCard(10L, 100L);
        copy.setUser(user(1L));

        assertThat(service.get(10L).copiedFrom()).isNull();
    }

    @Test
    void publicPreviewOnlyForPublicSets() {
        Course course = new Course();
        course.setCode("BIOL 101");
        course.setName("Intro to Biology");
        course.setColor("#10b981");
        setOwnedBy(20L, 2L, FlashcardSetVisibility.PUBLIC).setCourse(course);
        setOwnedBy(21L, 2L, FlashcardSetVisibility.FRIENDS);
        setOwnedBy(22L, 2L, FlashcardSetVisibility.PRIVATE);

        assertThat(service.publicPreview(20L)).hasValueSatisfying(p -> {
            assertThat(p.id()).isEqualTo(20L);
            assertThat(p.title()).isEqualTo("Cells");
            assertThat(p.ownerUsername()).isEqualTo("user2");
            assertThat(p.cardCount()).isEqualTo(1);
            assertThat(p.courseCode()).isEqualTo("BIOL 101");
            assertThat(p.courseName()).isEqualTo("Intro to Biology");
            assertThat(p.courseColor()).isEqualTo("#10b981");
        });
        assertThat(service.publicPreview(21L)).isEmpty();
        assertThat(service.publicPreview(22L)).isEmpty();
        assertThat(service.publicPreview(99L)).isEmpty();
    }
}
