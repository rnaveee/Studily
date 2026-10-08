package com.rnave.studily.progress;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.progress.ProgressDtos.BadgeSummary;
import com.rnave.studily.progress.ProgressDtos.ChestDto;
import com.rnave.studily.progress.ProgressDtos.ProgressDelta;
import com.rnave.studily.progress.ProgressDtos.ProgressDto;
import com.rnave.studily.progress.ProgressDtos.PublicProgressDto;
import com.rnave.studily.progress.ProgressDtos.StreakDto;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import com.rnave.studily.user.UserTimeZones;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Optional;

@Service
public class ProgressService {

    static final int FRIEND_XP = 50;
    static final int FRIEND_GRANTS_PER_WINDOW = 10;
    static final Duration FRIEND_WINDOW = Duration.ofHours(24);
    static final int STREAK_CHEST_EVERY = 7;
    static final int LEVEL_CHEST_EVERY = 5;
    private static final BigDecimal MAX_MULTIPLIER = new BigDecimal("1.50");
    private static final BigDecimal MULTIPLIER_STEP = new BigDecimal("0.10");

    private final UserProgressRepository userProgressRepository;
    private final XpEventRepository xpEventRepository;
    private final CoinTransactionRepository coinTransactionRepository;
    private final ChestRepository chestRepository;
    private final UserRepository userRepository;
    private final BadgeService badgeService;
    private final UserTimeZones timeZones;
    private final CurrentUser currentUser;
    private final Clock clock;

    public ProgressService(UserProgressRepository userProgressRepository, XpEventRepository xpEventRepository,
                           CoinTransactionRepository coinTransactionRepository, ChestRepository chestRepository,
                           UserRepository userRepository, BadgeService badgeService, UserTimeZones timeZones,
                           CurrentUser currentUser, Clock clock) {
        this.userProgressRepository = userProgressRepository;
        this.xpEventRepository = xpEventRepository;
        this.coinTransactionRepository = coinTransactionRepository;
        this.chestRepository = chestRepository;
        this.userRepository = userRepository;
        this.badgeService = badgeService;
        this.timeZones = timeZones;
        this.currentUser = currentUser;
        this.clock = clock;
    }

