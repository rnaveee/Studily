package com.rnave.studily.studysession;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.progress.ChestService;
import com.rnave.studily.progress.ProgressRateLimiter;
import com.rnave.studily.progress.ProgressService;
import com.rnave.studily.progress.StreakRestoreService;
import com.rnave.studily.push.PushPayload;
import com.rnave.studily.push.WebPushSender;
import com.rnave.studily.studysession.StudySessionService.SweepTarget;
import com.rnave.studily.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class StudySessionSweeperTest {

    private static final Instant T0 = Instant.parse("2026-10-07T17:00:00Z");
    private static final PushPayload BLOCK_DONE =
            PushPayload.of("Study session", "Block done! Check in to keep your XP.", "/learn");

    private StudySessionRepository sessionRepository;
    private StudySessionBlockRepository blockRepository;
    private WebPushSender pushSender;
    private StudySessionSweeper sweeper;

    private final List<StudySession> sessions = new ArrayList<>();
    private final List<StudySessionBlock> blocks = new ArrayList<>();
    private User user;
    private Instant now;

    @BeforeEach
    void setUp() {
        sessionRepository = mock(StudySessionRepository.class);
        blockRepository = mock(StudySessionBlockRepository.class);
        pushSender = mock(WebPushSender.class);
        user = new User();
        user.setId(1L);

        when(blockRepository.findById(anyLong())).thenAnswer(inv -> blocks.stream()
                .filter(b -> b.getId().equals(inv.getArgument(0))).findFirst());
        when(blockRepository.findByStatusAndDueAtBeforeAndNotifiedAtIsNull(any(), any())).thenAnswer(inv -> {
            StudyBlockStatus status = inv.getArgument(0);
            Instant before = inv.getArgument(1);
            return blocks.stream()
                    .filter(b -> b.getStatus() == status && b.getDueAt().isBefore(before) && b.getNotifiedAt() == null)
                    .toList();
        });
        when(blockRepository.findByStatusAndDueAtBefore(any(), any())).thenAnswer(inv -> {
            StudyBlockStatus status = inv.getArgument(0);
            Instant before = inv.getArgument(1);
            return blocks.stream()
                    .filter(b -> b.getStatus() == status && b.getDueAt().isBefore(before))
                    .toList();
        });
        when(sessionRepository.findByStatusAndPausedAtBefore(any(), any())).thenAnswer(inv -> {
            StudySessionStatus status = inv.getArgument(0);
            Instant before = inv.getArgument(1);
            return sessions.stream()
                    .filter(s -> s.getStatus() == status && s.getPausedAt() != null && s.getPausedAt().isBefore(before))
                    .toList();
        });
        when(sessionRepository.findByIdAndUserId(anyLong(), anyLong())).thenAnswer(inv -> sessions.stream()
                .filter(s -> s.getId().equals(inv.getArgument(0))
                        && s.getUser().getId().equals(inv.getArgument(1)))
                .findFirst());

        at(T0);
    }

    private void at(Instant instant) {
        now = instant;
        Clock clock = Clock.fixed(instant, ZoneOffset.UTC);
        StudySessionService service = new StudySessionService(sessionRepository, blockRepository,
                mock(StudySessionTaskRepository.class), mock(ProgressService.class), mock(ChestService.class),
                mock(StreakRestoreService.class), new ProgressRateLimiter(), mock(CurrentUser.class), clock);
        sweeper = new StudySessionSweeper(service, pushSender);
    }

    private void at(Duration sinceStart) {
        at(T0.plus(sinceStart));
    }

    private StudySession session(long id, int plannedBlocks, StudySessionStatus status) {
        StudySession s = new StudySession();
        s.setId(id);
        s.setUser(user);
        s.setMode(StudySessionMode.POMODORO);
        s.setPlannedBlocks(plannedBlocks);
        s.setBlockMinutes(25);
        s.setBreakMinutes(5);
        s.setPlannedMinutes(25 * plannedBlocks);
        s.setStatus(status);
        s.setStartedAt(T0);
        s.setLocalDate(LocalDate.of(2026, 10, 7));
        s.setMultiplier(new BigDecimal("1.00"));
        s.setCurrentBlock(1);
        sessions.add(s);
        return s;
    }

    private StudySessionBlock block(long id, StudySession session, int index) {
        StudySessionBlock b = new StudySessionBlock();
        b.setId(id);
        b.setSession(session);
        b.setBlockIndex(index);
        b.setStartedAt(T0);
        b.setDueAt(T0.plus(Duration.ofMinutes(25)));
        b.setStatus(StudyBlockStatus.RUNNING);
        blocks.add(b);
        return b;
    }

    @Test
    void sweep_dueBlock_notifiesOnceAndSetsNotifiedAt() {
        StudySession s = session(10L, 3, StudySessionStatus.ACTIVE);
        StudySessionBlock b = block(20L, s, 1);
        at(Duration.ofMinutes(25).plusSeconds(10));

        sweeper.sweep();

        assertThat(b.getNotifiedAt()).isEqualTo(now);
        verify(pushSender).sendToUser(1L, BLOCK_DONE, 300);

        at(Duration.ofMinutes(25).plusSeconds(40));
        sweeper.sweep();

        verify(pushSender, times(1)).sendToUser(anyLong(), any(), anyInt());
        assertThat(b.getNotifiedAt()).isEqualTo(T0.plus(Duration.ofMinutes(25)).plusSeconds(10));
        assertThat(b.getStatus()).isEqualTo(StudyBlockStatus.RUNNING);
    }

    @Test
    void notifyDue_staleQueryReturnsNotifiedBlock_sendsNoSecondPush() {
        StudySession s = session(10L, 3, StudySessionStatus.ACTIVE);
        StudySessionBlock b = block(20L, s, 1);
        when(blockRepository.findByStatusAndDueAtBeforeAndNotifiedAtIsNull(any(), any())).thenReturn(List.of(b));
        at(Duration.ofMinutes(26));

        sweeper.notifyDue();
        sweeper.notifyDue();

        verify(pushSender, times(1)).sendToUser(1L, BLOCK_DONE, 300);
    }

    @Test
    void sweep_blockNotYetDue_sendsNothing() {
        StudySession s = session(10L, 3, StudySessionStatus.ACTIVE);
        StudySessionBlock b = block(20L, s, 1);
        at(Duration.ofMinutes(24));

        sweeper.sweep();

        assertThat(b.getNotifiedAt()).isNull();
        verify(pushSender, never()).sendToUser(anyLong(), any(), anyInt());
    }

    @Test
    void sweep_dueBlockOfPausedSession_sendsNothing() {
        StudySession s = session(10L, 3, StudySessionStatus.PAUSED);
        s.setPausedAt(T0.plus(Duration.ofMinutes(25)));
        StudySessionBlock b = block(20L, s, 1);
        at(Duration.ofMinutes(26));

        sweeper.notifyDue();

        assertThat(b.getNotifiedAt()).isNull();
        verify(pushSender, never()).sendToUser(anyLong(), any(), anyInt());
    }

    @Test
    void sweep_overdueBlock_marksMissedAndPausesSession() {
        StudySession s = session(10L, 3, StudySessionStatus.ACTIVE);
        StudySessionBlock b = block(20L, s, 1);
        b.setNotifiedAt(T0.plus(Duration.ofMinutes(25)));
        at(Duration.ofMinutes(30).plusSeconds(1));

        sweeper.sweep();

        assertThat(b.getStatus()).isEqualTo(StudyBlockStatus.MISSED);
        assertThat(b.getCreditedMinutes()).isZero();
        assertThat(b.getXpAwarded()).isZero();
        assertThat(s.getStatus()).isEqualTo(StudySessionStatus.PAUSED);
        assertThat(s.getPausedAt()).isEqualTo(now);
        assertThat(s.getEndedAt()).isNull();
    }

    @Test
    void sweep_atLateEdge_leavesBlockRunning() {
        StudySession s = session(10L, 3, StudySessionStatus.ACTIVE);
        StudySessionBlock b = block(20L, s, 1);
        b.setNotifiedAt(T0.plus(Duration.ofMinutes(25)));
        at(Duration.ofMinutes(30));

        sweeper.sweep();

        assertThat(b.getStatus()).isEqualTo(StudyBlockStatus.RUNNING);
        assertThat(s.getStatus()).isEqualTo(StudySessionStatus.ACTIVE);
    }

    @Test
    void sweep_overdueLastPlannedBlock_expiresSession() {
        StudySession s = session(10L, 2, StudySessionStatus.ACTIVE);
        s.setCurrentBlock(2);
        StudySessionBlock b = block(20L, s, 2);
        at(Duration.ofMinutes(31));

        sweeper.sweep();

        assertThat(b.getStatus()).isEqualTo(StudyBlockStatus.MISSED);
        assertThat(s.getStatus()).isEqualTo(StudySessionStatus.EXPIRED);
        assertThat(s.getEndedAt()).isEqualTo(now);
    }

    @Test
    void sweep_pausedMoreThanThirtyMinutes_expiresSession() {
        StudySession s = session(10L, 3, StudySessionStatus.PAUSED);
        s.setPausedAt(T0);
        at(Duration.ofMinutes(30).plusSeconds(1));

        sweeper.sweep();

        assertThat(s.getStatus()).isEqualTo(StudySessionStatus.EXPIRED);
        assertThat(s.getEndedAt()).isEqualTo(now);
    }

    @Test
    void sweep_pausedExactlyThirtyMinutes_staysPaused() {
        StudySession s = session(10L, 3, StudySessionStatus.PAUSED);
        s.setPausedAt(T0);
        at(Duration.ofMinutes(30));

        sweeper.sweep();

        assertThat(s.getStatus()).isEqualTo(StudySessionStatus.PAUSED);
        assertThat(s.getEndedAt()).isNull();
    }

    @Test
    void sweep_missedThenAbandoned_pausesThenExpires() {
        StudySession s = session(10L, 3, StudySessionStatus.ACTIVE);
        StudySessionBlock b = block(20L, s, 1);

        at(Duration.ofMinutes(25).plusSeconds(5));
        sweeper.sweep();
        at(Duration.ofMinutes(30).plusSeconds(5));
        sweeper.sweep();
        assertThat(b.getStatus()).isEqualTo(StudyBlockStatus.MISSED);
        assertThat(s.getStatus()).isEqualTo(StudySessionStatus.PAUSED);

        at(Duration.ofMinutes(60).plusSeconds(5));
        sweeper.sweep();
        assertThat(s.getStatus()).isEqualTo(StudySessionStatus.PAUSED);

        at(Duration.ofMinutes(60).plusSeconds(6));
        sweeper.sweep();
        assertThat(s.getStatus()).isEqualTo(StudySessionStatus.EXPIRED);
        verify(pushSender, times(1)).sendToUser(1L, BLOCK_DONE, 300);
    }

    @Test
    void sweep_failingTarget_doesNotStopOthers() {
        StudySessionService service = mock(StudySessionService.class);
        StudySessionSweeper isolated = new StudySessionSweeper(service, pushSender);
        when(service.overdueBlocks()).thenReturn(List.of(new SweepTarget(1L, 20L), new SweepTarget(2L, 21L)));
        when(service.missBlock(1L, 20L)).thenThrow(new IllegalStateException("boom"));
        when(service.dueUnnotifiedBlocks()).thenReturn(List.of(new SweepTarget(3L, 30L), new SweepTarget(4L, 31L)));
        when(service.markNotified(3L, 30L)).thenReturn(true);
        when(service.markNotified(4L, 31L)).thenReturn(true);
        doThrow(new IllegalStateException("push down")).when(pushSender).sendToUser(eq(3L), any(), anyInt());
        when(service.stalePausedSessions()).thenReturn(List.of(new SweepTarget(5L, 40L)));

        isolated.sweep();

        verify(service).missBlock(2L, 21L);
        verify(pushSender).sendToUser(4L, BLOCK_DONE, 300);
        verify(service).expire(5L, 40L);
    }

    @Test
    void notifyDue_markNotifiedRejected_sendsNoPush() {
        StudySessionService service = mock(StudySessionService.class);
        StudySessionSweeper isolated = new StudySessionSweeper(service, pushSender);
        when(service.dueUnnotifiedBlocks()).thenReturn(List.of(new SweepTarget(1L, 20L)));
        when(service.markNotified(1L, 20L)).thenReturn(false);

        isolated.notifyDue();

        verify(pushSender, never()).sendToUser(anyLong(), any(), anyInt());
    }
}
