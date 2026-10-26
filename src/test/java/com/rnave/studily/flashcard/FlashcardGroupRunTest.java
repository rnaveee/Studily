package com.rnave.studily.flashcard;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.course.CourseService;
import com.rnave.studily.flashcard.FlashcardRunDtos.CardResult;
import com.rnave.studily.flashcard.FlashcardRunDtos.FlashcardRunResult;
import com.rnave.studily.flashcard.FlashcardRunDtos.XpReason;
import com.rnave.studily.friend.FriendRequestRepository;
import com.rnave.studily.progress.BadgeService;
import com.rnave.studily.progress.Chest;
import com.rnave.studily.progress.ChestRepository;
import com.rnave.studily.progress.ChestService;
import com.rnave.studily.progress.CoinTransactionRepository;
import com.rnave.studily.progress.FlairService;
import com.rnave.studily.progress.ProgressRateLimiter;
import com.rnave.studily.progress.ProgressService;
import com.rnave.studily.progress.UserProgress;
import com.rnave.studily.progress.UserProgressRepository;
import com.rnave.studily.progress.XpEvent;
import com.rnave.studily.progress.XpEventRepository;
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
import java.util.Collection;
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
import static org.mockito.Mockito.when;

class FlashcardGroupRunTest {

    private static final Instant T0 = Instant.parse("2026-10-07T17:00:00Z");
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 7);
    private static final long FOLDER = 5L;
    private static final long OTHER_FOLDER = 6L;
    private static final long COURSE = 3L;

    private FlashcardRunRepository runRepository;
    private FlashcardSetRepository setRepository;
    private UserProgressRepository userProgressRepository;
    private XpEventRepository xpEventRepository;
    private UserRepository userRepository;
    private ChestRepository chestRepository;
    private CurrentUser currentUser;
    private FlashcardRunService service;

    private final AtomicLong ids = new AtomicLong(70);
    private final List<FlashcardRun> runs = new ArrayList<>();
    private final Set<String> dedupeKeys = new HashSet<>();
    private final List<FlashcardSet> allSets = new ArrayList<>();
    private User me;
    private UserProgress progress;
    private FlashcardSet setA;
    private FlashcardSet setB;
    private FlashcardSet foreign;

    @BeforeEach
    void setUp() {
        runRepository = mock(FlashcardRunRepository.class);
        setRepository = mock(FlashcardSetRepository.class);
        userProgressRepository = mock(UserProgressRepository.class);
        xpEventRepository = mock(XpEventRepository.class);
        userRepository = mock(UserRepository.class);
        chestRepository = mock(ChestRepository.class);
        currentUser = mock(CurrentUser.class);

        me = user(1L);
        me.setTimezone("America/Vancouver");
        progress = new UserProgress();
        progress.setUserId(1L);
        setA = set(10L, me, 8, FOLDER, COURSE);
        setB = set(11L, me, 8, FOLDER, COURSE);
        foreign = set(99L, user(2L), 8, FOLDER, COURSE);
        allSets.addAll(List.of(setA, setB, foreign));

        when(currentUser.entity()).thenReturn(me);
        when(currentUser.id()).thenReturn(1L);
        when(userRepository.getReferenceById(1L)).thenReturn(me);
        when(userProgressRepository.findForUpdate(1L)).thenAnswer(inv -> Optional.of(progress));
        when(xpEventRepository.existsByDedupeKey(anyString()))
                .thenAnswer(inv -> dedupeKeys.contains(inv.<String>getArgument(0)));
        when(xpEventRepository.save(any(XpEvent.class))).thenAnswer(inv -> {
            XpEvent e = inv.getArgument(0);
            dedupeKeys.add(e.getDedupeKey());
            return e;
        });
        when(chestRepository.save(any(Chest.class))).thenAnswer(inv -> inv.getArgument(0));
        when(setRepository.findById(anyLong())).thenAnswer(inv -> allSets.stream()
                .filter(s -> s.getId().equals(inv.getArgument(0))).findFirst());
        when(setRepository.findByUserIdAndFolderIdOrderByCreatedAtDesc(anyLong(), anyLong())).thenAnswer(inv -> allSets.stream()
                .filter(s -> s.getUser().getId().equals(inv.getArgument(0)))
                .filter(s -> s.getFolder() != null && s.getFolder().getId().equals(inv.getArgument(1)))
                .toList());
        when(setRepository.findByUserIdAndCourseIdOrderByCreatedAtDesc(anyLong(), anyLong())).thenAnswer(inv -> allSets.stream()
                .filter(s -> s.getUser().getId().equals(inv.getArgument(0)))
                .filter(s -> s.getCourse() != null && s.getCourse().getId().equals(inv.getArgument(1)))
                .toList());
        when(runRepository.save(any(FlashcardRun.class))).thenAnswer(inv -> {
            FlashcardRun r = inv.getArgument(0);
            if (r.getId() == null) {
                r.setId(ids.incrementAndGet());
                runs.add(r);
            }
            return r;
        });
        when(runRepository.findByIdAndUserId(anyLong(), anyLong())).thenAnswer(inv -> runs.stream()
                .filter(r -> r.getId().equals(inv.getArgument(0)))
                .findFirst());
        when(runRepository.countByUserIdAndFolderIdAndLocalDateAndXpAwardedGreaterThan(anyLong(), anyLong(), any(), anyInt()))
                .thenAnswer(inv -> earning().stream()
                        .filter(r -> inv.getArgument(1).equals(r.getFolderId())).count());
        when(runRepository.countByUserIdAndCourseIdAndLocalDateAndXpAwardedGreaterThan(anyLong(), anyLong(), any(), anyInt()))
                .thenAnswer(inv -> earning().stream()
                        .filter(r -> inv.getArgument(1).equals(r.getCourseId())).count());
        when(runRepository.countByUserIdAndSetIdAndLocalDateAndXpAwardedGreaterThan(anyLong(), anyLong(), any(), anyInt()))
                .thenAnswer(inv -> earning().stream()
                        .filter(r -> r.getSet() != null && r.getSet().getId().equals(inv.getArgument(1))).count());
        when(runRepository.countGroupRunsCovering(anyLong(), anyLong(), any())).thenAnswer(inv -> earning().stream()
                .filter(r -> r.getCoveredSetIds().contains(inv.<Long>getArgument(1))).count());
        when(runRepository.countSetRunsBySet(anyLong(), any(), any())).thenAnswer(inv -> {
            Collection<Long> wanted = inv.getArgument(1);
            return wanted.stream()
                    .map(id -> new Object[] {id, earning().stream()
                            .filter(r -> r.getSet() != null && r.getSet().getId().equals(id)).count()})
                    .filter(row -> (Long) row[1] > 0)
                    .toList();
        });
        when(runRepository.countGroupRunsCoveringSets(anyLong(), any(), any())).thenAnswer(inv -> {
            Collection<Long> wanted = inv.getArgument(1);
            return wanted.stream()
                    .map(id -> new Object[] {id, earning().stream()
                            .filter(r -> r.getCoveredSetIds().contains(id)).count()})
                    .filter(row -> (Long) row[1] > 0)
                    .toList();
        });
        when(runRepository.sumXpByUserIdAndLocalDate(anyLong(), any())).thenAnswer(inv -> runs.stream()
                .mapToInt(FlashcardRun::getXpAwarded).sum());

        at(T0);
    }

    private static int anyInt() {
        return org.mockito.ArgumentMatchers.anyInt();
    }

    private List<FlashcardRun> earning() {
        return runs.stream().filter(r -> r.getXpAwarded() > 0).toList();
    }

    private void at(Instant instant) {
        Clock clock = Clock.fixed(instant, ZoneOffset.UTC);
        UserTimeZones timeZones = new UserTimeZones(userRepository, "UTC");
        ProgressService progressService = new ProgressService(userProgressRepository, xpEventRepository,
                mock(CoinTransactionRepository.class), chestRepository, userRepository, mock(BadgeService.class),
                mock(FlairService.class), timeZones, currentUser, clock);
        RandomGenerator random = mock(RandomGenerator.class);
        when(random.nextDouble()).thenReturn(0.99);
        ChestService chestService = new ChestService(chestRepository, progressService, mock(BadgeService.class),
                mock(FlairService.class), currentUser, clock, random);
        FlashcardSetService setService = new FlashcardSetService(setRepository, currentUser,
                mock(CourseService.class), mock(FriendRequestRepository.class), mock(Flairs.class),
                mock(FlashcardImageRepository.class));
        service = new FlashcardRunService(runRepository, setService, progressService, chestService,
                new ProgressRateLimiter(), currentUser, clock, new ObjectMapper());
    }

    private static User user(Long id) {
        User u = new User();
        u.setId(id);
        u.setUsername("user" + id);
        return u;
    }

    private static FlashcardSet set(long id, User owner, int cardCount, Long folderId, Long courseId) {
        FlashcardSet set = new FlashcardSet();
        set.setId(id);
        set.setUser(owner);
        set.setTitle("Set " + id);
        set.setVisibility(FlashcardSetVisibility.PRIVATE);
        if (folderId != null) {
            FlashcardFolder folder = new FlashcardFolder();
            folder.setId(folderId);
            set.setFolder(folder);
        }
        if (courseId != null) {
            com.rnave.studily.course.Course course = new com.rnave.studily.course.Course();
            course.setId(courseId);
            set.setCourse(course);
        }
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

    private static void moveTo(FlashcardSet set, Long folderId) {
        if (folderId == null) {
            set.setFolder(null);
            return;
        }
        FlashcardFolder folder = new FlashcardFolder();
        folder.setId(folderId);
        set.setFolder(folder);
    }

    private static List<CardResult> across(FlashcardSet... sets) {
        List<CardResult> results = new ArrayList<>();
        for (FlashcardSet s : sets) {
            for (Flashcard c : s.getCards()) {
                results.add(new CardResult(c.getId(), true));
            }
        }
        return results;
    }

    private FlashcardRunResult finish(Long runId, List<CardResult> results) {
        FlashcardRun run = runs.stream().filter(r -> r.getId().equals(runId)).findFirst().orElseThrow();
        at(run.getStartedAt().plus(Duration.ofMinutes(5)));
        FlashcardRunResult result = service.complete(runId, results);
        at(T0);
        return result;
    }

    private FlashcardRunResult folderRun(Long folderId, List<CardResult> results) {
        return finish(service.startGroup(FlashcardRunMode.REVIEW, folderId, null).runId(), results);
    }

    private FlashcardRunResult setRun(FlashcardSet set) {
        return finish(service.start(set.getId(), FlashcardRunMode.REVIEW).runId(), across(set));
    }

    @Test
    void startGroup_folder_savesGroupRunWithoutSet() {
        service.startGroup(FlashcardRunMode.REVIEW, FOLDER, null);

        assertThat(runs).singleElement().satisfies(r -> {
            assertThat(r.getSet()).isNull();
            assertThat(r.getFolderId()).isEqualTo(FOLDER);
            assertThat(r.getCourseId()).isNull();
            assertThat(r.getLocalDate()).isEqualTo(TODAY);
        });
    }

    @Test
    void startGroup_needsExactlyOneScope() {
        assertThatThrownBy(() -> service.startGroup(FlashcardRunMode.REVIEW, null, null))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.startGroup(FlashcardRunMode.REVIEW, FOLDER, COURSE))
                .isInstanceOf(BadRequestException.class);
        assertThat(runs).isEmpty();
    }

    @Test
    void startGroup_emptyOrForeignFolder_isRejected() {
        assertThatThrownBy(() -> service.startGroup(FlashcardRunMode.REVIEW, 404L, null))
                .isInstanceOf(BadRequestException.class);
        assertThat(runs).isEmpty();
    }

    @Test
    void startGroup_foreignSetsInFolderAreIgnored() {
        moveTo(setA, null);
        moveTo(setB, null);

        assertThatThrownBy(() -> service.startGroup(FlashcardRunMode.REVIEW, FOLDER, null))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void complete_folderRun_paysLikeOneSetRun() {
        FlashcardRunResult result = folderRun(FOLDER, across(setA, setB));

        assertThat(result.xpReason()).isEqualTo(XpReason.FULL);
        assertThat(result.xpAwarded()).isEqualTo(2 * 16 + 20);
        assertThat(runs.get(0).getCoveredSetIds()).containsExactlyInAnyOrder(10L, 11L);
    }

    @Test
    void complete_cardOfAnotherUser_isRejected() {
        List<CardResult> results = new ArrayList<>(across(setA));
        results.add(new CardResult(foreign.getCards().get(0).getId(), true));

        assertThatThrownBy(() -> folderRun(FOLDER, results)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void complete_cardFromSetMovedOutOfFolder_isRejected() {
        long runId = service.startGroup(FlashcardRunMode.REVIEW, FOLDER, null).runId();
        moveTo(setB, OTHER_FOLDER);

        assertThatThrownBy(() -> finish(runId, across(setA, setB))).isInstanceOf(BadRequestException.class);
    }

    @Test
    void complete_courseRun_validatesAgainstCourseSets() {
        long runId = service.startGroup(FlashcardRunMode.REVIEW, null, COURSE).runId();

        FlashcardRunResult result = finish(runId, across(setA, setB));

        assertThat(result.xpReason()).isEqualTo(XpReason.FULL);
        assertThat(runs.get(0).getCourseId()).isEqualTo(COURSE);
    }

    @Test
    void complete_manyCards_stillScoresAtMostFortyCards() {
        FlashcardSet big = set(12L, me, 60, FOLDER, COURSE);
        allSets.add(big);

        FlashcardRunResult result = folderRun(FOLDER, across(big));

        assertThat(result.xpAwarded()).isEqualTo(2 * 40 + 20);
    }

    @Test
    void complete_repeatFolderRunsAreDampedLikeSets() {
        assertThat(folderRun(FOLDER, across(setA, setB)).xpReason()).isEqualTo(XpReason.FULL);
        FlashcardRunResult second = folderRun(FOLDER, across(setA, setB));
        assertThat(second.xpReason()).isEqualTo(XpReason.REDUCED);
        assertThat(second.xpAwarded()).isEqualTo(26);
        FlashcardRunResult third = folderRun(FOLDER, across(setA, setB));
        assertThat(third.xpReason()).isEqualTo(XpReason.REPEAT);
        assertThat(third.xpAwarded()).isZero();
    }

    @Test
    void complete_folderRunAfterTwoSetRuns_isRepeat() {
        setRun(setA);
        setRun(setA);

        FlashcardRunResult result = folderRun(FOLDER, across(setA, setB));

        assertThat(result.xpReason()).isEqualTo(XpReason.REPEAT);
        assertThat(result.xpAwarded()).isZero();
    }

    @Test
    void complete_setRunAfterFolderRun_isReduced() {
        folderRun(FOLDER, across(setA, setB));

        FlashcardRunResult result = setRun(setA);

        assertThat(result.xpReason()).isEqualTo(XpReason.REDUCED);
    }

    @Test
    void complete_courseRunAfterFolderRunOverSameSets_isReduced() {
        folderRun(FOLDER, across(setA, setB));

        FlashcardRunResult result = finish(service.startGroup(FlashcardRunMode.REVIEW, null, COURSE).runId(),
                across(setA, setB));

        assertThat(result.xpReason()).isEqualTo(XpReason.REDUCED);
    }

    @Test
    void complete_movingSetsToAnotherFolderDoesNotResetDamping() {
        folderRun(FOLDER, across(setA, setB));
        moveTo(setA, OTHER_FOLDER);
        moveTo(setB, OTHER_FOLDER);

        FlashcardRunResult result = folderRun(OTHER_FOLDER, across(setA, setB));

        assertThat(result.xpReason()).isEqualTo(XpReason.REDUCED);
    }

    @Test
    void complete_runAlreadyOneSetAwayFromFolder_cannotSplitIntoFreshScopes() {
        folderRun(FOLDER, across(setA, setB));
        moveTo(setA, OTHER_FOLDER);
        folderRun(OTHER_FOLDER, across(setA));
        moveTo(setA, FOLDER);

        FlashcardRunResult result = folderRun(FOLDER, across(setA, setB));

        assertThat(result.xpReason()).isEqualTo(XpReason.REPEAT);
    }

    @Test
    void complete_groupRunWithTooFewCards_paysNothing() {
        FlashcardRunResult result = folderRun(FOLDER, across(setA).subList(0, 3));

        assertThat(result.xpReason()).isEqualTo(XpReason.TOO_FEW);
        assertThat(result.xpAwarded()).isZero();
    }

    @Test
    void complete_groupRunCountsAgainstDailyCap() {
        when(runRepository.sumXpByUserIdAndLocalDate(anyLong(), any())).thenReturn(290);

        FlashcardRunResult result = folderRun(FOLDER, across(setA, setB));

        assertThat(result.xpReason()).isEqualTo(XpReason.DAILY_CAP);
        assertThat(result.xpAwarded()).isEqualTo(10);
    }

    @Test
    void complete_deletedFolderRun_isRejected() {
        long runId = service.startGroup(FlashcardRunMode.REVIEW, FOLDER, null).runId();
        runs.get(0).setFolderId(null);

        assertThatThrownBy(() -> finish(runId, across(setA))).isInstanceOf(BadRequestException.class);
    }
}
