package com.rnave.studily.studysession;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.config.PageResponse;
import com.rnave.studily.progress.ChestService;
import com.rnave.studily.progress.ChestSource;
import com.rnave.studily.progress.ProgressDeltaBuilder;
import com.rnave.studily.progress.ProgressRateLimiter;
import com.rnave.studily.progress.ProgressService;
import com.rnave.studily.progress.UserProgress;
import com.rnave.studily.progress.XpSource;
import com.rnave.studily.studysession.StudySessionDtos.StartSessionRequest;
import com.rnave.studily.studysession.StudySessionDtos.StreakDayDto;
import com.rnave.studily.studysession.StudySessionDtos.StreakWeekDto;
import com.rnave.studily.studysession.StudySessionDtos.StudySessionBlockDto;
import com.rnave.studily.studysession.StudySessionDtos.StudySessionDto;
import com.rnave.studily.studysession.StudySessionDtos.StudySessionResult;
import com.rnave.studily.studysession.StudySessionDtos.StudySessionSummaryDto;
import com.rnave.studily.studysession.StudySessionDtos.StudySessionTaskDto;
import com.rnave.studily.user.User;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Slice;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
public class StudySessionService {

    static final int POMODORO_BLOCK_MINUTES = 25;
    static final int POMODORO_BREAK_MINUTES = 5;
    static final int POMODORO_DEFAULT_BLOCKS = 5;
    static final int MAX_BLOCKS = 8;
    static final int TIMER_BLOCK_MINUTES = 30;
    static final int TIMER_DEFAULT_MINUTES = 120;
    static final Set<Integer> TIMER_MINUTES = Set.of(30, 60, 90, 120, 150, 180);
    static final int MAX_TASKS = 10;
    static final int MAX_TASK_LENGTH = 200;
    static final Duration CHECKIN_EARLY = Duration.ofSeconds(60);
    static final Duration CHECKIN_LATE = Duration.ofMinutes(5);
    static final Duration REPLAY_WINDOW = Duration.ofMinutes(2);
    static final Duration PAUSE_LIMIT = Duration.ofMinutes(30);
    static final int PARTIAL_MIN_MINUTES = 10;
    static final int QUALIFY_MINUTES = 15;
    static final int FULL_RATE_MINUTES = 240;
    static final int HALF_RATE_MINUTES = 360;
    static final BigDecimal HALF = new BigDecimal("0.5");
    static final int COMPLETE_BONUS = 40;
    static final int BONUS_MIN_PLANNED_MINUTES = 50;
    static final double SESSION_CHEST_CHANCE = 0.2;
    static final int TASK_XP = 5;
    static final int TASK_XP_POSITIONS = 5;
    static final int MAX_PAID_TASKS_PER_DAY = 10;
    static final Duration TASK_XP_DELAY = Duration.ofMinutes(5);
    static final int MAX_PAGE_SIZE = 50;
    static final String[] DAY_LABELS = {"Su", "M", "Tu", "W", "Th", "F", "Sa"};
    static final Set<StudySessionStatus> OPEN = EnumSet.of(StudySessionStatus.ACTIVE, StudySessionStatus.PAUSED);

    private final StudySessionRepository sessionRepository;
    private final StudySessionBlockRepository blockRepository;
    private final StudySessionTaskRepository taskRepository;
    private final ProgressService progressService;
    private final ChestService chestService;
    private final ProgressRateLimiter rateLimiter;
    private final CurrentUser currentUser;
    private final Clock clock;

    public StudySessionService(StudySessionRepository sessionRepository,
                               StudySessionBlockRepository blockRepository,
                               StudySessionTaskRepository taskRepository,
                               ProgressService progressService, ChestService chestService,
                               ProgressRateLimiter rateLimiter, CurrentUser currentUser, Clock clock) {
        this.sessionRepository = sessionRepository;
        this.blockRepository = blockRepository;
        this.taskRepository = taskRepository;
        this.progressService = progressService;
        this.chestService = chestService;
        this.rateLimiter = rateLimiter;
        this.currentUser = currentUser;
        this.clock = clock;
    }

    record Plan(StudySessionMode mode, int blocks, int blockMinutes, int breakMinutes) {
        int plannedMinutes() {
            return blocks * blockMinutes;
        }
    }

    public record SweepTarget(Long userId, Long id) {
    }

