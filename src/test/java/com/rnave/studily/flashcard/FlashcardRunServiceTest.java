package com.rnave.studily.flashcard;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.config.TooManyRequestsException;
import com.rnave.studily.course.CourseService;
import com.rnave.studily.flashcard.FlashcardRunDtos.CardResult;
import com.rnave.studily.flashcard.FlashcardRunDtos.FlashcardRunResult;
import com.rnave.studily.flashcard.FlashcardRunDtos.FlashcardRunStart;
import com.rnave.studily.flashcard.FlashcardRunDtos.RunCardDto;
import com.rnave.studily.flashcard.FlashcardRunDtos.XpReason;
import com.rnave.studily.friend.FriendRequest;
import com.rnave.studily.friend.FriendRequestRepository;
import com.rnave.studily.friend.FriendRequestStatus;
import com.rnave.studily.progress.BadgeService;
import com.rnave.studily.progress.Chest;
import com.rnave.studily.progress.ChestRepository;
import com.rnave.studily.progress.ChestService;
import com.rnave.studily.progress.ChestSource;
import com.rnave.studily.progress.CoinTransactionRepository;
import com.rnave.studily.progress.FlairService;
import com.rnave.studily.progress.ProgressRateLimiter;
import com.rnave.studily.progress.ProgressService;
import com.rnave.studily.progress.UserProgress;
import com.rnave.studily.progress.UserProgressRepository;
import com.rnave.studily.progress.XpEvent;
import com.rnave.studily.progress.XpEventRepository;
import com.rnave.studily.progress.XpSource;
import com.rnave.studily.user.Flairs;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import com.rnave.studily.user.UserTimeZones;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;
import java.util.random.RandomGenerator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FlashcardRunServiceTest {

    private static final Instant T0 = Instant.parse("2026-10-07T17:00:00Z");
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 7);
    private static final long SET_ID = 10L;
    private static final long RUN_ID = 70L;

    private FlashcardRunRepository runRepository;
    private FlashcardSetRepository flashcardSetRepository;
    private FriendRequestRepository friendRequestRepository;
    private UserProgressRepository userProgressRepository;
    private XpEventRepository xpEventRepository;
    private UserRepository userRepository;
    private ChestRepository chestRepository;
    private RandomGenerator random;
    private CurrentUser currentUser;
    private BadgeService badgeService;
    private FlairService flairService;
    private UserTimeZones timeZones;
    private ProgressRateLimiter rateLimiter;
    private FlashcardRunService service;

    private final AtomicLong ids = new AtomicLong(RUN_ID - 1);
    private final List<FlashcardRun> runs = new ArrayList<>();
    private final List<XpEvent> xpEvents = new ArrayList<>();
    private final Set<String> dedupeKeys = new HashSet<>();
    private final List<Chest> chests = new ArrayList<>();
    private User me;
    private UserProgress progress;
    private FlashcardSet ownSet;

    @BeforeEach
    void setUp() {
        runRepository = mock(FlashcardRunRepository.class);
        flashcardSetRepository = mock(FlashcardSetRepository.class);
        friendRequestRepository = mock(FriendRequestRepository.class);
        userProgressRepository = mock(UserProgressRepository.class);
        xpEventRepository = mock(XpEventRepository.class);
        userRepository = mock(UserRepository.class);
        chestRepository = mock(ChestRepository.class);
        random = mock(RandomGenerator.class);
        currentUser = mock(CurrentUser.class);
        badgeService = mock(BadgeService.class);
        flairService = mock(FlairService.class);
        timeZones = new UserTimeZones(userRepository, "UTC");
        rateLimiter = new ProgressRateLimiter();

        me = user(1L);
        me.setTimezone("America/Vancouver");
        progress = new UserProgress();
        progress.setUserId(1L);
        ownSet = set(SET_ID, me, FlashcardSetVisibility.PRIVATE, 50);

        when(currentUser.entity()).thenReturn(me);
        when(currentUser.id()).thenReturn(1L);
        when(userRepository.getReferenceById(1L)).thenReturn(me);
        when(userProgressRepository.findForUpdate(1L)).thenAnswer(inv -> Optional.of(progress));
        when(flashcardSetRepository.findById(SET_ID)).thenReturn(Optional.of(ownSet));
        when(friendRequestRepository.findBetween(any(), any())).thenReturn(Optional.empty());
        when(xpEventRepository.existsByDedupeKey(anyString()))
                .thenAnswer(inv -> dedupeKeys.contains(inv.<String>getArgument(0)));
        when(xpEventRepository.save(any(XpEvent.class))).thenAnswer(inv -> {
            XpEvent e = inv.getArgument(0);
            dedupeKeys.add(e.getDedupeKey());
            xpEvents.add(e);
            return e;
        });
        when(badgeService.evaluate(anyLong())).thenReturn(List.of());
        when(random.nextDouble()).thenReturn(0.99);
        when(chestRepository.save(any(Chest.class))).thenAnswer(inv -> {
            chests.add(inv.getArgument(0));
            return inv.getArgument(0);
        });
        when(runRepository.save(any(FlashcardRun.class))).thenAnswer(inv -> {
            FlashcardRun r = inv.getArgument(0);
            if (r.getId() == null) {
                r.setId(ids.incrementAndGet());
                runs.add(r);
            }
            return r;
        });
        when(runRepository.findByIdAndUserId(anyLong(), anyLong())).thenAnswer(inv -> runs.stream()
                .filter(r -> r.getId().equals(inv.getArgument(0))
                        && r.getUser().getId().equals(inv.getArgument(1)))
                .findFirst());

        at(T0);
    }

    private void at(Instant instant) {
        Clock clock = Clock.fixed(instant, ZoneOffset.UTC);
        ProgressService progressService = new ProgressService(userProgressRepository, xpEventRepository,
                mock(CoinTransactionRepository.class), chestRepository, userRepository, badgeService, flairService,
                timeZones, currentUser, clock);
        ChestService chestService = new ChestService(chestRepository, progressService, badgeService, flairService,
                currentUser, clock, random);
        FlashcardSetService setService = new FlashcardSetService(flashcardSetRepository, currentUser,
                mock(CourseService.class), friendRequestRepository, mock(Flairs.class));
        service = new FlashcardRunService(runRepository, setService, progressService, chestService, rateLimiter,
                currentUser, clock, new ObjectMapper());
    }

    private static User user(Long id) {
        User u = new User();
        u.setId(id);
        u.setUsername("user" + id);
        u.setName("User " + id);
        return u;
    }

    private static FlashcardSet set(long id, User owner, FlashcardSetVisibility visibility, int cardCount) {
        FlashcardSet set = new FlashcardSet();
        set.setId(id);
        set.setUser(owner);
        set.setTitle("Cells");
        set.setVisibility(visibility);
        for (int i = 0; i < cardCount; i++) {
            Flashcard card = new Flashcard();
            card.setId(id * 100 + i + 1);
            card.setSet(set);
            card.setFront("front " + (i + 1));
            card.setBack("back " + (i + 1));
            card.setPosition(i);
            set.getCards().add(card);
        }
        return set;
    }

    private FlashcardRun startedRun(FlashcardRunMode mode) {
        FlashcardRunStart start = service.start(SET_ID, mode);
        return runs.stream().filter(r -> r.getId().equals(start.runId())).findFirst().orElseThrow();
    }

    private static List<CardResult> results(int count, int correct) {
        List<CardResult> results = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            results.add(new CardResult(SET_ID * 100 + i + 1, i < correct));
        }
        return results;
    }

    private FlashcardRunResult complete(FlashcardRun run, Duration elapsed, List<CardResult> results) {
        at(run.getStartedAt().plus(elapsed));
        return service.complete(run.getId(), results);
    }

    @Test
    void start_ownSet_savesRunWithLocalDateInUserZone() {
        Instant lateEvening = Instant.parse("2026-10-08T06:50:00Z");
        at(lateEvening);

        FlashcardRunStart start = service.start(SET_ID, FlashcardRunMode.REVIEW);

        assertThat(start.runId()).isEqualTo(RUN_ID);
        assertThat(start.startedAt()).isEqualTo(lateEvening);
        assertThat(runs).singleElement().satisfies(r -> {
            assertThat(r.getUser()).isSameAs(me);
            assertThat(r.getSet()).isSameAs(ownSet);
            assertThat(r.getMode()).isEqualTo(FlashcardRunMode.REVIEW);
            assertThat(r.getLocalDate()).isEqualTo(TODAY);
            assertThat(r.getCompletedAt()).isNull();
        });
    }

    @Test
    void start_setNotViewable_throwsNotFound() {
        FlashcardSet hidden = set(11L, user(2L), FlashcardSetVisibility.PRIVATE, 10);
        when(flashcardSetRepository.findById(11L)).thenReturn(Optional.of(hidden));

        assertThatThrownBy(() -> service.start(11L, FlashcardRunMode.REVIEW)).isInstanceOf(NotFoundException.class);
        assertThat(runs).isEmpty();
    }

    @Test
    void start_friendsOnlySetOfStranger_throwsNotFound() {
        FlashcardSet friendsOnly = set(11L, user(2L), FlashcardSetVisibility.FRIENDS, 10);
        when(flashcardSetRepository.findById(11L)).thenReturn(Optional.of(friendsOnly));

        assertThatThrownBy(() -> service.start(11L, FlashcardRunMode.LEARN)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void start_friendsOnlySetOfFriend_isAllowed() {
        User friend = user(2L);
        FlashcardSet friendsOnly = set(11L, friend, FlashcardSetVisibility.FRIENDS, 10);
        when(flashcardSetRepository.findById(11L)).thenReturn(Optional.of(friendsOnly));
        FriendRequest accepted = new FriendRequest();
        accepted.setRequester(me);
        accepted.setAddressee(friend);
        accepted.setStatus(FriendRequestStatus.ACCEPTED);
        when(friendRequestRepository.findBetween(1L, 2L)).thenReturn(Optional.of(accepted));
        when(friendRequestRepository.findBetween(2L, 1L)).thenReturn(Optional.of(accepted));

        assertThat(service.start(11L, FlashcardRunMode.MEMORY).runId()).isNotNull();
    }

    @Test
    void start_unknownSet_throwsNotFound() {
        when(flashcardSetRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.start(404L, FlashcardRunMode.MATCH)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void start_thirtyFirstInAnHour_throwsTooManyRequests() {
        when(runRepository.countByUserIdAndStartedAtAfter(1L, T0.minus(Duration.ofHours(1)))).thenReturn(30L);

        assertThatThrownBy(() -> service.start(SET_ID, FlashcardRunMode.REVIEW))
                .isInstanceOf(TooManyRequestsException.class);
        assertThat(runs).isEmpty();
    }

    @Test
    void start_thirtiethInAnHour_isAllowed() {
        when(runRepository.countByUserIdAndStartedAtAfter(1L, T0.minus(Duration.ofHours(1)))).thenReturn(29L);

        assertThat(service.start(SET_ID, FlashcardRunMode.REVIEW).runId()).isEqualTo(RUN_ID);
    }

    @Test
    void complete_reviewWithHighAccuracy_isFullWithBonus() {
        FlashcardRun run = startedRun(FlashcardRunMode.REVIEW);

        FlashcardRunResult result = complete(run, Duration.ofSeconds(30), results(10, 8));

        assertThat(result.xpReason()).isEqualTo(XpReason.FULL);
        assertThat(result.xpAwarded()).isEqualTo(40);
        assertThat(result.cardCount()).isEqualTo(10);
        assertThat(result.correctCount()).isEqualTo(8);
        assertThat(result.delta().xpGained()).isEqualTo(40);
        assertThat(xpEvents).singleElement().satisfies(e -> {
            assertThat(e.getSource()).isEqualTo(XpSource.FLASHCARD_RUN);
            assertThat(e.getAmount()).isEqualTo(40);
            assertThat(e.getDedupeKey()).isEqualTo("flashcard-run:" + RUN_ID);
            assertThat(e.getRefId()).isEqualTo(RUN_ID);
        });
        assertThat(run.getCompletedAt()).isEqualTo(T0.plusSeconds(30));
        assertThat(run.getCardCount()).isEqualTo(10);
        assertThat(run.getCorrectCount()).isEqualTo(8);
        assertThat(run.getXpAwarded()).isEqualTo(40);
        assertThat(run.getXpReason()).isEqualTo("FULL");
        assertThat(run.getResultsJson()).contains("\"cardId\":1001");
    }

    @Test
    void complete_summaryListsEveryCardWithFrontBackAndResult() {
        FlashcardRun run = startedRun(FlashcardRunMode.REVIEW);

        FlashcardRunResult result = complete(run, Duration.ofSeconds(30), results(5, 4));

        assertThat(result.cards()).hasSize(5);
        assertThat(result.cards().get(0)).isEqualTo(new RunCardDto(1001L, "front 1", "back 1", true));
        assertThat(result.cards().get(4)).isEqualTo(new RunCardDto(1005L, "front 5", "back 5", false));
    }

    @Test
    void complete_accuracyJustUnderEightyPercent_getsNoBonus() {
        FlashcardRun run = startedRun(FlashcardRunMode.REVIEW);

        FlashcardRunResult result = complete(run, Duration.ofSeconds(30), results(10, 7));

        assertThat(result.xpAwarded()).isEqualTo(20);
        assertThat(result.xpReason()).isEqualTo(XpReason.FULL);
    }

    @Test
    void complete_learnMode_getsAccuracyBonus() {
        FlashcardRun run = startedRun(FlashcardRunMode.LEARN);

        assertThat(complete(run, Duration.ofSeconds(10), results(5, 5)).xpAwarded()).isEqualTo(30);
    }

    @Test
    void complete_memoryMode_getsNoAccuracyBonus() {
        FlashcardRun run = startedRun(FlashcardRunMode.MEMORY);

        assertThat(complete(run, Duration.ofSeconds(20), results(10, 10)).xpAwarded()).isEqualTo(20);
    }

    @Test
    void complete_matchMode_getsNoAccuracyBonus() {
        FlashcardRun run = startedRun(FlashcardRunMode.MATCH);

        assertThat(complete(run, Duration.ofSeconds(20), results(10, 10)).xpAwarded()).isEqualTo(20);
    }

    @Test
    void complete_fiftyCards_capsBaseAtFortyCards() {
        FlashcardRun memory = startedRun(FlashcardRunMode.MEMORY);
        assertThat(complete(memory, Duration.ofSeconds(100), results(50, 50)).xpAwarded()).isEqualTo(80);

        at(T0);
        FlashcardRun review = startedRun(FlashcardRunMode.REVIEW);
        assertThat(complete(review, Duration.ofSeconds(100), results(50, 50)).xpAwarded()).isEqualTo(100);
    }

    @Test
    void complete_fourCards_isTooFewButStillSummarised() {
        FlashcardRun run = startedRun(FlashcardRunMode.REVIEW);

        FlashcardRunResult result = complete(run, Duration.ofSeconds(60), results(4, 4));

        assertThat(result.xpReason()).isEqualTo(XpReason.TOO_FEW);
        assertThat(result.xpAwarded()).isZero();
        assertThat(result.cards()).hasSize(4);
        assertThat(xpEvents).isEmpty();
        assertThat(run.getCompletedAt()).isNotNull();
        assertThat(run.getXpReason()).isEqualTo("TOO_FEW");
    }

    @Test
    void complete_fiveCards_earnsXp() {
        FlashcardRun run = startedRun(FlashcardRunMode.MEMORY);

        FlashcardRunResult result = complete(run, Duration.ofSeconds(10), results(5, 5));

        assertThat(result.xpReason()).isEqualTo(XpReason.FULL);
        assertThat(result.xpAwarded()).isEqualTo(10);
    }

    @Test
    void complete_reviewUnderTwoSecondsPerCard_isTooFastButStillSummarised() {
        FlashcardRun run = startedRun(FlashcardRunMode.REVIEW);

        FlashcardRunResult result = complete(run, Duration.ofMillis(19_999), results(10, 10));

        assertThat(result.xpReason()).isEqualTo(XpReason.TOO_FAST);
        assertThat(result.xpAwarded()).isZero();
        assertThat(result.cards()).hasSize(10).allSatisfy(c -> assertThat(c.correct()).isTrue());
        assertThat(xpEvents).isEmpty();
    }

    @Test
    void complete_reviewAtTwoSecondsPerCard_isFull() {
        FlashcardRun run = startedRun(FlashcardRunMode.REVIEW);

        assertThat(complete(run, Duration.ofSeconds(20), results(10, 10)).xpReason()).isEqualTo(XpReason.FULL);
    }

    @Test
    void complete_memoryUnderTwoSecondsPerCard_isTooFast() {
        FlashcardRun run = startedRun(FlashcardRunMode.MEMORY);

        assertThat(complete(run, Duration.ofSeconds(19), results(10, 10)).xpReason()).isEqualTo(XpReason.TOO_FAST);
    }

    @Test
    void complete_learnUnderTwoSecondsPerCard_isTooFast() {
        FlashcardRun run = startedRun(FlashcardRunMode.LEARN);

        assertThat(complete(run, Duration.ofSeconds(19), results(10, 10)).xpReason()).isEqualTo(XpReason.TOO_FAST);
    }

    @Test
    void complete_matchAtOneSecondPerCard_isFull() {
        FlashcardRun run = startedRun(FlashcardRunMode.MATCH);

        FlashcardRunResult result = complete(run, Duration.ofSeconds(10), results(10, 10));

        assertThat(result.xpReason()).isEqualTo(XpReason.FULL);
        assertThat(result.xpAwarded()).isEqualTo(20);
    }

    @Test
    void complete_matchUnderOneSecondPerCard_isTooFast() {
        FlashcardRun run = startedRun(FlashcardRunMode.MATCH);

        assertThat(complete(run, Duration.ofMillis(9_999), results(10, 10)).xpReason())
                .isEqualTo(XpReason.TOO_FAST);
    }

    @Test
    void complete_secondEarningRunOfSetToday_isReduced() {
        when(runRepository.countByUserIdAndSetIdAndLocalDateAndXpAwardedGreaterThan(1L, SET_ID, TODAY, 0))
                .thenReturn(1L);
        FlashcardRun run = startedRun(FlashcardRunMode.REVIEW);

        FlashcardRunResult result = complete(run, Duration.ofSeconds(30), results(10, 10));

        assertThat(result.xpReason()).isEqualTo(XpReason.REDUCED);
        assertThat(result.xpAwarded()).isEqualTo(20);
    }

    @Test
    void complete_thirdEarningRunOfSetToday_isRepeat() {
        when(runRepository.countByUserIdAndSetIdAndLocalDateAndXpAwardedGreaterThan(1L, SET_ID, TODAY, 0))
                .thenReturn(2L);
        FlashcardRun run = startedRun(FlashcardRunMode.REVIEW);

        FlashcardRunResult result = complete(run, Duration.ofSeconds(30), results(10, 10));

        assertThat(result.xpReason()).isEqualTo(XpReason.REPEAT);
        assertThat(result.xpAwarded()).isZero();
        assertThat(xpEvents).isEmpty();
        verify(random, never()).nextDouble();
    }

    @Test
    void complete_repeatFactorCountsOnlyEarlierRunsThatEarnedXp() {
        FlashcardRun run = startedRun(FlashcardRunMode.REVIEW);

        FlashcardRunResult result = complete(run, Duration.ofSeconds(30), results(10, 10));

        assertThat(result.xpReason()).isEqualTo(XpReason.FULL);
        verify(runRepository).countByUserIdAndSetIdAndLocalDateAndXpAwardedGreaterThan(1L, SET_ID, TODAY, 0);
        verify(runRepository, never()).countByUserIdAndSetIdAndLocalDateAndCompletedAtIsNotNull(any(), any(), any());
    }

    @Test
    void complete_nearDailyCap_grantsPartialXp() {
        when(runRepository.sumXpByUserIdAndLocalDate(1L, TODAY)).thenReturn(290);
        FlashcardRun run = startedRun(FlashcardRunMode.REVIEW);

        FlashcardRunResult result = complete(run, Duration.ofSeconds(30), results(10, 10));

        assertThat(result.xpReason()).isEqualTo(XpReason.DAILY_CAP);
        assertThat(result.xpAwarded()).isEqualTo(10);
        assertThat(result.delta().xpGained()).isEqualTo(10);
    }

    @Test
    void complete_atDailyCap_grantsNothing() {
        when(runRepository.sumXpByUserIdAndLocalDate(1L, TODAY)).thenReturn(300);
        FlashcardRun run = startedRun(FlashcardRunMode.REVIEW);

        FlashcardRunResult result = complete(run, Duration.ofSeconds(30), results(10, 10));

        assertThat(result.xpReason()).isEqualTo(XpReason.DAILY_CAP);
        assertThat(result.xpAwarded()).isZero();
        assertThat(xpEvents).isEmpty();
    }

    @Test
    void complete_reducedRunHittingCap_isDailyCap() {
        when(runRepository.countByUserIdAndSetIdAndLocalDateAndXpAwardedGreaterThan(1L, SET_ID, TODAY, 0))
                .thenReturn(1L);
        when(runRepository.sumXpByUserIdAndLocalDate(1L, TODAY)).thenReturn(295);
        FlashcardRun run = startedRun(FlashcardRunMode.REVIEW);

        FlashcardRunResult result = complete(run, Duration.ofSeconds(30), results(10, 10));

        assertThat(result.xpReason()).isEqualTo(XpReason.DAILY_CAP);
        assertThat(result.xpAwarded()).isEqualTo(5);
    }

    @Test
    void complete_foreignCardId_throwsBadRequest() {
        FlashcardRun run = startedRun(FlashcardRunMode.REVIEW);
        List<CardResult> results = new ArrayList<>(results(5, 5));
        results.add(new CardResult(9999L, true));

        assertThatThrownBy(() -> complete(run, Duration.ofSeconds(30), results))
                .isInstanceOf(BadRequestException.class);
        assertThat(run.getCompletedAt()).isNull();
        assertThat(xpEvents).isEmpty();
    }

    @Test
    void complete_duplicateCardIds_throwsBadRequest() {
        FlashcardRun run = startedRun(FlashcardRunMode.REVIEW);
        List<CardResult> results = new ArrayList<>(results(5, 5));
        results.add(new CardResult(1001L, false));

        assertThatThrownBy(() -> complete(run, Duration.ofSeconds(30), results))
                .isInstanceOf(BadRequestException.class);
        assertThat(run.getCompletedAt()).isNull();
    }

    @Test
    void complete_twice_throwsConflict() {
        FlashcardRun run = startedRun(FlashcardRunMode.REVIEW);
        complete(run, Duration.ofSeconds(30), results(10, 10));

        assertThatThrownBy(() -> complete(run, Duration.ofSeconds(40), results(10, 10)))
                .isInstanceOf(ConflictException.class);
        assertThat(xpEvents).hasSize(1);
        assertThat(run.getCompletedAt()).isEqualTo(T0.plusSeconds(30));
    }

    @Test
    void complete_anotherUsersRun_throwsNotFound() {
        FlashcardRun theirs = new FlashcardRun();
        theirs.setId(80L);
        theirs.setUser(user(2L));
        theirs.setSet(ownSet);
        theirs.setMode(FlashcardRunMode.REVIEW);
        theirs.setStartedAt(T0);
        theirs.setLocalDate(TODAY);
        runs.add(theirs);
        at(T0.plusSeconds(60));

        assertThatThrownBy(() -> service.complete(80L, results(10, 10))).isInstanceOf(NotFoundException.class);
        assertThat(theirs.getCompletedAt()).isNull();
    }

    @Test
    void complete_afterThreeHours_throwsBadRequest() {
        FlashcardRun run = startedRun(FlashcardRunMode.REVIEW);

        assertThatThrownBy(() -> complete(run, Duration.ofHours(3).plusSeconds(1), results(10, 10)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void complete_atThreeHours_isAccepted() {
        FlashcardRun run = startedRun(FlashcardRunMode.REVIEW);

        assertThat(complete(run, Duration.ofHours(3), results(10, 10)).xpReason()).isEqualTo(XpReason.FULL);
    }

    @Test
    void complete_tenCardsWithXp_dropsFlashcardChestUnderTwentyPercent() {
        when(random.nextDouble()).thenReturn(0.1999);
        FlashcardRun run = startedRun(FlashcardRunMode.REVIEW);

        FlashcardRunResult result = complete(run, Duration.ofSeconds(30), results(10, 10));

        assertThat(chests).singleElement().satisfies(c -> {
            assertThat(c.getSource()).isEqualTo(ChestSource.FLASHCARD);
            assertThat(c.getSourceRef()).isEqualTo("run:" + RUN_ID);
            assertThat(c.getLocalDate()).isEqualTo(TODAY);
        });
        assertThat(result.delta().chests()).hasSize(1);
    }

    @Test
    void complete_rollAtTwentyPercent_dropsNothing() {
        when(random.nextDouble()).thenReturn(0.2);
        FlashcardRun run = startedRun(FlashcardRunMode.REVIEW);

        complete(run, Duration.ofSeconds(30), results(10, 10));

        verify(random).nextDouble();
        assertThat(chests).isEmpty();
    }

    @Test
    void complete_nineCards_doesNotRollChest() {
        when(random.nextDouble()).thenReturn(0.0);
        FlashcardRun run = startedRun(FlashcardRunMode.REVIEW);

        complete(run, Duration.ofSeconds(30), results(9, 9));

        verify(random, never()).nextDouble();
        assertThat(chests).isEmpty();
    }

    @Test
    void complete_tenCardsTooFast_doesNotRollChest() {
        when(random.nextDouble()).thenReturn(0.0);
        FlashcardRun run = startedRun(FlashcardRunMode.REVIEW);

        complete(run, Duration.ofSeconds(5), results(10, 10));

        verify(random, never()).nextDouble();
        assertThat(chests).isEmpty();
    }

    @Test
    void complete_twoFlashcardChestsAlreadyDroppedOnRunLocalDate_skipsRoll() {
        when(random.nextDouble()).thenReturn(0.0);
        when(chestRepository.countByUserIdAndSourceAndLocalDate(1L, ChestSource.FLASHCARD, TODAY)).thenReturn(2L);
        FlashcardRun run = startedRun(FlashcardRunMode.REVIEW);

        complete(run, Duration.ofSeconds(30), results(10, 10));

        verify(random, never()).nextDouble();
        assertThat(chests).isEmpty();
    }

    @Test
    void complete_runFinishingAfterLocalMidnight_limitsChestByRunLocalDate() {
        when(random.nextDouble()).thenReturn(0.0);
        when(chestRepository.countByUserIdAndSourceAndCreatedAtBetween(anyLong(), any(), any(), any()))
                .thenReturn(1L);
        at(Instant.parse("2026-10-08T06:55:00Z"));
        FlashcardRun run = startedRun(FlashcardRunMode.REVIEW);

        complete(run, Duration.ofMinutes(10), results(10, 10));

        assertThat(run.getLocalDate()).isEqualTo(TODAY);
        verify(chestRepository).countByUserIdAndSourceAndLocalDate(1L, ChestSource.FLASHCARD, TODAY);
        assertThat(chests).singleElement().satisfies(c -> assertThat(c.getLocalDate()).isEqualTo(TODAY));
    }

    @Test
    void start_liveZoneChangedWithinSevenDays_usesProgressZoneForLocalDate() {
        Instant now = Instant.parse("2026-10-08T06:50:00Z");
        progress.setProgressZone("America/Vancouver");
        progress.setProgressZoneChangedAt(now.minus(Duration.ofDays(1)));
        me.setTimezone("Asia/Tokyo");
        at(now);

        FlashcardRun run = startedRun(FlashcardRunMode.MEMORY);

        assertThat(run.getLocalDate()).isEqualTo(TODAY);
        assertThat(progress.getProgressZone()).isEqualTo("America/Vancouver");
    }

    @Test
    void start_noProgressZoneYet_adoptsLiveZone() {
        startedRun(FlashcardRunMode.MEMORY);

        assertThat(progress.getProgressZone()).isEqualTo("America/Vancouver");
        assertThat(progress.getProgressZoneChangedAt()).isEqualTo(T0);
    }
}