    @Transactional
    public UserProgress ensure(Long userId) {
        userProgressRepository.insertIfMissing(userId);
        return userProgressRepository.findForUpdate(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }

    @Transactional
    public ProgressDeltaBuilder begin(Long userId) {
        return new ProgressDeltaBuilder(ensure(userId));
    }

    @Transactional(readOnly = true)
    public UserProgress current(Long userId) {
        return userProgressRepository.findById(userId).orElseGet(() -> {
            UserProgress blank = new UserProgress();
            blank.setUserId(userId);
            return blank;
        });
    }

    @Transactional
    public ProgressDeltaBuilder grantXp(Long userId, XpSource source, int amount, String dedupeKey, Long refId) {
        ProgressDeltaBuilder delta = begin(userId);
        grantXp(delta, source, amount, dedupeKey, refId);
        return delta;
    }

    @Transactional
    public int grantXp(ProgressDeltaBuilder delta, XpSource source, int amount, String dedupeKey, Long refId) {
        if (amount <= 0 || xpEventRepository.existsByDedupeKey(dedupeKey)) {
            return 0;
        }
        UserProgress progress = delta.progress();
        Instant now = clock.instant();
        XpEvent event = new XpEvent();
        event.setUser(userRepository.getReferenceById(progress.getUserId()));
        event.setSource(source);
        event.setAmount(amount);
        event.setDedupeKey(dedupeKey);
        event.setRefId(refId);
        event.setCreatedAt(now);
        xpEventRepository.save(event);

        progress.setXp(progress.getXp() + amount);
        progress.setUpdatedAt(now);
        int target = LevelMath.levelFor(progress.getXp());
        while (progress.getLevel() < target) {
            int next = progress.getLevel() + 1;
            progress.setLevel(next);
            addCoins(delta, 20 + 5 * next, CoinReason.LEVEL_UP, "level:" + next);
            if (next % LEVEL_CHEST_EVERY == 0) {
                grantChest(delta, ChestSource.LEVEL, "level:" + next);
            }
        }
        return amount;
    }

    @Transactional
    public void addCoins(ProgressDeltaBuilder delta, int amount, CoinReason reason, String ref) {
        if (amount == 0) {
            return;
        }
        UserProgress progress = delta.progress();
        if (progress.getCoins() + amount < 0) {
            throw new BadRequestException("Not enough coins");
        }
        Instant now = clock.instant();
        progress.setCoins(progress.getCoins() + amount);
        progress.setUpdatedAt(now);
        CoinTransaction tx = new CoinTransaction();
        tx.setUser(userRepository.getReferenceById(progress.getUserId()));
        tx.setAmount(amount);
        tx.setReason(reason);
        tx.setRef(ref);
        tx.setCreatedAt(now);
        coinTransactionRepository.save(tx);
    }

    @Transactional
    public Optional<Chest> grantChest(ProgressDeltaBuilder delta, ChestSource source, String sourceRef) {
        Long userId = delta.userId();
        if (chestRepository.existsByUserIdAndSourceAndSourceRef(userId, source, sourceRef)) {
            return Optional.empty();
        }
        Chest chest = new Chest();
        chest.setUser(userRepository.getReferenceById(userId));
        chest.setSource(source);
        chest.setSourceRef(sourceRef);
        chest.setCreatedAt(clock.instant());
        chestRepository.save(chest);
        delta.addChest(ChestDto.of(chest, null));
        return Optional.of(chest);
    }

    @Transactional
    public void recordQualifiedDay(ProgressDeltaBuilder delta, LocalDate day) {
        UserProgress progress = delta.progress();
        LocalDate last = progress.getStreakLastDate();
        if (last != null && !day.isAfter(last)) {
            return;
        }
        boolean continues = last != null && last.equals(day.minusDays(1));
        progress.setStreakCurrent(continues ? progress.getStreakCurrent() + 1 : 1);
        progress.setStreakBest(Math.max(progress.getStreakBest(), progress.getStreakCurrent()));
        progress.setStreakLastDate(day);
        progress.setUpdatedAt(clock.instant());
        if (progress.getStreakCurrent() % STREAK_CHEST_EVERY == 0) {
            grantChest(delta, ChestSource.STREAK, "streak:" + day);
        }
    }

    @Transactional
    public ProgressDelta finish(ProgressDeltaBuilder delta) {
        delta.addBadges(badgeService.evaluate(delta.userId()));
        return delta.build();
    }

    public BigDecimal multiplierFor(int streak) {
        BigDecimal bonus = MULTIPLIER_STEP.multiply(BigDecimal.valueOf(Math.max(0, streak - 1)));
        return BigDecimal.ONE.add(bonus).min(MAX_MULTIPLIER).setScale(2, RoundingMode.HALF_UP);
    }

    public int effectiveStreak(UserProgress progress, ZoneId zone) {
        LocalDate last = progress.getStreakLastDate();
        if (last == null) {
            return 0;
        }
        LocalDate today = LocalDate.now(clock.withZone(zone));
        return last.isBefore(today.minusDays(1)) ? 0 : progress.getStreakCurrent();
    }

    public LocalDate today(ZoneId zone) {
        return LocalDate.now(clock.withZone(zone));
    }

    @Transactional
    public ProgressDto me() {
        User user = currentUser.entity();
        UserProgress progress = ensure(user.getId());
        badgeService.evaluate(user.getId());
        int streak = effectiveStreak(progress, timeZones.zoneFor(user));
        BadgeSummary badges = badgeService.summary(user.getId());
        return new ProgressDto(
                progress.getLevel(),
                progress.getXp(),
                LevelMath.xpIntoLevel(progress.getXp(), progress.getLevel()),
                LevelMath.xpToNext(progress.getLevel()),
                progress.getCoins(),
                new StreakDto(streak, progress.getStreakBest(), multiplierFor(streak).doubleValue()),
                badges.featured(),
                badges.count(),
                badges.total(),
                chestRepository.countByUserIdAndOpenedAtIsNull(user.getId()));
    }

    @Transactional(readOnly = true)
    public PublicProgressDto publicFor(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        UserProgress progress = current(userId);
        BadgeSummary badges = badgeService.summary(userId);
        return new PublicProgressDto(
                userId,
                progress.getLevel(),
                progress.getXp(),
                LevelMath.xpIntoLevel(progress.getXp(), progress.getLevel()),
                LevelMath.xpToNext(progress.getLevel()),
                effectiveStreak(progress, timeZones.zoneFor(user)),
                badges.featured(),
                badges.count(),
                badges.total());
    }

    @Transactional
    public void onFriendshipAccepted(Long requesterId, Long addresseeId) {
        if (requesterId.equals(addresseeId)) {
            return;
        }
        Long first = Math.min(requesterId, addresseeId);
        Long second = Math.max(requesterId, addresseeId);
        ProgressDeltaBuilder firstDelta = begin(first);
        ProgressDeltaBuilder secondDelta = begin(second);
        grantFriendXp(firstDelta, second);
        grantFriendXp(secondDelta, first);
        finish(firstDelta);
        finish(secondDelta);
    }

    private void grantFriendXp(ProgressDeltaBuilder delta, Long otherId) {
        Instant since = clock.instant().minus(FRIEND_WINDOW);
        long recent = xpEventRepository.countByUserIdAndSourceAndCreatedAtAfter(delta.userId(), XpSource.FRIEND, since);
        if (recent >= FRIEND_GRANTS_PER_WINDOW) {
            return;
        }
        grantXp(delta, XpSource.FRIEND, FRIEND_XP, "friend:" + delta.userId() + ":" + otherId, otherId);
    }
}
