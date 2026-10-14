package com.rnave.studily.progress;

import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.progress.ProgressDtos.BadgeDto;
import com.rnave.studily.progress.ProgressDtos.ChestDto;
import com.rnave.studily.progress.ProgressDtos.ChestOpenResult;
import com.rnave.studily.progress.ProgressDtos.FlairDto;
import com.rnave.studily.progress.ProgressDtos.ProgressDelta;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.random.RandomGenerator;

@Service
public class ChestService {

    record LootTable(int coinsMin, int coinsMax, double xpChance, int xpMin, int xpMax, double badgeChance,
                     double flairChance) {
    }

    static final Map<ChestTier, LootTable> LOOT = new EnumMap<>(Map.of(
            ChestTier.WOOD, new LootTable(20, 50, 0.25, 25, 60, 0.02, 0.02),
            ChestTier.SILVER, new LootTable(40, 100, 0.4, 50, 120, 0.04, 0.04),
            ChestTier.GOLD, new LootTable(90, 180, 0.6, 80, 180, 0.07, 0.07),
            ChestTier.DIAMOND, new LootTable(180, 350, 1.0, 120, 250, 0.12, 0.12)));
    static final int DAILY_DROP_LIMIT = 2;
    static final int ALL_COSMETICS_OWNED_COINS = 100;
    static final int ALL_LOOT_FLAIRS_OWNED_COINS = 100;
    static final double SESSION_BONUS_CHANCE = 0.4;
    static final int SESSION_BONUS_FROM_BLOCK = 7;

    private final ChestRepository chestRepository;
    private final ProgressService progressService;
    private final BadgeService badgeService;
    private final FlairService flairService;
    private final CurrentUser currentUser;
    private final Clock clock;
    private final RandomGenerator random;

    public ChestService(ChestRepository chestRepository, ProgressService progressService, BadgeService badgeService,
                        FlairService flairService, CurrentUser currentUser, Clock clock, RandomGenerator random) {
        this.chestRepository = chestRepository;
        this.progressService = progressService;
        this.badgeService = badgeService;
        this.flairService = flairService;
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

        Loot loot = rollLoot(userId, chest.getTier());
        chest.setLootCoins(loot.coins());
        chest.setLootXp(loot.xp());
        chest.setLootBadge(loot.badge());
        chest.setLootFlairCode(loot.flair() != null ? loot.flair().getCode() : null);
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
        FlairDto flairDto = null;
        if (loot.flair() != null) {
            UserFlair userFlair = flairService.grant(userId, loot.flair(), FlairSource.CHEST);
            flairDto = flairService.toDto(loot.flair(), userFlair, false);
            delta.addFlair(flairDto);
        }
        ProgressDelta result = progressService.finish(delta);
        return new ChestOpenResult(ChestDto.of(chest, badgeDto, flairDto), result);
    }

    @Transactional
    public Optional<Chest> maybeDrop(ProgressDeltaBuilder delta, ChestSource source, String sourceRef,
                                     double chance, LocalDate localDate) {
        if (chestRepository.countByUserIdAndSourceAndLocalDate(delta.userId(), source, localDate) >= DAILY_DROP_LIMIT) {
            return Optional.empty();
        }
        if (random.nextDouble() >= chance) {
            return Optional.empty();
        }
        return progressService.grantChest(delta, source, sourceRef, localDate);
    }

    @Transactional
    public List<Chest> grantSessionChests(ProgressDeltaBuilder delta, Long sessionId, int confirmedBlocks,
                                          LocalDate localDate) {
        List<ChestTier> tiers = sessionChestTiers(confirmedBlocks, random);
        List<Chest> granted = new ArrayList<>();
        for (int i = 0; i < tiers.size(); i++) {
            progressService.grantChest(delta, ChestSource.SESSION, "session:" + sessionId + ":" + (i + 1), localDate,
                    tiers.get(i)).ifPresent(granted::add);
        }
        return granted;
    }

    @Transactional(readOnly = true)
    public List<ChestDto> sessionChests(Long userId, Long sessionId) {
        return chestRepository.findByUserIdAndSourceAndSourceRefStartingWithOrderById(userId, ChestSource.SESSION,
                        "session:" + sessionId + ":").stream()
                .map(c -> ChestDto.of(c, null))
                .toList();
    }

    static List<ChestTier> sessionChestTiers(int blocks, RandomGenerator random) {
        List<ChestTier> tiers = new ArrayList<>();
        if (blocks <= 0) {
            return tiers;
        }
        ChestTier base = blocks >= 7 ? ChestTier.DIAMOND
                : blocks >= 5 ? ChestTier.GOLD
                : blocks >= 3 ? ChestTier.SILVER
                : ChestTier.WOOD;
        tiers.add(base);
        if (blocks < SESSION_BONUS_FROM_BLOCK && blocks % 2 == 0 && random.nextDouble() < SESSION_BONUS_CHANCE) {
            tiers.add(base.lower());
        }
        for (int block = SESSION_BONUS_FROM_BLOCK; block <= blocks; block++) {
            if (random.nextDouble() < SESSION_BONUS_CHANCE) {
                tiers.add(ChestTier.GOLD);
            }
        }
        return tiers;
    }

    Loot rollLoot(Long userId, ChestTier tier) {
        LootTable table = LOOT.get(tier);
        int coins = table.coinsMin() + random.nextInt(table.coinsMax() - table.coinsMin() + 1);
        int xp = 0;
        if (random.nextDouble() < table.xpChance()) {
            xp = table.xpMin() + random.nextInt(table.xpMax() - table.xpMin() + 1);
        }
        Badge badge = null;
        if (random.nextDouble() < table.badgeChance()) {
            List<Badge> candidates = badgeService.unownedCosmetics(userId);
            if (candidates.isEmpty()) {
                coins += ALL_COSMETICS_OWNED_COINS;
            } else {
                badge = candidates.get(random.nextInt(candidates.size()));
            }
        }
        Flair flair = null;
        if (random.nextDouble() < table.flairChance()) {
            List<Flair> candidates = flairService.unownedLootable(userId);
            if (candidates.isEmpty()) {
                coins += ALL_LOOT_FLAIRS_OWNED_COINS;
            } else {
                flair = candidates.get(random.nextInt(candidates.size()));
            }
        }
        return new Loot(coins, xp, badge, flair);
    }

    record Loot(int coins, int xp, Badge badge, Flair flair) {
    }
}