    @Transactional
    public StudySessionDto start(StartSessionRequest req) {
        User user = currentUser.entity();
        Plan plan = plan(req);
        List<String> tasks = cleanTasks(req.tasks());
        UserProgress progress = progressService.ensure(user.getId());
        if (sessionRepository.findFirstByUserIdAndStatusIn(user.getId(), OPEN).isPresent()) {
            throw new ConflictException("You already have a study session running");
        }
        ZoneId zone = progressService.progressZone(progress, user);
        Instant now = clock.instant();

        StudySession session = new StudySession();
        session.setUser(user);
        session.setMode(plan.mode());
        session.setPlannedBlocks(plan.blocks());
        session.setBlockMinutes(plan.blockMinutes());
        session.setBreakMinutes(plan.breakMinutes());
        session.setPlannedMinutes(plan.plannedMinutes());
        session.setStatus(StudySessionStatus.ACTIVE);
        session.setStartedAt(now);
        session.setLocalDate(now.atZone(zone).toLocalDate());
        session.setMultiplier(progressService.multiplierFor(progressService.effectiveStreak(progress, zone)));
        session.setCurrentBlock(1);
        sessionRepository.save(session);

        newBlock(session, 1, now);
        for (int i = 0; i < tasks.size(); i++) {
            StudySessionTask task = new StudySessionTask();
            task.setSession(session);
            task.setPosition(i);
            task.setText(tasks.get(i));
            taskRepository.save(task);
        }
        return toDto(session, now);
    }

    @Transactional(readOnly = true)
    public Optional<StudySessionDto> active() {
        Long userId = currentUser.id();
        Instant now = clock.instant();
        return sessionRepository.findFirstByUserIdAndStatusIn(userId, OPEN).map(s -> toDto(s, now));
    }

    @Transactional
    public StudySessionResult checkin(Long id) {
        User user = currentUser.entity();
        rateLimiter.check(user.getId());
        ProgressDeltaBuilder delta = progressService.begin(user.getId());
        StudySession session = requireOwned(id, user.getId());
        Instant now = clock.instant();
        switch (session.getStatus()) {
            case COMPLETED -> {
                return new StudySessionResult(toDto(session, now), delta.build());
            }
            case PAUSED -> throw new ConflictException("This block expired");
            case ENDED, EXPIRED -> throw new ConflictException("This study session has finished");
            case ACTIVE -> {
            }
        }
        StudySessionBlock block = blockRepository.findBySessionIdAndBlockIndex(session.getId(), session.getCurrentBlock())
                .orElseThrow(() -> new ConflictException("This block expired"));
        if (block.getStatus() == StudyBlockStatus.CONFIRMED) {
            return new StudySessionResult(toDto(session, now), delta.build());
        }
        if (block.getStatus() != StudyBlockStatus.RUNNING || now.isAfter(block.getDueAt().plus(CHECKIN_LATE))) {
            throw new ConflictException("This block expired");
        }
        if (now.isBefore(block.getDueAt().minus(CHECKIN_EARLY))) {
            if (isReplay(session, now)) {
                return new StudySessionResult(toDto(session, now), delta.build());
            }
            throw new ConflictException("This block isn't finished yet");
        }
        confirm(delta, user, session, block, now);
        return new StudySessionResult(toDto(session, now), progressService.finish(delta));
    }

    @Transactional(noRollbackFor = ConflictException.class)
    public StudySessionDto resume(Long id) {
        User user = currentUser.entity();
        progressService.ensure(user.getId());
        StudySession session = requireOwned(id, user.getId());
        if (session.getStatus() != StudySessionStatus.PAUSED) {
            throw new ConflictException("This study session isn't paused");
        }
        Instant now = clock.instant();
        if (session.getPausedAt() != null && session.getPausedAt().isBefore(now.minus(PAUSE_LIMIT))) {
            session.setStatus(StudySessionStatus.EXPIRED);
            session.setEndedAt(now);
            throw new ConflictException("This session expired");
        }
        if (session.getCurrentBlock() >= session.getPlannedBlocks()) {
            throw new ConflictException("There are no blocks left in this session");
        }
        int next = session.getCurrentBlock() + 1;
        newBlock(session, next, now);
        session.setCurrentBlock(next);
        session.setStatus(StudySessionStatus.ACTIVE);
        session.setPausedAt(null);
        return toDto(session, now);
    }

