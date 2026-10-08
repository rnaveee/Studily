package com.rnave.studily.studysession;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.progress.BadgeService;
import com.rnave.studily.progress.Chest;
import com.rnave.studily.progress.ChestRepository;
import com.rnave.studily.progress.ChestService;
import com.rnave.studily.progress.ChestSource;
import com.rnave.studily.progress.CoinTransactionRepository;
import com.rnave.studily.progress.FlairService;
import com.rnave.studily.progress.ProgressDeltaBuilder;
import com.rnave.studily.progress.ProgressRateLimiter;
import com.rnave.studily.progress.ProgressService;
import com.rnave.studily.progress.UserProgress;
import com.rnave.studily.progress.UserProgressRepository;
import com.rnave.studily.progress.XpEvent;
import com.rnave.studily.progress.XpEventRepository;
import com.rnave.studily.progress.XpSource;
import com.rnave.studily.studysession.StudySessionDtos.StartSessionRequest;
import com.rnave.studily.studysession.StudySessionDtos.StreakDayDto;
import com.rnave.studily.studysession.StudySessionDtos.StreakWeekDto;
import com.rnave.studily.studysession.StudySessionDtos.StudySessionDto;
import com.rnave.studily.studysession.StudySessionDtos.StudySessionResult;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import com.rnave.studily.user.UserTimeZones;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.SliceImpl;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;
import java.util.random.RandomGenerator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class StudySessionServiceTest {

    private static final Instant T0 = Instant.parse("2026-10-07T17:00:00Z");
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 7);

    private StudySessionRepository sessionRepository;
    private StudySessionBlockRepository blockRepository;
    private StudySessionTaskRepository taskRepository;
    private UserProgressRepository userProgressRepository;
    private XpEventRepository xpEventRepository;
    private CoinTransactionRepository coinTransactionRepository;
    private ChestRepository chestRepository;
    private UserRepository userRepository;
    private BadgeService badgeService;
    private FlairService flairService;
    private RandomGenerator random;
    private ChestService chestService;
    private CurrentUser currentUser;
    private UserTimeZones timeZones;
    private ProgressRateLimiter rateLimiter;
    private StudySessionService service;

    private final AtomicLong ids = new AtomicLong(100);
    private final List<StudySession> sessions = new ArrayList<>();
    private final List<StudySessionBlock> blocks = new ArrayList<>();
    private final List<StudySessionTask> tasks = new ArrayList<>();
    private final List<XpEvent> xpEvents = new ArrayList<>();
    private final Set<String> dedupeKeys = new HashSet<>();
    private final List<Chest> chests = new ArrayList<>();
    private final Map<LocalDate, Integer> earlierMinutes = new HashMap<>();
    private final Map<LocalDate, Integer> earlierPaidTasks = new HashMap<>();
    private User user;
    private UserProgress progress;

    @BeforeEach
    void setUp() {
        sessionRepository = mock(StudySessionRepository.class);
        blockRepository = mock(StudySessionBlockRepository.class);
        taskRepository = mock(StudySessionTaskRepository.class);
        userProgressRepository = mock(UserProgressRepository.class);
        xpEventRepository = mock(XpEventRepository.class);
        coinTransactionRepository = mock(CoinTransactionRepository.class);
        chestRepository = mock(ChestRepository.class);
        userRepository = mock(UserRepository.class);
        badgeService = mock(BadgeService.class);
        flairService = mock(FlairService.class);
        random = mock(RandomGenerator.class);
        currentUser = mock(CurrentUser.class);
        timeZones = new UserTimeZones(userRepository, "UTC");
        rateLimiter = new ProgressRateLimiter();

        user = new User();
        user.setId(1L);
        user.setTimezone("America/Vancouver");
        progress = new UserProgress();
        progress.setUserId(1L);

        when(currentUser.entity()).thenReturn(user);
        when(currentUser.id()).thenReturn(1L);
        when(userRepository.getReferenceById(1L)).thenReturn(user);
        when(userProgressRepository.findForUpdate(1L)).thenAnswer(inv -> Optional.of(progress));
        when(userProgressRepository.findById(1L)).thenAnswer(inv -> Optional.of(progress));
        when(xpEventRepository.existsByDedupeKey(anyString()))
                .thenAnswer(inv -> dedupeKeys.contains(inv.<String>getArgument(0)));
        when(xpEventRepository.save(any(XpEvent.class))).thenAnswer(inv -> {
            XpEvent e = inv.getArgument(0);
            dedupeKeys.add(e.getDedupeKey());
            xpEvents.add(e);
            return e;
        });
        when(chestRepository.save(any(Chest.class))).thenAnswer(inv -> {
            chests.add(inv.getArgument(0));
            return inv.getArgument(0);
        });
        when(badgeService.evaluate(anyLong())).thenReturn(List.of());
        when(random.nextDouble()).thenReturn(0.99);

        when(sessionRepository.save(any(StudySession.class))).thenAnswer(inv -> {
            StudySession s = inv.getArgument(0);
            if (s.getId() == null) {
                s.setId(ids.incrementAndGet());
                sessions.add(s);
            }
            return s;
        });
        when(sessionRepository.findByIdAndUserId(anyLong(), anyLong())).thenAnswer(inv -> sessions.stream()
                .filter(s -> s.getId().equals(inv.getArgument(0))
                        && s.getUser().getId().equals(inv.getArgument(1)))
                .findFirst());
        when(sessionRepository.findFirstByUserIdAndStatusIn(anyLong(), any())).thenAnswer(inv -> {
            Collection<StudySessionStatus> statuses = inv.getArgument(1);
            return sessions.stream().filter(s -> statuses.contains(s.getStatus())).findFirst();
        });
        when(sessionRepository.sumCreditedMinutesByUserIdAndLocalDate(eq(1L), any(LocalDate.class)))
                .thenAnswer(inv -> {
                    LocalDate day = inv.getArgument(1);
                    return earlierMinutes.getOrDefault(day, 0) + sessions.stream()
                            .filter(s -> s.getLocalDate().equals(day))
                            .mapToInt(StudySession::getCreditedMinutes)
                            .sum();
                });

        when(blockRepository.save(any(StudySessionBlock.class))).thenAnswer(inv -> {
            StudySessionBlock b = inv.getArgument(0);
            if (b.getId() == null) {
                b.setId(ids.incrementAndGet());
                blocks.add(b);
            }
            return b;
        });
        when(blockRepository.findById(anyLong())).thenAnswer(inv -> blocks.stream()
                .filter(b -> b.getId().equals(inv.getArgument(0))).findFirst());
        when(blockRepository.findBySessionIdAndBlockIndex(anyLong(), any(Integer.class))).thenAnswer(inv -> blocks.stream()
                .filter(b -> b.getSession().getId().equals(inv.getArgument(0))
                        && b.getBlockIndex() == inv.<Integer>getArgument(1))
                .findFirst());
        when(blockRepository.findBySessionIdOrderByBlockIndex(anyLong())).thenAnswer(inv -> blocks.stream()
                .filter(b -> b.getSession().getId().equals(inv.getArgument(0)))
                .sorted(Comparator.comparingInt(StudySessionBlock::getBlockIndex))
                .toList());
        doAnswer(inv -> {
            blocks.remove(inv.<StudySessionBlock>getArgument(0));
            return null;
        }).when(blockRepository).delete(any(StudySessionBlock.class));

        when(taskRepository.save(any(StudySessionTask.class))).thenAnswer(inv -> {
            StudySessionTask t = inv.getArgument(0);
            if (t.getId() == null) {
                t.setId(ids.incrementAndGet());
                tasks.add(t);
            }
            return t;
        });
        when(taskRepository.findBySessionIdOrderByPosition(anyLong())).thenAnswer(inv -> tasks.stream()
                .filter(t -> t.getSession().getId().equals(inv.getArgument(0)))
                .sorted(Comparator.comparingInt(StudySessionTask::getPosition))
                .toList());
        when(taskRepository.findByIdAndSessionId(anyLong(), anyLong())).thenAnswer(inv -> tasks.stream()
                .filter(t -> t.getId().equals(inv.getArgument(0))
                        && t.getSession().getId().equals(inv.getArgument(1)))
                .findFirst());
        when(taskRepository.countPaidByUserIdAndLocalDate(eq(1L), any(LocalDate.class))).thenAnswer(inv -> {
            LocalDate day = inv.getArgument(1);
            return earlierPaidTasks.getOrDefault(day, 0) + tasks.stream()
                    .filter(t -> t.getSession().getLocalDate().equals(day) && t.getXpAwarded() > 0)
                    .count();
        });

        at(T0);
    }

    private void at(Instant instant) {
        Clock clock = Clock.fixed(instant, ZoneOffset.UTC);
        ProgressService progressService = new ProgressService(userProgressRepository, xpEventRepository,
                coinTransactionRepository, chestRepository, userRepository, badgeService, flairService, timeZones,
                currentUser, clock);
        chestService = spy(new ChestService(chestRepository, progressService, badgeService, flairService,
                currentUser, clock, random));
        service = new StudySessionService(sessionRepository, blockRepository, taskRepository, progressService,
                chestService, rateLimiter, currentUser, clock);
    }

    private void at(Duration sinceStart) {
        at(T0.plus(sinceStart));
    }

    private static Duration min(long minutes) {
        return Duration.ofMinutes(minutes);
    }

    private StudySession startPomodoro(Integer blockCount, String... taskTexts) {
        StudySessionDto dto = service.start(
                new StartSessionRequest(StudySessionMode.POMODORO, blockCount, null, List.of(taskTexts)));
        return session(dto.id());
    }

    private StudySession startTimer(Integer minutes) {
        StudySessionDto dto = service.start(
                new StartSessionRequest(StudySessionMode.TIMER, null, minutes, List.of()));
        return session(dto.id());
    }

    private StudySession session(Long id) {
        return sessions.stream().filter(s -> s.getId().equals(id)).findFirst().orElseThrow();
    }

    private StudySessionBlock block(StudySession session, int index) {
        return blocks.stream()
                .filter(b -> b.getSession() == session && b.getBlockIndex() == index)
                .findFirst()
                .orElseThrow();
    }

    private StudySessionTask task(StudySession session, int position) {
        return tasks.stream()
                .filter(t -> t.getSession() == session && t.getPosition() == position)
                .findFirst()
                .orElseThrow();
    }

    private int xp(XpSource source) {
        return xpEvents.stream().filter(e -> e.getSource() == source).mapToInt(XpEvent::getAmount).sum();
    }

    private void streak(int current, LocalDate last) {
        progress.setStreakCurrent(current);
        progress.setStreakBest(current);
        progress.setStreakLastDate(last);
    }

    @Test
    void start_withoutMode_throwsBadRequest() {
        assertThatThrownBy(() -> service.start(new StartSessionRequest(null, 5, null, List.of())))
                .isInstanceOf(BadRequestException.class);
        assertThat(sessions).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(ints = {-1, 0, 9})
    void start_pomodoroBlocksOutOfRange_throwsBadRequest(int blockCount) {
        assertThatThrownBy(() -> startPomodoro(blockCount)).isInstanceOf(BadRequestException.class);
        assertThat(sessions).isEmpty();
    }

    @Test
    void start_pomodoroDefaults_createsFiveBlocksOfTwentyFive() {
        StudySessionDto dto = service.start(
                new StartSessionRequest(StudySessionMode.POMODORO, null, null, null));

        assertThat(dto.status()).isEqualTo(StudySessionStatus.ACTIVE);
        assertThat(dto.plannedBlocks()).isEqualTo(5);
        assertThat(dto.blockMinutes()).isEqualTo(25);
        assertThat(dto.breakMinutes()).isEqualTo(5);
        assertThat(dto.plannedMinutes()).isEqualTo(125);
        assertThat(dto.currentBlock()).isEqualTo(1);
        assertThat(dto.startedAt()).isEqualTo(T0);
        assertThat(dto.multiplier()).isEqualTo(1.0);
        assertThat(dto.serverNow()).isEqualTo(T0);
        assertThat(dto.tasks()).isEmpty();
        assertThat(dto.blocks()).singleElement().satisfies(b -> {
            assertThat(b.index()).isEqualTo(1);
            assertThat(b.status()).isEqualTo(StudyBlockStatus.RUNNING);
            assertThat(b.startedAt()).isEqualTo(T0);
            assertThat(b.dueAt()).isEqualTo(T0.plus(min(25)));
        });
        assertThat(dto.checkinOpensAt()).isEqualTo(T0.plus(min(25)).minusSeconds(60));
        assertThat(dto.checkinClosesAt()).isEqualTo(T0.plus(min(30)));
    }

    @Test
    void start_pomodoroBounds_acceptOneAndEightBlocks() {
        StudySession one = startPomodoro(1);
        assertThat(one.getPlannedMinutes()).isEqualTo(25);
        one.setStatus(StudySessionStatus.ENDED);

        StudySession eight = startPomodoro(8);
        assertThat(eight.getPlannedBlocks()).isEqualTo(8);
        assertThat(eight.getPlannedMinutes()).isEqualTo(200);
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 20, 45, 200, 210, 240})
    void start_timerMinutesNotAllowed_throwsBadRequest(int minutes) {
        assertThatThrownBy(() -> startTimer(minutes)).isInstanceOf(BadRequestException.class);
        assertThat(sessions).isEmpty();
    }

    @Test
    void start_timerDefault_createsFourThirtyMinuteBlocksWithoutBreaks() {
        StudySession s = startTimer(null);

        assertThat(s.getMode()).isEqualTo(StudySessionMode.TIMER);
        assertThat(s.getPlannedBlocks()).isEqualTo(4);
        assertThat(s.getBlockMinutes()).isEqualTo(30);
        assertThat(s.getBreakMinutes()).isZero();
        assertThat(s.getPlannedMinutes()).isEqualTo(120);
        assertThat(block(s, 1).getDueAt()).isEqualTo(T0.plus(min(30)));
    }

    @Test
    void start_timerSteps_mapToBlocks() {
        StudySession shortest = startTimer(30);
        assertThat(shortest.getPlannedBlocks()).isEqualTo(1);
        shortest.setStatus(StudySessionStatus.ENDED);

        StudySession longest = startTimer(180);
        assertThat(longest.getPlannedBlocks()).isEqualTo(6);
        assertThat(longest.getPlannedMinutes()).isEqualTo(180);
    }

    @Test
    void start_tasks_trimmedAndBlanksDropped() {
        StudySessionDto dto = service.start(new StartSessionRequest(StudySessionMode.POMODORO, 2, null,
                Arrays.asList("  Read chapter 3  ", "", "   ", null, "Essay outline")));

        assertThat(dto.tasks()).extracting(t -> t.text()).containsExactly("Read chapter 3", "Essay outline");
        assertThat(dto.tasks()).extracting(t -> t.position()).containsExactly(0, 1);
        assertThat(dto.tasks()).noneMatch(t -> t.done());
    }

    @Test
    void start_elevenTasks_throwsBadRequest() {
        String[] eleven = new String[11];
        Arrays.fill(eleven, "task");

        assertThatThrownBy(() -> startPomodoro(2, eleven)).isInstanceOf(BadRequestException.class);
        assertThat(sessions).isEmpty();
    }

    @Test
    void start_tenTasksPlusBlanks_isAccepted() {
        List<String> raw = new ArrayList<>(Collections.nCopies(10, "task"));
        raw.add(" ");
        raw.add("");

        StudySessionDto dto = service.start(new StartSessionRequest(StudySessionMode.POMODORO, 2, null, raw));

        assertThat(dto.tasks()).hasSize(10);
    }

    @Test
    void start_taskOverTwoHundredChars_throwsBadRequest() {
        assertThatThrownBy(() -> startPomodoro(2, "x".repeat(201))).isInstanceOf(BadRequestException.class);
    }

    @Test
    void start_taskOfTwoHundredCharsAfterTrim_isAccepted() {
        StudySession s = startPomodoro(2, "  " + "x".repeat(200) + "  ");

        assertThat(task(s, 0).getText()).hasSize(200);
    }

    @Test
    void start_whenSessionAlreadyActive_throwsConflict() {
        startPomodoro(2);

        assertThatThrownBy(() -> startPomodoro(2))
                .isInstanceOf(ConflictException.class)
                .hasMessage("You already have a study session running");
        assertThat(sessions).hasSize(1);
    }

    @Test
    void start_whenSessionPaused_throwsConflict() {
        startPomodoro(2).setStatus(StudySessionStatus.PAUSED);

        assertThatThrownBy(() -> startTimer(60)).isInstanceOf(ConflictException.class);
    }

    @Test
    void start_afterPreviousSessionEnded_isAllowed() {
        startPomodoro(2).setStatus(StudySessionStatus.COMPLETED);

        assertThat(startTimer(60).getStatus()).isEqualTo(StudySessionStatus.ACTIVE);
    }

    @Test
    void start_freezesMultiplierFromEffectiveStreak() {
        streak(3, TODAY.minusDays(1));

        StudySession s = startPomodoro(2);

        assertThat(s.getMultiplier()).isEqualByComparingTo("1.20");
    }

    @Test
    void start_staleStreak_usesBaseMultiplier() {
        streak(5, TODAY.minusDays(2));

        assertThat(startPomodoro(2).getMultiplier()).isEqualByComparingTo("1.00");
    }

    @Test
    void start_nearMidnightInVancouver_usesLocalStartDate() {
        at(Instant.parse("2026-10-08T06:50:00Z"));

        StudySession s = startPomodoro(2);

        assertThat(s.getLocalDate()).isEqualTo(TODAY);
    }

    @Test
    void checkin_beforeWindowOpens_throwsConflict() {
        StudySession s = startPomodoro(5);
        at(min(25).minusSeconds(61));

        assertThatThrownBy(() -> service.checkin(s.getId()))
                .isInstanceOf(ConflictException.class)
                .hasMessage("This block isn't finished yet");
        assertThat(block(s, 1).getStatus()).isEqualTo(StudyBlockStatus.RUNNING);
        assertThat(xpEvents).isEmpty();
    }

    @Test
    void checkin_atWindowOpen_creditsBlock() {
        StudySession s = startPomodoro(5);
        at(min(25).minusSeconds(60));

        service.checkin(s.getId());

        assertThat(block(s, 1).getStatus()).isEqualTo(StudyBlockStatus.CONFIRMED);
    }

    @Test
    void checkin_atLateEdge_creditsBlock() {
        StudySession s = startPomodoro(5);
        at(min(30));

        service.checkin(s.getId());

        assertThat(block(s, 1).getStatus()).isEqualTo(StudyBlockStatus.CONFIRMED);
    }

    @Test
    void checkin_afterLateEdge_throwsExpired() {
        StudySession s = startPomodoro(5);
        at(min(30).plusSeconds(1));

        assertThatThrownBy(() -> service.checkin(s.getId()))
                .isInstanceOf(ConflictException.class)
                .hasMessage("This block expired");
        assertThat(xpEvents).isEmpty();
    }

    @Test
    void checkin_insideWindow_creditsBlockXpAndStartsNextAfterBreak() {
        StudySession s = startPomodoro(5);
        StudySessionBlock first = block(s, 1);
        at(min(25));

        StudySessionResult result = service.checkin(s.getId());

        assertThat(first.getStatus()).isEqualTo(StudyBlockStatus.CONFIRMED);
        assertThat(first.getConfirmedAt()).isEqualTo(T0.plus(min(25)));
        assertThat(first.getCreditedMinutes()).isEqualTo(25);
        assertThat(first.getXpAwarded()).isEqualTo(60);
        assertThat(xpEvents).singleElement().satisfies(e -> {
            assertThat(e.getSource()).isEqualTo(XpSource.STUDY_BLOCK);
            assertThat(e.getAmount()).isEqualTo(60);
            assertThat(e.getDedupeKey()).isEqualTo("study-block:" + first.getId());
        });
        assertThat(s.getCreditedMinutes()).isEqualTo(25);
        assertThat(s.getXpAwarded()).isEqualTo(60);
        assertThat(s.getCurrentBlock()).isEqualTo(2);
        StudySessionBlock second = block(s, 2);
        assertThat(second.getStatus()).isEqualTo(StudyBlockStatus.RUNNING);
        assertThat(second.getStartedAt()).isEqualTo(T0.plus(min(30)));
        assertThat(second.getDueAt()).isEqualTo(T0.plus(min(55)));
        assertThat(result.delta().xpGained()).isEqualTo(60);
        assertThat(result.session().status()).isEqualTo(StudySessionStatus.ACTIVE);
        assertThat(result.session().checkinOpensAt()).isEqualTo(T0.plus(min(55)).minusSeconds(60));
    }

    @Test
    void checkin_timerBlock_startsNextBlockImmediately() {
        StudySession s = startTimer(60);
        at(min(30));

        StudySessionResult result = service.checkin(s.getId());

        assertThat(result.delta().xpGained()).isEqualTo(70);
        assertThat(block(s, 2).getStartedAt()).isEqualTo(T0.plus(min(30)));
        assertThat(block(s, 2).getDueAt()).isEqualTo(T0.plus(min(60)));
    }

    @Test
    void checkin_withMultiplier_scalesBlockXp() {
        streak(4, TODAY.minusDays(1));
        StudySession s = startTimer(60);
        at(min(30));

        StudySessionResult result = service.checkin(s.getId());

        assertThat(s.getMultiplier()).isEqualByComparingTo("1.30");
        assertThat(result.delta().xpGained()).isEqualTo(91);
    }

    @Test
    void checkin_repeatedRightAfterConfirming_returnsEmptyDelta() {
        StudySession s = startPomodoro(5);
        at(min(25));
        service.checkin(s.getId());
        at(min(25).plusSeconds(30));

        StudySessionResult again = service.checkin(s.getId());

        assertThat(again.delta().xpGained()).isZero();
        assertThat(again.session().currentBlock()).isEqualTo(2);
        assertThat(xpEvents).hasSize(1);
        assertThat(s.getCreditedMinutes()).isEqualTo(25);
    }

    @Test
    void checkin_completedSession_returnsEmptyDelta() {
        StudySession s = startPomodoro(1);
        at(min(25));
        service.checkin(s.getId());

        StudySessionResult again = service.checkin(s.getId());

        assertThat(again.delta().xpGained()).isZero();
        assertThat(again.session().status()).isEqualTo(StudySessionStatus.COMPLETED);
        assertThat(xpEvents).hasSize(1);
    }

    @Test
    void checkin_pausedSession_throwsExpired() {
        StudySession s = startPomodoro(5);
        s.setStatus(StudySessionStatus.PAUSED);

        assertThatThrownBy(() -> service.checkin(s.getId()))
                .isInstanceOf(ConflictException.class)
                .hasMessage("This block expired");
    }

    @Test
    void checkin_unknownSession_throwsNotFound() {
        assertThatThrownBy(() -> service.checkin(999L)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void checkin_lastBlock_completesSessionWithBonus() {
        StudySession s = startPomodoro(2);
        at(min(25));
        service.checkin(s.getId());
        at(min(55));

        StudySessionResult result = service.checkin(s.getId());

        assertThat(s.getStatus()).isEqualTo(StudySessionStatus.COMPLETED);
        assertThat(s.getEndedAt()).isEqualTo(T0.plus(min(55)));
        assertThat(xp(XpSource.STUDY_BLOCK)).isEqualTo(120);
        assertThat(xpEvents).filteredOn(e -> e.getSource() == XpSource.STUDY_COMPLETE).singleElement()
                .satisfies(e -> {
                    assertThat(e.getAmount()).isEqualTo(40);
                    assertThat(e.getDedupeKey()).isEqualTo("study-complete:" + s.getId());
                });
        assertThat(result.delta().xpGained()).isEqualTo(100);
        assertThat(s.getXpAwarded()).isEqualTo(160);
        assertThat(s.getCreditedMinutes()).isEqualTo(50);
        assertThat(result.session().checkinOpensAt()).isNull();
        verify(random).nextDouble();
    }

    @Test
    void checkin_lastBlockWithMultiplier_scalesBonus() {
        streak(6, TODAY.minusDays(1));
        StudySession s = startPomodoro(2);
        at(min(25));
        service.checkin(s.getId());
        at(min(55));

        service.checkin(s.getId());

        assertThat(xp(XpSource.STUDY_BLOCK)).isEqualTo(180);
        assertThat(xp(XpSource.STUDY_COMPLETE)).isEqualTo(60);
    }

    @Test
    void checkin_lastBlockOfShortSession_completesWithoutBonus() {
        StudySession s = startPomodoro(1);
        at(min(25));

        service.checkin(s.getId());

        assertThat(s.getStatus()).isEqualTo(StudySessionStatus.COMPLETED);
        assertThat(xp(XpSource.STUDY_COMPLETE)).isZero();
        verify(random, never()).nextDouble();
        assertThat(chests).isEmpty();
    }

    @Test
    void checkin_lastBlockAfterMissedBlock_completesWithoutBonus() {
        StudySession s = startPomodoro(2);
        at(min(30).plusSeconds(1));
        assertThat(service.missBlock(1L, block(s, 1).getId())).isTrue();
        at(min(31));
        service.resume(s.getId());
        at(min(56));

        service.checkin(s.getId());

        assertThat(s.getStatus()).isEqualTo(StudySessionStatus.COMPLETED);
        assertThat(block(s, 1).getStatus()).isEqualTo(StudyBlockStatus.MISSED);
        assertThat(xp(XpSource.STUDY_BLOCK)).isEqualTo(60);
        assertThat(xp(XpSource.STUDY_COMPLETE)).isZero();
    }

    @Test
    void checkin_completingFiftyMinuteSessionWithMissedBlock_skipsBonusAndChestRoll() {
        when(random.nextDouble()).thenReturn(0.0);
        StudySession s = startPomodoro(2);
        at(min(30).plusSeconds(1));
        service.missBlock(1L, block(s, 1).getId());
        at(min(31));
        service.resume(s.getId());
        at(min(56));

        StudySessionResult result = service.checkin(s.getId());

        assertThat(s.getPlannedMinutes()).isEqualTo(50);
        assertThat(s.getStatus()).isEqualTo(StudySessionStatus.COMPLETED);
        assertThat(xp(XpSource.STUDY_COMPLETE)).isZero();
        verify(chestService, never()).maybeDrop(any(), any(), anyString(), anyDouble(), any());
        verify(random, never()).nextDouble();
        assertThat(chests).isEmpty();
        assertThat(result.delta().chests()).isEmpty();
    }

    @Test
    void checkin_completingFullSessionPastSixHours_paysZeroBonusButStillRollsChest() {
        earlierMinutes.put(TODAY, 360);
        StudySession s = startPomodoro(2);
        at(min(25));
        service.checkin(s.getId());
        at(min(55));

        StudySessionResult result = service.checkin(s.getId());

        assertThat(s.getStatus()).isEqualTo(StudySessionStatus.COMPLETED);
        assertThat(blocks).allSatisfy(b -> assertThat(b.getStatus()).isEqualTo(StudyBlockStatus.CONFIRMED));
        assertThat(xp(XpSource.STUDY_COMPLETE)).isZero();
        assertThat(result.delta().xpGained()).isZero();
        assertThat(s.getXpAwarded()).isZero();
        assertThat(s.getCreditedMinutes()).isEqualTo(50);
        verify(chestService).maybeDrop(any(ProgressDeltaBuilder.class), eq(ChestSource.SESSION),
                eq("session:" + s.getId()), eq(0.2), eq(TODAY));
    }

    @Test
    void resume_afterMissedBlock_startsNextBlockNow() {
        StudySession s = startPomodoro(3);
        at(min(30).plusSeconds(1));
        service.missBlock(1L, block(s, 1).getId());
        assertThat(s.getStatus()).isEqualTo(StudySessionStatus.PAUSED);
        at(min(40));

        StudySessionDto dto = service.resume(s.getId());

        assertThat(dto.status()).isEqualTo(StudySessionStatus.ACTIVE);
        assertThat(dto.currentBlock()).isEqualTo(2);
        assertThat(s.getPausedAt()).isNull();
        assertThat(block(s, 2).getStartedAt()).isEqualTo(T0.plus(min(40)));
        assertThat(block(s, 2).getDueAt()).isEqualTo(T0.plus(min(65)));
    }

    @Test
    void resume_activeSession_throwsConflict() {
        StudySession s = startPomodoro(3);

        assertThatThrownBy(() -> service.resume(s.getId())).isInstanceOf(ConflictException.class);
    }

    @Test
    void dayFactor_boundaries() {
        assertThat(StudySessionService.dayFactor(0)).isEqualByComparingTo("1");
        assertThat(StudySessionService.dayFactor(240)).isEqualByComparingTo("1");
        assertThat(StudySessionService.dayFactor(241)).isEqualByComparingTo("0.5");
        assertThat(StudySessionService.dayFactor(360)).isEqualByComparingTo("0.5");
        assertThat(StudySessionService.dayFactor(361)).isEqualByComparingTo("0");
    }

    @Test
    void curve_roundsOnceAfterMultiplierAndDailyCurve() {
        assertThat(StudySessionService.curve(60, BigDecimal.ONE, 0, 25)).isEqualTo(60);
        assertThat(StudySessionService.curve(70, new BigDecimal("1.50"), 0, 30)).isEqualTo(105);
        assertThat(StudySessionService.curve(60, BigDecimal.ONE, 230, 25)).isEqualTo(42);
        assertThat(StudySessionService.curve(60, BigDecimal.ONE, 350, 25)).isEqualTo(12);
        assertThat(StudySessionService.curve(60, new BigDecimal("1.50"), 360, 25)).isZero();
        assertThat(StudySessionService.curve(26, new BigDecimal("1.10"), 0, 13)).isEqualTo(29);
        assertThat(StudySessionService.curve(26, new BigDecimal("1.10"), 240, 13)).isEqualTo(14);
        assertThat(StudySessionService.curve(0, BigDecimal.ONE, 0, 25)).isZero();
    }

    @Test
    void scaled_roundsHalfUpAfterMultiplierAndFactor() {
        assertThat(StudySessionService.scaled(70, new BigDecimal("1.10"), new BigDecimal("0.5"))).isEqualTo(39);
        assertThat(StudySessionService.scaled(5, BigDecimal.ONE, new BigDecimal("0.5"))).isEqualTo(3);
        assertThat(StudySessionService.scaled(40, new BigDecimal("1.20"), BigDecimal.ONE)).isEqualTo(48);
        assertThat(StudySessionService.scaled(40, new BigDecimal("1.50"), BigDecimal.ZERO)).isZero();
    }

    @Test
    void checkin_afterFourHoursToday_earnsHalfRate() {
        earlierMinutes.put(TODAY, 240);
        StudySession s = startPomodoro(5);
        at(min(25));

        StudySessionResult result = service.checkin(s.getId());

        assertThat(result.delta().xpGained()).isEqualTo(30);
        assertThat(block(s, 1).getCreditedMinutes()).isEqualTo(25);
    }

    @Test
    void checkin_straddlingFourHours_splitsFullAndHalfRate() {
        earlierMinutes.put(TODAY, 230);
        StudySession s = startPomodoro(5);
        at(min(25));

        assertThat(service.checkin(s.getId()).delta().xpGained()).isEqualTo(42);
    }

    @Test
    void checkin_straddlingSixHours_splitsHalfAndZeroRate() {
        earlierMinutes.put(TODAY, 350);
        StudySession s = startPomodoro(5);
        at(min(25));

        assertThat(service.checkin(s.getId()).delta().xpGained()).isEqualTo(12);
    }

    @Test
    void checkin_afterSixHoursToday_earnsNothingButStillCreditsMinutes() {
        earlierMinutes.put(TODAY, 360);
        StudySession s = startPomodoro(5);
        at(min(25));

        StudySessionResult result = service.checkin(s.getId());

        assertThat(result.delta().xpGained()).isZero();
        assertThat(xpEvents).isEmpty();
        assertThat(block(s, 1).getStatus()).isEqualTo(StudyBlockStatus.CONFIRMED);
        assertThat(block(s, 1).getCreditedMinutes()).isEqualTo(25);
        assertThat(s.getCreditedMinutes()).isEqualTo(25);
    }

    @Test
    void checkin_lastBlockPastFourHours_halvesBonus() {
        earlierMinutes.put(TODAY, 200);
        StudySession s = startPomodoro(2);
        at(min(25));
        service.checkin(s.getId());
        at(min(55));

        service.checkin(s.getId());

        assertThat(xp(XpSource.STUDY_BLOCK)).isEqualTo(60 + 48);
        assertThat(xp(XpSource.STUDY_COMPLETE)).isEqualTo(20);
    }

    @Test
    void checkin_lastBlockPastSixHours_grantsNoBonus() {
        earlierMinutes.put(TODAY, 320);
        StudySession s = startPomodoro(2);
        at(min(25));
        service.checkin(s.getId());
        at(min(55));

        service.checkin(s.getId());

        assertThat(xp(XpSource.STUDY_BLOCK)).isEqualTo(30 + 18);
        assertThat(xp(XpSource.STUDY_COMPLETE)).isZero();
        assertThat(s.getStatus()).isEqualTo(StudySessionStatus.COMPLETED);
    }

    @Test
    void end_partialBlockAfterTenMinutes_creditsPartialXp() {
        StudySession s = startPomodoro(5);
        StudySessionBlock first = block(s, 1);
        at(min(12).plusSeconds(30));

        StudySessionResult result = service.end(s.getId());

        assertThat(first.getStatus()).isEqualTo(StudyBlockStatus.PARTIAL);
        assertThat(first.getCreditedMinutes()).isEqualTo(12);
        assertThat(first.getXpAwarded()).isEqualTo(24);
        assertThat(xpEvents).singleElement().satisfies(e -> {
            assertThat(e.getSource()).isEqualTo(XpSource.STUDY_PARTIAL);
            assertThat(e.getAmount()).isEqualTo(24);
            assertThat(e.getDedupeKey()).isEqualTo("study-block:" + first.getId());
        });
        assertThat(s.getStatus()).isEqualTo(StudySessionStatus.ENDED);
        assertThat(s.getEndedAt()).isEqualTo(T0.plus(min(12)).plusSeconds(30));
        assertThat(s.getCreditedMinutes()).isEqualTo(12);
        assertThat(result.delta().xpGained()).isEqualTo(24);
    }

    @Test
    void end_exactlyTenMinutes_creditsPartialXp() {
        StudySession s = startPomodoro(5);
        at(min(10));

        assertThat(service.end(s.getId()).delta().xpGained()).isEqualTo(20);
        assertThat(block(s, 1).getStatus()).isEqualTo(StudyBlockStatus.PARTIAL);
    }

    @Test
    void end_underTenMinutes_discardsBlock() {
        StudySession s = startPomodoro(5);
        StudySessionBlock first = block(s, 1);
        at(min(10).minusSeconds(1));

        StudySessionResult result = service.end(s.getId());

        verify(blockRepository).delete(first);
        assertThat(result.delta().xpGained()).isZero();
        assertThat(xpEvents).isEmpty();
        assertThat(s.getStatus()).isEqualTo(StudySessionStatus.ENDED);
        assertThat(s.getCreditedMinutes()).isZero();
    }

    @Test
    void end_partialWithMultiplier_roundsHalfUp() {
        streak(2, TODAY.minusDays(1));
        StudySession s = startPomodoro(5);
        at(min(13));

        assertThat(service.end(s.getId()).delta().xpGained()).isEqualTo(29);
    }

    @Test
    void end_partialPastFourHours_earnsHalfRate() {
        earlierMinutes.put(TODAY, 240);
        StudySession s = startPomodoro(5);
        at(min(20));

        assertThat(service.end(s.getId()).delta().xpGained()).isEqualTo(20);
        assertThat(block(s, 1).getCreditedMinutes()).isEqualTo(20);
    }

    @Test
    void end_duringBreak_discardsUnstartedBlock() {
        StudySession s = startPomodoro(5);
        at(min(25));
        service.checkin(s.getId());
        StudySessionBlock second = block(s, 2);
        at(min(27));

        StudySessionResult result = service.end(s.getId());

        verify(blockRepository).delete(second);
        assertThat(result.delta().xpGained()).isZero();
        assertThat(s.getCreditedMinutes()).isEqualTo(25);
        assertThat(s.getStatus()).isEqualTo(StudySessionStatus.ENDED);
    }

    @Test
    void end_pausedSession_endsWithoutXp() {
        StudySession s = startPomodoro(5);
        at(min(30).plusSeconds(1));
        service.missBlock(1L, block(s, 1).getId());
        at(min(35));

        StudySessionResult result = service.end(s.getId());

        assertThat(s.getStatus()).isEqualTo(StudySessionStatus.ENDED);
        assertThat(result.delta().xpGained()).isZero();
    }

    @Test
    void end_finishedSession_throwsConflict() {
        StudySession s = startPomodoro(5);
        at(min(12));
        service.end(s.getId());

        assertThatThrownBy(() -> service.end(s.getId())).isInstanceOf(ConflictException.class);
        assertThat(xpEvents).hasSize(1);
    }

    @Test
    void end_partialOfFifteenMinutes_qualifiesDay() {
        streak(2, TODAY.minusDays(1));
        StudySession s = startPomodoro(5);
        at(min(15));

        service.end(s.getId());

        assertThat(progress.getStreakCurrent()).isEqualTo(3);
        assertThat(progress.getStreakLastDate()).isEqualTo(TODAY);
    }

    @Test
    void end_partialUnderFifteenMinutes_doesNotQualifyDay() {
        streak(2, TODAY.minusDays(1));
        StudySession s = startPomodoro(5);
        at(min(14));

        service.end(s.getId());

        assertThat(progress.getStreakCurrent()).isEqualTo(2);
        assertThat(progress.getStreakLastDate()).isEqualTo(TODAY.minusDays(1));
    }

    @Test
    void end_partialTopsUpEarlierMinutesToQualifyDay() {
        earlierMinutes.put(TODAY, 5);
        streak(2, TODAY.minusDays(1));
        StudySession s = startPomodoro(5);
        at(min(10));

        service.end(s.getId());

        assertThat(progress.getStreakCurrent()).isEqualTo(3);
    }

    @Test
    void setTaskDone_beforeFiveMinutes_isNeverPaid() {
        StudySession s = startPomodoro(5, "Read");
        StudySessionTask t = task(s, 0);
        at(min(5).minusSeconds(1));

        StudySessionResult result = service.setTaskDone(s.getId(), t.getId(), true);

        assertThat(t.getDoneAt()).isNotNull();
        assertThat(result.delta().xpGained()).isZero();
        assertThat(result.session().tasks()).singleElement().satisfies(dto -> assertThat(dto.done()).isTrue());

        at(min(25));
        service.checkin(s.getId());

        assertThat(t.getXpAwarded()).isZero();
        assertThat(xp(XpSource.STUDY_TASK)).isZero();
    }

    @Test
    void setTaskDone_beforeAnyCreditedMinutes_staysPending() {
        StudySession s = startPomodoro(5, "Read");
        StudySessionTask t = task(s, 0);
        at(min(6));

        StudySessionResult result = service.setTaskDone(s.getId(), t.getId(), true);

        assertThat(result.delta().xpGained()).isZero();
        assertThat(t.getDoneAt()).isNotNull();
        assertThat(t.getXpAwarded()).isZero();
        assertThat(xpEvents).isEmpty();
    }

    @Test
    void checkin_firstCreditedBlock_paysPendingTasksInPositionOrder() {
        StudySession s = startPomodoro(5, "a", "b", "c");
        at(min(6));
        service.setTaskDone(s.getId(), task(s, 2).getId(), true);
        service.setTaskDone(s.getId(), task(s, 0).getId(), true);
        service.setTaskDone(s.getId(), task(s, 1).getId(), true);
        at(min(25));

        StudySessionResult result = service.checkin(s.getId());

        assertThat(xpEvents).filteredOn(e -> e.getSource() == XpSource.STUDY_TASK)
                .extracting(XpEvent::getDedupeKey)
                .containsExactly("study-task:" + task(s, 0).getId(), "study-task:" + task(s, 1).getId(),
                        "study-task:" + task(s, 2).getId());
        assertThat(task(s, 0).getXpAwarded()).isEqualTo(5);
        assertThat(result.delta().xpGained()).isEqualTo(60 + 15);
        assertThat(s.getXpAwarded()).isEqualTo(75);
    }

    @Test
    void setTaskDone_afterCreditedBlock_paysImmediatelyWithoutMultiplier() {
        streak(6, TODAY.minusDays(1));
        StudySession s = startPomodoro(5, "Read");
        StudySessionTask t = task(s, 0);
        at(min(25));
        service.checkin(s.getId());
        at(min(26));

        StudySessionResult result = service.setTaskDone(s.getId(), t.getId(), true);

        assertThat(s.getMultiplier()).isEqualByComparingTo("1.50");
        assertThat(result.delta().xpGained()).isEqualTo(5);
        assertThat(t.getXpAwarded()).isEqualTo(5);
        assertThat(xpEvents).filteredOn(e -> e.getSource() == XpSource.STUDY_TASK).singleElement()
                .satisfies(e -> assertThat(e.getDedupeKey()).isEqualTo("study-task:" + t.getId()));
    }

    @Test
    void end_withPartialBlock_paysPendingTasks() {
        StudySession s = startPomodoro(5, "Read");
        at(min(6));
        service.setTaskDone(s.getId(), task(s, 0).getId(), true);
        at(min(12));

        StudySessionResult result = service.end(s.getId());

        assertThat(xp(XpSource.STUDY_PARTIAL)).isEqualTo(24);
        assertThat(xp(XpSource.STUDY_TASK)).isEqualTo(5);
        assertThat(result.delta().xpGained()).isEqualTo(29);
    }

    @Test
    void end_withZeroCreditedMinutes_paysNoTaskXp() {
        StudySession s = startPomodoro(5, "Read");
        at(min(6));
        service.setTaskDone(s.getId(), task(s, 0).getId(), true);
        at(min(9));

        StudySessionResult result = service.end(s.getId());

        assertThat(result.delta().xpGained()).isZero();
        assertThat(task(s, 0).getXpAwarded()).isZero();
        assertThat(xpEvents).isEmpty();
    }

    @Test
    void checkin_untickedPendingTask_isNotPaid() {
        StudySession s = startPomodoro(5, "Read", "Write");
        at(min(6));
        service.setTaskDone(s.getId(), task(s, 0).getId(), true);
        service.setTaskDone(s.getId(), task(s, 1).getId(), true);
        at(min(7));
        service.setTaskDone(s.getId(), task(s, 1).getId(), false);
        at(min(25));

        service.checkin(s.getId());

        assertThat(task(s, 0).getXpAwarded()).isEqualTo(5);
        assertThat(task(s, 1).getXpAwarded()).isZero();
    }

    @Test
    void setTaskDone_onlyFirstFivePositionsEarnXp() {
        StudySession s = startPomodoro(5, "a", "b", "c", "d", "e", "f", "g");
        at(min(6));
        for (int position = 0; position < 7; position++) {
            service.setTaskDone(s.getId(), task(s, position).getId(), true);
        }
        at(min(25));

        service.checkin(s.getId());

        assertThat(xp(XpSource.STUDY_TASK)).isEqualTo(25);
        assertThat(task(s, 4).getXpAwarded()).isEqualTo(5);
        assertThat(task(s, 5).getXpAwarded()).isZero();
        assertThat(task(s, 6).getXpAwarded()).isZero();
        assertThat(task(s, 6).getDoneAt()).isNotNull();
    }

    @Test
    void setTaskDone_untickThenRetick_keepsXpAndNeverPaysTwice() {
        StudySession s = startPomodoro(5, "Read");
        StudySessionTask t = task(s, 0);
        at(min(25));
        service.checkin(s.getId());
        at(min(26));
        service.setTaskDone(s.getId(), t.getId(), true);
        at(min(27));

        StudySessionResult untick = service.setTaskDone(s.getId(), t.getId(), false);

        assertThat(t.getDoneAt()).isNull();
        assertThat(untick.delta().xpGained()).isZero();
        assertThat(t.getXpAwarded()).isEqualTo(5);
        assertThat(xp(XpSource.STUDY_TASK)).isEqualTo(5);

        at(min(28));
        StudySessionResult retick = service.setTaskDone(s.getId(), t.getId(), true);

        assertThat(retick.delta().xpGained()).isZero();
        assertThat(xp(XpSource.STUDY_TASK)).isEqualTo(5);
        assertThat(s.getXpAwarded()).isEqualTo(65);
    }

    @Test
    void setTaskDone_dailyCapOfTenPaidTasks_stopsPayment() {
        earlierPaidTasks.put(TODAY, 8);
        StudySession s = startPomodoro(5, "a", "b", "c", "d");
        at(min(25));
        service.checkin(s.getId());
        at(min(26));

        for (int position = 0; position < 4; position++) {
            service.setTaskDone(s.getId(), task(s, position).getId(), true);
        }

        assertThat(xp(XpSource.STUDY_TASK)).isEqualTo(10);
        assertThat(task(s, 1).getXpAwarded()).isEqualTo(5);
        assertThat(task(s, 2).getXpAwarded()).isZero();
        assertThat(task(s, 3).getXpAwarded()).isZero();
    }

    @Test
    void checkin_pendingTasksBeyondDailyCap_payInPositionOrderUpToCap() {
        earlierPaidTasks.put(TODAY, 9);
        StudySession s = startPomodoro(5, "a", "b", "c");
        at(min(6));
        service.setTaskDone(s.getId(), task(s, 2).getId(), true);
        service.setTaskDone(s.getId(), task(s, 1).getId(), true);
        at(min(25));

        service.checkin(s.getId());

        assertThat(xp(XpSource.STUDY_TASK)).isEqualTo(5);
        assertThat(task(s, 1).getXpAwarded()).isEqualTo(5);
        assertThat(task(s, 2).getXpAwarded()).isZero();
    }

    @Test
    void setTaskDone_capCountsOnlyTheSessionLocalDate() {
        earlierPaidTasks.put(TODAY.minusDays(1), 10);
        StudySession s = startPomodoro(5, "Read");
        at(min(25));
        service.checkin(s.getId());
        at(min(26));

        assertThat(service.setTaskDone(s.getId(), task(s, 0).getId(), true).delta().xpGained()).isEqualTo(5);
    }

    @Test
    void checkin_pendingTaskPaidPastFourHours_usesDayFactorIncludingCreditedBlock() {
        earlierMinutes.put(TODAY, 230);
        StudySession s = startPomodoro(5, "Read");
        at(min(6));
        service.setTaskDone(s.getId(), task(s, 0).getId(), true);
        at(min(25));

        service.checkin(s.getId());

        assertThat(xp(XpSource.STUDY_TASK)).isEqualTo(3);
    }

    @Test
    void setTaskDone_pastSixHoursToday_earnsNothing() {
        earlierMinutes.put(TODAY, 340);
        StudySession s = startPomodoro(5, "Read");
        at(min(25));
        service.checkin(s.getId());
        at(min(26));

        assertThat(service.setTaskDone(s.getId(), task(s, 0).getId(), true).delta().xpGained()).isZero();
        assertThat(xp(XpSource.STUDY_TASK)).isZero();
    }

    @Test
    void setTaskDone_finishedSession_throwsConflict() {
        StudySession s = startPomodoro(5, "Read");
        s.setStatus(StudySessionStatus.ENDED);
        at(min(6));

        assertThatThrownBy(() -> service.setTaskDone(s.getId(), task(s, 0).getId(), true))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void setTaskDone_unknownTask_throwsNotFound() {
        StudySession s = startPomodoro(5, "Read");

        assertThatThrownBy(() -> service.setTaskDone(s.getId(), 9999L, true))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void checkin_sameDayAlreadyQualified_leavesStreakUnchanged() {
        streak(3, TODAY);
        StudySession s = startPomodoro(5);
        at(min(25));

        service.checkin(s.getId());

        assertThat(progress.getStreakCurrent()).isEqualTo(3);
        assertThat(progress.getStreakLastDate()).isEqualTo(TODAY);
    }

    @Test
    void checkin_consecutiveDay_extendsStreak() {
        streak(3, TODAY.minusDays(1));
        StudySession s = startPomodoro(5);
        at(min(25));

        service.checkin(s.getId());

        assertThat(progress.getStreakCurrent()).isEqualTo(4);
        assertThat(progress.getStreakBest()).isEqualTo(4);
        assertThat(progress.getStreakLastDate()).isEqualTo(TODAY);
    }

    @Test
    void checkin_afterGap_restartsStreak() {
        streak(3, TODAY.minusDays(3));
        StudySession s = startPomodoro(5);
        at(min(25));

        service.checkin(s.getId());

        assertThat(progress.getStreakCurrent()).isEqualTo(1);
        assertThat(progress.getStreakBest()).isEqualTo(3);
        assertThat(progress.getStreakLastDate()).isEqualTo(TODAY);
    }

    @Test
    void checkin_seventhStreakDay_grantsStreakChest() {
        streak(6, TODAY.minusDays(1));
        StudySession s = startPomodoro(5);
        at(min(25));

        StudySessionResult result = service.checkin(s.getId());

        assertThat(progress.getStreakCurrent()).isEqualTo(7);
        assertThat(chests).singleElement().satisfies(c -> {
            assertThat(c.getSource()).isEqualTo(ChestSource.STREAK);
            assertThat(c.getSourceRef()).isEqualTo("streak:2026-10-07");
        });
        assertThat(result.delta().chests()).hasSize(1);
    }

    @Test
    void checkin_nearMidnightInVancouver_creditsSessionStartDate() {
        streak(2, TODAY.minusDays(1));
        Instant start = Instant.parse("2026-10-08T06:50:00Z");
        at(start);
        StudySession s = startPomodoro(5);
        at(start.plus(min(25)));

        StudySessionResult result = service.checkin(s.getId());

        assertThat(s.getLocalDate()).isEqualTo(TODAY);
        assertThat(progress.getStreakCurrent()).isEqualTo(3);
        assertThat(progress.getStreakLastDate()).isEqualTo(TODAY);
        assertThat(result.delta().xpGained()).isEqualTo(66);
    }

    @Test
    void checkin_completingFiftyMinuteSession_dropsSessionChestUnderTwentyPercent() {
        when(random.nextDouble()).thenReturn(0.1999);
        StudySession s = startPomodoro(2);
        at(min(25));
        service.checkin(s.getId());
        at(min(55));

        StudySessionResult result = service.checkin(s.getId());

        assertThat(chests).singleElement().satisfies(c -> {
            assertThat(c.getSource()).isEqualTo(ChestSource.SESSION);
            assertThat(c.getSourceRef()).isEqualTo("session:" + s.getId());
            assertThat(c.getLocalDate()).isEqualTo(TODAY);
        });
        assertThat(result.delta().chests()).hasSize(1);
    }

    @Test
    void checkin_completingSessionWithRollAtTwentyPercent_dropsNothing() {
        when(random.nextDouble()).thenReturn(0.2);
        StudySession s = startPomodoro(2);
        at(min(25));
        service.checkin(s.getId());
        at(min(55));

        service.checkin(s.getId());

        verify(random).nextDouble();
        assertThat(chests).isEmpty();
    }

    @Test
    void checkin_sessionChestAlreadyDroppedOnLocalDate_skipsRoll() {
        when(random.nextDouble()).thenReturn(0.0);
        when(chestRepository.countByUserIdAndSourceAndLocalDate(1L, ChestSource.SESSION, TODAY)).thenReturn(1L);
        StudySession s = startPomodoro(2);
        at(min(25));
        service.checkin(s.getId());
        at(min(55));

        service.checkin(s.getId());

        verify(random, never()).nextDouble();
        assertThat(chests).isEmpty();
    }

    @Test
    void checkin_sessionFinishingAfterLocalMidnight_limitsChestBySessionLocalDate() {
        when(random.nextDouble()).thenReturn(0.0);
        when(chestRepository.countByUserIdAndSourceAndCreatedAtBetween(anyLong(), any(), any(), any()))
                .thenReturn(1L);
        Instant start = Instant.parse("2026-10-08T06:30:00Z");
        at(start);
        StudySession s = startPomodoro(2);
        at(start.plus(min(25)));
        service.checkin(s.getId());
        at(start.plus(min(55)));

        service.checkin(s.getId());

        assertThat(s.getLocalDate()).isEqualTo(TODAY);
        verify(chestRepository).countByUserIdAndSourceAndLocalDate(1L, ChestSource.SESSION, TODAY);
        assertThat(chests).filteredOn(c -> c.getSource() == ChestSource.SESSION).singleElement()
                .satisfies(c -> assertThat(c.getLocalDate()).isEqualTo(TODAY));
    }

    @Test
    void start_noProgressZoneYet_adoptsLiveZoneAndStampsChange() {
        StudySession s = startPomodoro(2);

        assertThat(progress.getProgressZone()).isEqualTo("America/Vancouver");
        assertThat(progress.getProgressZoneChangedAt()).isEqualTo(T0);
        assertThat(s.getLocalDate()).isEqualTo(TODAY);
    }

    @Test
    void start_liveZoneChangedWithinSevenDays_keepsProgressZoneForLocalDate() {
        Instant now = Instant.parse("2026-10-08T06:50:00Z");
        Instant lastSwitch = now.minus(Duration.ofDays(7)).plusSeconds(1);
        progress.setProgressZone("America/Vancouver");
        progress.setProgressZoneChangedAt(lastSwitch);
        user.setTimezone("Asia/Tokyo");
        at(now);

        StudySession s = startPomodoro(2);

        assertThat(s.getLocalDate()).isEqualTo(TODAY);
        assertThat(progress.getProgressZone()).isEqualTo("America/Vancouver");
        assertThat(progress.getProgressZoneChangedAt()).isEqualTo(lastSwitch);
    }

    @Test
    void start_liveZoneChangedSevenDaysAfterLastSwitch_adoptsLiveZone() {
        Instant now = Instant.parse("2026-10-08T06:50:00Z");
        progress.setProgressZone("America/Vancouver");
        progress.setProgressZoneChangedAt(now.minus(Duration.ofDays(7)));
        user.setTimezone("Asia/Tokyo");
        at(now);

        StudySession s = startPomodoro(2);

        assertThat(s.getLocalDate()).isEqualTo(TODAY.plusDays(1));
        assertThat(progress.getProgressZone()).isEqualTo("Asia/Tokyo");
        assertThat(progress.getProgressZoneChangedAt()).isEqualTo(now);
    }

    @Test
    void start_multiplierUsesStreakInProgressZone() {
        Instant now = Instant.parse("2026-10-08T06:50:00Z");
        progress.setProgressZone("America/Vancouver");
        progress.setProgressZoneChangedAt(now.minus(Duration.ofDays(1)));
        user.setTimezone("Asia/Tokyo");
        streak(2, TODAY.minusDays(1));
        at(now);

        assertThat(startPomodoro(2).getMultiplier()).isEqualByComparingTo("1.10");
    }

    @Test
    void streakWeek_usesProgressZoneWhileLiveZoneChangeIsCoolingDown() {
        Instant now = Instant.parse("2026-10-08T06:50:00Z");
        Instant lastSwitch = now.minus(Duration.ofDays(1));
        progress.setProgressZone("America/Vancouver");
        progress.setProgressZoneChangedAt(lastSwitch);
        user.setTimezone("Asia/Tokyo");
        at(now);

        StreakWeekDto week = service.streakWeek();

        assertThat(week.today()).isEqualTo(TODAY);
        assertThat(progress.getProgressZone()).isEqualTo("America/Vancouver");
        assertThat(progress.getProgressZoneChangedAt()).isEqualTo(lastSwitch);
    }

    @Test
    void streakWeek_neverWritesProgressZone() {
        service.streakWeek();

        assertThat(progress.getProgressZone()).isNull();
        assertThat(progress.getProgressZoneChangedAt()).isNull();
        verify(userProgressRepository, never()).findForUpdate(anyLong());
    }

    @Test
    void resume_pausedMoreThanThirtyMinutes_expiresSessionAndThrowsConflict() {
        StudySession s = startPomodoro(3);
        at(min(30).plusSeconds(1));
        service.missBlock(1L, block(s, 1).getId());
        Instant late = T0.plus(min(60)).plusSeconds(2);
        at(late);

        assertThatThrownBy(() -> service.resume(s.getId()))
                .isInstanceOf(ConflictException.class)
                .hasMessage("This session expired");
        assertThat(s.getStatus()).isEqualTo(StudySessionStatus.EXPIRED);
        assertThat(s.getEndedAt()).isEqualTo(late);
        assertThat(blocks).hasSize(1);
    }

    @Test
    void resume_pausedExactlyThirtyMinutes_resumes() {
        StudySession s = startPomodoro(3);
        at(min(30).plusSeconds(1));
        service.missBlock(1L, block(s, 1).getId());
        at(min(60).plusSeconds(1));

        assertThat(service.resume(s.getId()).status()).isEqualTo(StudySessionStatus.ACTIVE);
    }

    @Test
    void end_partialPastFourHoursWithMultiplier_roundsOnce() {
        earlierMinutes.put(TODAY, 240);
        streak(2, TODAY.minusDays(1));
        StudySession s = startPomodoro(5);
        at(min(13));

        assertThat(service.end(s.getId()).delta().xpGained()).isEqualTo(14);
    }

    @Test
    void history_capsPageSizeAtFifty() {
        when(sessionRepository.findByUserIdOrderByStartedAtDesc(eq(1L), any()))
                .thenReturn(new SliceImpl<>(List.of()));

        service.history(-1, 500);

        verify(sessionRepository).findByUserIdOrderByStartedAtDesc(1L, PageRequest.of(0, 50));
    }

    @Test
    void streakWeek_runsSundayToSaturdayInUserZone() {
        at(Instant.parse("2026-10-08T06:50:00Z"));
        streak(2, TODAY);
        LocalDate sunday = LocalDate.of(2026, 10, 4);
        when(sessionRepository.qualifiedDates(1L, sunday, sunday.plusDays(6), 15))
                .thenReturn(List.of(LocalDate.of(2026, 10, 6), TODAY));

        StreakWeekDto week = service.streakWeek();

        assertThat(week.today()).isEqualTo(TODAY);
        assertThat(week.current()).isEqualTo(2);
        assertThat(week.multiplier()).isEqualTo(1.1);
        assertThat(week.week()).extracting(StreakDayDto::label)
                .containsExactly("Su", "M", "Tu", "W", "Th", "F", "Sa");
        assertThat(week.week()).extracting(StreakDayDto::date).first().isEqualTo(sunday);
        assertThat(week.week()).filteredOn(StreakDayDto::isToday).singleElement()
                .satisfies(d -> assertThat(d.date()).isEqualTo(TODAY));
        assertThat(week.week()).filteredOn(StreakDayDto::qualified).extracting(StreakDayDto::date)
                .containsExactly(LocalDate.of(2026, 10, 6), TODAY);
    }
}
