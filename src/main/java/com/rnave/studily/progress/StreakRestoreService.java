package com.rnave.studily.progress;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.progress.ProgressDtos.ProgressDelta;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
public class StreakRestoreService {

    static final int WEEKLY_RESTORES = 2;

    public record BrokenStreak(int lostStreak, List<LocalDate> missedDays, boolean restarted) {
    }

    private final ProgressService progressService;
    private final StreakRestoreRepository restoreRepository;
    private final UserRepository userRepository;
    private final ProgressRateLimiter rateLimiter;
    private final CurrentUser currentUser;
    private final Clock clock;

    public StreakRestoreService(ProgressService progressService, StreakRestoreRepository restoreRepository,
                                UserRepository userRepository, ProgressRateLimiter rateLimiter,
                                CurrentUser currentUser, Clock clock) {
        this.progressService = progressService;
        this.restoreRepository = restoreRepository;
        this.userRepository = userRepository;
        this.rateLimiter = rateLimiter;
        this.currentUser = currentUser;
        this.clock = clock;
    }

    public static LocalDate weekStart(LocalDate day) {
        return day.minusDays(day.getDayOfWeek().getValue() % 7);
    }

    public Optional<BrokenStreak> brokenStreak(UserProgress progress, LocalDate today) {
        LocalDate last = progress.getStreakLastDate();
        if (last == null) {
            return Optional.empty();
        }
        if (progress.getStreakCurrent() > 0 && last.isBefore(today.minusDays(1))) {
            return gap(progress.getStreakCurrent(), last, today, false);
        }
        if (progress.getStreakCurrent() == 1 && last.equals(today)
                && progress.getStreakLost() > 0 && progress.getStreakLostLastDate() != null) {
            return gap(progress.getStreakLost(), progress.getStreakLostLastDate(), today, true);
        }
        return Optional.empty();
    }

    private static Optional<BrokenStreak> gap(int lostStreak, LocalDate lastDay, LocalDate resumeDay,
                                              boolean restarted) {
        List<LocalDate> missed = lastDay.plusDays(1).datesUntil(resumeDay).toList();
        if (missed.isEmpty() || missed.size() > WEEKLY_RESTORES) {
            return Optional.empty();
        }
        return Optional.of(new BrokenStreak(lostStreak, missed, restarted));
    }

    @Transactional(readOnly = true)
    public int restoresLeft(Long userId, LocalDate today) {
        LocalDate start = weekStart(today);
        long used = restoreRepository.countByUserIdAndUsedOnBetween(userId, start, start.plusDays(6));
        return (int) Math.max(0, WEEKLY_RESTORES - used);
    }

    @Transactional(readOnly = true)
    public Set<LocalDate> restoredDates(Long userId, LocalDate from, LocalDate to) {
        return new HashSet<>(restoreRepository.restoredDates(userId, from, to));
    }

    @Transactional
    public ProgressDelta restore() {
        User user = currentUser.entity();
        rateLimiter.check(user.getId());
        ProgressDeltaBuilder delta = progressService.begin(user.getId());
        UserProgress progress = delta.progress();
        LocalDate today = progressService.today(progressService.progressZone(progress, user));
        BrokenStreak broken = brokenStreak(progress, today)
                .orElseThrow(() -> new BadRequestException("There's no streak to restore"));
        if (broken.missedDays().size() > restoresLeft(user.getId(), today)) {
            throw new BadRequestException("Not enough streak restores left this week");
        }
        Instant now = clock.instant();
        for (LocalDate day : broken.missedDays()) {
            StreakRestore restore = new StreakRestore();
            restore.setUser(userRepository.getReferenceById(user.getId()));
            restore.setRestoredDate(day);
            restore.setUsedOn(today);
            restore.setCreatedAt(now);
            restoreRepository.save(restore);
        }
        if (broken.restarted()) {
            progressService.mergeRestoredStreak(delta, broken.lostStreak(), today);
        } else {
            progress.setStreakLastDate(today.minusDays(1));
        }
        progress.setStreakLost(0);
        progress.setStreakLostLastDate(null);
        progress.setUpdatedAt(now);
        return progressService.finish(delta);
    }
}