    @Transactional
    public StudySessionResult setTaskDone(Long id, Long taskId, boolean done) {
        User user = currentUser.entity();
        rateLimiter.check(user.getId());
        ProgressDeltaBuilder delta = progressService.begin(user.getId());
        StudySession session = requireOwned(id, user.getId());
        StudySessionTask task = taskRepository.findByIdAndSessionId(taskId, session.getId())
                .orElseThrow(() -> new NotFoundException("Task not found"));
        if (!OPEN.contains(session.getStatus())) {
            throw new ConflictException("This study session has finished");
        }
        Instant now = clock.instant();
        if (done) {
            if (task.getDoneAt() == null) {
                task.setDoneAt(now);
            }
            if (session.getCreditedMinutes() > 0 && isPayable(session, task)) {
                int minutesToday = sessionRepository.sumCreditedMinutesByUserIdAndLocalDate(
                        user.getId(), session.getLocalDate());
                payTasks(delta, session, List.of(task), minutesToday);
            }
        } else {
            task.setDoneAt(null);
        }
        return new StudySessionResult(toDto(session, now), progressService.finish(delta));
    }

    @Transactional
    public StudySessionResult end(Long id) {
        User user = currentUser.entity();
        ProgressDeltaBuilder delta = progressService.begin(user.getId());
        StudySession session = requireOwned(id, user.getId());
        if (!OPEN.contains(session.getStatus())) {
            throw new ConflictException("This study session has already finished");
        }
        Instant now = clock.instant();
        if (session.getStatus() == StudySessionStatus.ACTIVE) {
            blockRepository.findBySessionIdAndBlockIndex(session.getId(), session.getCurrentBlock())
                    .filter(b -> b.getStatus() == StudyBlockStatus.RUNNING)
                    .ifPresent(b -> settleRunningBlock(delta, session, b, now));
        }
        session.setStatus(StudySessionStatus.ENDED);
        session.setEndedAt(now);
        return new StudySessionResult(toDto(session, now), progressService.finish(delta));
    }

