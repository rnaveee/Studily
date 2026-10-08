package com.rnave.studily.progress;

import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.progress.ProgressDtos.BadgeDto;
import com.rnave.studily.progress.ProgressDtos.ChestDto;
import com.rnave.studily.progress.ProgressDtos.ChestOpenResult;
import com.rnave.studily.progress.ProgressDtos.ProgressDelta;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.random.RandomGenerator;

@Service
public class ChestService {

    static final int LOOT_COINS_MIN = 30;
    static final int LOOT_COINS_MAX = 120;
    static final double LOOT_XP_CHANCE = 0.4;
    static final int LOOT_XP_MIN = 50;
    static final int LOOT_XP_MAX = 150;
    static final double LOOT_BADGE_CHANCE = 0.05;
    static final int ALL_COSMETICS_OWNED_COINS = 100;

    private final ChestRepository chestRepository;
    private final ProgressService progressService;
    private final BadgeService badgeService;
    private final CurrentUser currentUser;
    private final Clock clock;
    private final RandomGenerator random;

    public ChestService(ChestRepository chestRepository, ProgressService progressService, BadgeService badgeService,
                        CurrentUser currentUser, Clock clock, RandomGenerator random) {
        this.chestRepository = chestRepository;
        this.progressService = progressService;
        this.badgeService = badgeService;
        this.currentUser = currentUser;
        this.clock = clock;
        this.random = random;
    }

    @Transactional(readOnly = true)
    public List<ChestDto> unopened() {
        return chestRepository.findByUserIdAndOpenedAtIsNullOrderByCreatedAt(currentUser.id()).stream()
                .map(c -> ChestDto.of(c, null))
                .toList();
    }

    @Transactional
    public ChestOpenResult open(Long chestId) {
        Long userId = currentUser.id();
        ProgressDeltaBuilder delta = progressService.begin(userId);
        Instant now = clock.instant();
        if (chestRepository.markOpened(chestId, userId, now) == 0) {
            if (chestRepository.findByIdAndUserId(chestId, userId).isPresent()) {
                throw new ConflictException("Chest already opened");
            }
            throw new NotFoundException("Chest not found");
        }
        Chest chest = chestRepository.findByIdAndUserId(chestId, userId)
                .orElseThrow(() -> new NotFoundException("Chest not found"));
        chest.setOpenedAt(now);

        Loot loot = rollLoot(userId);
        chest.setLootCoins(loot.coins());
        chest.setLootXp(loot.xp());
        chest.setLootBadge(loot.badge());
        chestRepository.save(chest);

        String ref = "chest:" + chestId;
        progressService.addCoins(delta, loot.coins(), CoinReason.CHEST, ref);
        progressService.grantXp(delta, XpSource.CHEST, loot.xp(), ref, chestId);
        BadgeDto badgeDto = null;
        if (loot.badge() != null) {
            UserBadge userBadge = badgeService.grant(userId, loot.badge(), BadgeSource.CHEST);
            badgeDto = badgeService.toDto(loot.badge(), userBadge);
            delta.addBadge(badgeDto);
        }
        ProgressDelta result = progressService.finish(delta);
        return new ChestOpenResult(ChestDto.of(chest, badgeDto), result);
    }

    @Transactional
    public Optional<Chest> maybeDrop(ProgressDeltaBuilder delta, ChestSource source, String sourceRef,
                                     double chance, LocalDate localDate) {
        if (chestRepository.countByUserIdAndSourceAndLocalDate(delta.userId(), source, localDate) > 0) {
            return Optional.empty();
        }
        if (random.nextDouble() >= chance) {
            return Optional.empty();
        }
        return progressService.grantChest(delta, source, sourceRef, localDate);
    }

    Loot rollLoot(Long userId) {
        int coins = LOOT_COINS_MIN + random.nextInt(LOOT_COINS_MAX - LOOT_COINS_MIN + 1);
        int xp = 0;
        if (random.nextDouble() < LOOT_XP_CHANCE) {
            xp = LOOT_XP_MIN + random.nextInt(LOOT_XP_MAX - LOOT_XP_MIN + 1);
        }
        Badge badge = null;
        if (random.nextDouble() < LOOT_BADGE_CHANCE) {
            List<Badge> candidates = badgeService.unownedCosmetics(userId);
            if (candidates.isEmpty()) {
                coins += ALL_COSMETICS_OWNED_COINS;
            } else {
                badge = candidates.get(random.nextInt(candidates.size()));
            }
        }
        return new Loot(coins, xp, badge);
    }

    record Loot(int coins, int xp, Badge badge) {
    }
}