    @Transactional(readOnly = true)
    public PageResponse<StudySessionSummaryDto> history(int page, int size) {
        Long userId = currentUser.id();
        Slice<StudySession> sessions = sessionRepository.findByUserIdOrderByStartedAtDesc(userId,
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE)));
        List<StudySessionSummaryDto> items = sessions.getContent().stream().map(this::toSummary).toList();
        return new PageResponse<>(items, sessions.hasNext());
    }

    @Transactional(readOnly = true)
    public StreakWeekDto streakWeek() {
        User user = currentUser.entity();
        UserProgress progress = progressService.current(user.getId());
        ZoneId zone = progressService.readProgressZone(progress, user);
        LocalDate today = progressService.today(zone);
        int streak = progressService.effectiveStreak(progress, zone);
        LocalDate sunday = today.minusDays(today.getDayOfWeek().getValue() % 7);
        Set<LocalDate> qualified = new HashSet<>(sessionRepository.qualifiedDates(
                user.getId(), sunday, sunday.plusDays(6), QUALIFY_MINUTES));
        List<StreakDayDto> week = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            LocalDate date = sunday.plusDays(i);
            week.add(new StreakDayDto(date, DAY_LABELS[i], qualified.contains(date), date.equals(today)));
        }
        return new StreakWeekDto(
                streak,
                progress.getStreakBest(),
                progressService.multiplierFor(streak).doubleValue(),
                sessionRepository.sumCreditedMinutesByUserIdAndLocalDate(user.getId(), today),
                today,
                week);
    }

    @Transactional(readOnly = true)
    public List<SweepTarget> overdueBlocks() {
        Instant cutoff = clock.instant().minus(CHECKIN_LATE);
        return blockRepository.findByStatusAndDueAtBefore(StudyBlockStatus.RUNNING, cutoff).stream()
                .filter(b -> b.getSession().getStatus() == StudySessionStatus.ACTIVE)
                .map(b -> new SweepTarget(b.getSession().getUser().getId(), b.getId()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<SweepTarget> dueUnnotifiedBlocks() {
        return blockRepository.findByStatusAndDueAtBeforeAndNotifiedAtIsNull(StudyBlockStatus.RUNNING, clock.instant())
                .stream()
                .filter(b -> b.getSession().getStatus() == StudySessionStatus.ACTIVE)
                .map(b -> new SweepTarget(b.getSession().getUser().getId(), b.getId()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<SweepTarget> stalePausedSessions() {
        Instant cutoff = clock.instant().minus(PAUSE_LIMIT);
        return sessionRepository.findByStatusAndPausedAtBefore(StudySessionStatus.PAUSED, cutoff).stream()
                .map(s -> new SweepTarget(s.getUser().getId(), s.getId()))
                .toList();
    }

    @Transactional
    public boolean missBlock(Long userId, Long blockId) {
        progressService.ensure(userId);
        StudySessionBlock block = blockRepository.findById(blockId).orElse(null);
        Instant now = clock.instant();
        if (block == null || block.getStatus() != StudyBlockStatus.RUNNING
                || !now.isAfter(block.getDueAt().plus(CHECKIN_LATE))) {
            return false;
        }
        StudySession session = block.getSession();
        if (session.getStatus() != StudySessionStatus.ACTIVE || !session.getUser().getId().equals(userId)) {
            return false;
        }
        block.setStatus(StudyBlockStatus.MISSED);
        if (block.getBlockIndex() >= session.getPlannedBlocks()) {
            session.setStatus(StudySessionStatus.EXPIRED);
            session.setEndedAt(now);
        } else {
            session.setStatus(StudySessionStatus.PAUSED);
            session.setPausedAt(now);
        }
        return true;
    }

    @Transactional
    public boolean markNotified(Long userId, Long blockId) {
        progressService.ensure(userId);
        StudySessionBlock block = blockRepository.findById(blockId).orElse(null);
        Instant now = clock.instant();
        if (block == null || block.getStatus() != StudyBlockStatus.RUNNING || block.getNotifiedAt() != null
                || block.getDueAt().isAfter(now)) {
            return false;
        }
        StudySession session = block.getSession();
        if (session.getStatus() != StudySessionStatus.ACTIVE || !session.getUser().getId().equals(userId)) {
            return false;
        }
        block.setNotifiedAt(now);
        return true;
    }

    @Transactional
    public boolean expire(Long userId, Long sessionId) {
        progressService.ensure(userId);
        StudySession session = sessionRepository.findByIdAndUserId(sessionId, userId).orElse(null);
        Instant now = clock.instant();
        if (session == null || session.getStatus() != StudySessionStatus.PAUSED || session.getPausedAt() == null
                || !session.getPausedAt().isBefore(now.minus(PAUSE_LIMIT))) {
            return false;
        }
        session.setStatus(StudySessionStatus.EXPIRED);
        session.setEndedAt(now);
        return true;
    }

    static BigDecimal dayFactor(int minutesToday) {
        if (minutesToday <= FULL_RATE_MINUTES) {
            return BigDecimal.ONE;
        }
        if (minutesToday <= HALF_RATE_MINUTES) {
            return HALF;
        }
        return BigDecimal.ZERO;
    }

    static int scaled(int base, BigDecimal multiplier, BigDecimal factor) {
        return BigDecimal.valueOf(base).multiply(multiplier).multiply(factor)
                .setScale(0, RoundingMode.HALF_UP).intValue();
    }

    static int curve(int base, BigDecimal multiplier, int minutesBefore, int minutes) {
        if (base <= 0 || minutes <= 0) {
            return 0;
        }
        int full = clamp(FULL_RATE_MINUTES - minutesBefore, minutes);
        int half = clamp(Math.min(minutesBefore + minutes, HALF_RATE_MINUTES)
                - Math.max(minutesBefore, FULL_RATE_MINUTES), minutes);
        return BigDecimal.valueOf(base)
                .multiply(multiplier)
                .multiply(BigDecimal.valueOf(2L * full + half))
                .divide(BigDecimal.valueOf(2L * minutes), 0, RoundingMode.HALF_UP)
                .intValue();
    }

    private static int clamp(int value, int max) {
        return Math.max(0, Math.min(value, max));
    }

    private Plan plan(StartSessionRequest req) {
        if (req.mode() == null) {
            throw new BadRequestException("Pick a session mode");
        }
        return switch (req.mode()) {
            case POMODORO -> {
                int blocks = req.blocks() == null ? POMODORO_DEFAULT_BLOCKS : req.blocks();
                if (blocks < 1 || blocks > MAX_BLOCKS) {
                    throw new BadRequestException("Pomodoro sessions have 1 to 8 blocks");
                }
                yield new Plan(StudySessionMode.POMODORO, blocks, POMODORO_BLOCK_MINUTES, POMODORO_BREAK_MINUTES);
            }
            case TIMER -> {
                int minutes = req.minutes() == null ? TIMER_DEFAULT_MINUTES : req.minutes();
                if (!TIMER_MINUTES.contains(minutes)) {
                    throw new BadRequestException("Timer sessions run 30 minutes to 3 hours, in 30-minute steps");
                }
                yield new Plan(StudySessionMode.TIMER, minutes / TIMER_BLOCK_MINUTES, TIMER_BLOCK_MINUTES, 0);
            }
        };
    }

    private List<String> cleanTasks(List<String> raw) {
        if (raw == null) {
            return List.of();
        }
        List<String> tasks = raw.stream()
                .filter(t -> t != null && !t.isBlank())
                .map(String::trim)
                .toList();
        if (tasks.size() > MAX_TASKS) {
            throw new BadRequestException("You can add up to 10 tasks");
        }
        if (tasks.stream().anyMatch(t -> t.length() > MAX_TASK_LENGTH)) {
            throw new BadRequestException("Tasks can be at most 200 characters");
        }
        return tasks;
    }

    private StudySession requireOwned(Long id, Long userId) {
        return sessionRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new NotFoundException("Study session not found"));
    }

    private StudySessionBlock newBlock(StudySession session, int index, Instant startedAt) {
        StudySessionBlock block = new StudySessionBlock();
        block.setSession(session);
        block.setBlockIndex(index);
        block.setStartedAt(startedAt);
        block.setDueAt(startedAt.plus(Duration.ofMinutes(session.getBlockMinutes())));
        block.setStatus(StudyBlockStatus.RUNNING);
        return blockRepository.save(block);
    }

    private boolean isReplay(StudySession session, Instant now) {
        if (session.getCurrentBlock() <= 1) {
            return false;
        }
        return blockRepository.findBySessionIdAndBlockIndex(session.getId(), session.getCurrentBlock() - 1)
                .filter(b -> b.getStatus() == StudyBlockStatus.CONFIRMED && b.getConfirmedAt() != null)
                .map(b -> !b.getConfirmedAt().isBefore(now.minus(REPLAY_WINDOW)))
                .orElse(false);
    }

    private void confirm(ProgressDeltaBuilder delta, User user, StudySession session, StudySessionBlock block,
                         Instant now) {
        int minutes = session.getBlockMinutes();
        int before = sessionRepository.sumCreditedMinutesByUserIdAndLocalDate(user.getId(), session.getLocalDate());
        int xp = curve(2 * minutes + 10, session.getMultiplier(), before, minutes);
        block.setStatus(StudyBlockStatus.CONFIRMED);
        block.setConfirmedAt(now);
        block.setCreditedMinutes(minutes);
        int granted = progressService.grantXp(delta, XpSource.STUDY_BLOCK, xp,
                "study-block:" + block.getId(), block.getId());
        block.setXpAwarded(granted);
        credit(delta, session, before, minutes, granted);

        if (block.getBlockIndex() >= session.getPlannedBlocks()) {
            complete(delta, session, before + minutes, now);
            return;
        }
        int next = block.getBlockIndex() + 1;
        newBlock(session, next, now.plus(Duration.ofMinutes(session.getBreakMinutes())));
        session.setCurrentBlock(next);
    }

    private void complete(ProgressDeltaBuilder delta, StudySession session, int minutesToday, Instant now) {
        session.setStatus(StudySessionStatus.COMPLETED);
        session.setEndedAt(now);
        if (session.getPlannedMinutes() < BONUS_MIN_PLANNED_MINUTES) {
            return;
        }
        long confirmed = blockRepository.findBySessionIdOrderByBlockIndex(session.getId()).stream()
                .filter(b -> b.getStatus() == StudyBlockStatus.CONFIRMED)
                .count();
        if (confirmed < session.getPlannedBlocks()) {
            return;
        }
        int granted = progressService.grantXp(delta, XpSource.STUDY_COMPLETE,
                scaled(COMPLETE_BONUS, session.getMultiplier(), dayFactor(minutesToday)),
                "study-complete:" + session.getId(), session.getId());
        session.setXpAwarded(session.getXpAwarded() + granted);
        chestService.maybeDrop(delta, ChestSource.SESSION, "session:" + session.getId(),
                SESSION_CHEST_CHANCE, session.getLocalDate());
    }

    private void settleRunningBlock(ProgressDeltaBuilder delta, StudySession session, StudySessionBlock block,
                                    Instant now) {
        if (now.isAfter(block.getDueAt().plus(CHECKIN_LATE))) {
            block.setStatus(StudyBlockStatus.MISSED);
            return;
        }
        long elapsed = Duration.between(block.getStartedAt(), now).toMinutes();
        if (elapsed < PARTIAL_MIN_MINUTES) {
            blockRepository.delete(block);
            return;
        }
        int minutes = (int) Math.min(elapsed, session.getBlockMinutes());
        int before = sessionRepository.sumCreditedMinutesByUserIdAndLocalDate(
                session.getUser().getId(), session.getLocalDate());
        int xp = curve(2 * minutes, session.getMultiplier(), before, minutes);
        block.setStatus(StudyBlockStatus.PARTIAL);
        block.setCreditedMinutes(minutes);
        int granted = progressService.grantXp(delta, XpSource.STUDY_PARTIAL, xp,
                "study-block:" + block.getId(), block.getId());
        block.setXpAwarded(granted);
        credit(delta, session, before, minutes, granted);
    }

    private void credit(ProgressDeltaBuilder delta, StudySession session, int before, int minutes, int xp) {
        boolean firstCredit = session.getCreditedMinutes() == 0 && minutes > 0;
        session.setCreditedMinutes(session.getCreditedMinutes() + minutes);
        session.setXpAwarded(session.getXpAwarded() + xp);
        if (before + minutes >= QUALIFY_MINUTES) {
            progressService.recordQualifiedDay(delta, session.getLocalDate());
        }
        if (firstCredit) {
            List<StudySessionTask> pending = taskRepository.findBySessionIdOrderByPosition(session.getId()).stream()
                    .filter(t -> isPayable(session, t))
                    .toList();
            payTasks(delta, session, pending, before + minutes);
        }
    }

    private boolean isPayable(StudySession session, StudySessionTask task) {
        return task.getDoneAt() != null
                && task.getXpAwarded() == 0
                && task.getPosition() < TASK_XP_POSITIONS
                && !task.getDoneAt().isBefore(session.getStartedAt().plus(TASK_XP_DELAY));
    }

    private void payTasks(ProgressDeltaBuilder delta, StudySession session, List<StudySessionTask> tasks,
                          int minutesToday) {
        if (tasks.isEmpty()) {
            return;
        }
        int xp = scaled(TASK_XP, BigDecimal.ONE, dayFactor(minutesToday));
        if (xp <= 0) {
            return;
        }
        long paidToday = taskRepository.countPaidByUserIdAndLocalDate(session.getUser().getId(), session.getLocalDate());
        for (StudySessionTask task : tasks) {
            if (paidToday >= MAX_PAID_TASKS_PER_DAY) {
                return;
            }
            int granted = progressService.grantXp(delta, XpSource.STUDY_TASK, xp,
                    "study-task:" + task.getId(), task.getId());
            if (granted > 0) {
                task.setXpAwarded(granted);
                session.setXpAwarded(session.getXpAwarded() + granted);
                paidToday++;
            }
        }
    }

    private StudySessionDto toDto(StudySession s, Instant now) {
        List<StudySessionBlock> blocks = blockRepository.findBySessionIdOrderByBlockIndex(s.getId());
        List<StudySessionTask> tasks = taskRepository.findBySessionIdOrderByPosition(s.getId());
        StudySessionBlock running = s.getStatus() == StudySessionStatus.ACTIVE
                ? blocks.stream().filter(b -> b.getStatus() == StudyBlockStatus.RUNNING).findFirst().orElse(null)
                : null;
        return new StudySessionDto(
                s.getId(),
                s.getMode(),
                s.getStatus(),
                s.getPlannedBlocks(),
                s.getBlockMinutes(),
                s.getBreakMinutes(),
                s.getPlannedMinutes(),
                s.getStartedAt(),
                s.getEndedAt(),
                s.getCurrentBlock(),
                running == null ? null : running.getDueAt().minus(CHECKIN_EARLY),
                running == null ? null : running.getDueAt().plus(CHECKIN_LATE),
                s.getCreditedMinutes(),
                s.getXpAwarded(),
                s.getMultiplier().doubleValue(),
                tasks.stream().map(StudySessionTaskDto::from).toList(),
                blocks.stream().map(StudySessionBlockDto::from).toList(),
                now);
    }

    private StudySessionSummaryDto toSummary(StudySession s) {
        List<StudySessionTask> tasks = taskRepository.findBySessionIdOrderByPosition(s.getId());
        int done = (int) tasks.stream().filter(t -> t.getDoneAt() != null).count();
        return new StudySessionSummaryDto(s.getId(), s.getMode(), s.getStatus(), s.getStartedAt(), s.getEndedAt(),
                s.getPlannedMinutes(), s.getCreditedMinutes(), s.getXpAwarded(), done, tasks.size());
    }
}
