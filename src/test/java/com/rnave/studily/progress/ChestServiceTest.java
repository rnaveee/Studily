package com.rnave.studily.progress;

import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.progress.ProgressDtos.BadgeDto;
import com.rnave.studily.progress.ProgressDtos.ChestOpenResult;
import com.rnave.studily.progress.ProgressDtos.FlairDto;
import com.rnave.studily.user.Flairs;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import com.rnave.studily.user.UserTimeZones;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Random;
import java.util.Set;
import java.util.random.RandomGenerator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ChestServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-07T18:00:00Z");

    private ChestRepository chestRepository;
    private UserProgressRepository userProgressRepository;
    private XpEventRepository xpEventRepository;
    private CoinTransactionRepository coinTransactionRepository;
    private UserRepository userRepository;
    private BadgeService badgeService;
    private FlairRepository flairRepository;
    private UserFlairRepository userFlairRepository;
    private FlairService flairService;
    private CurrentUser currentUser;
    private RandomGenerator random;
    private ProgressService progressService;
    private ChestService service;

    private final List<XpEvent> xpEvents = new ArrayList<>();
    private final List<CoinTransaction> coinTransactions = new ArrayList<>();
    private final List<Flair> flairCatalog = new ArrayList<>();
    private final List<UserFlair> ownedFlairs = new ArrayList<>();
    private UserProgress progress;
    private Chest chest;

    @BeforeEach
    void setUp() {
        chestRepository = mock(ChestRepository.class);
        userProgressRepository = mock(UserProgressRepository.class);
        xpEventRepository = mock(XpEventRepository.class);
        coinTransactionRepository = mock(CoinTransactionRepository.class);
        userRepository = mock(UserRepository.class);
        badgeService = mock(BadgeService.class);
        flairRepository = mock(FlairRepository.class);
        userFlairRepository = mock(UserFlairRepository.class);
        currentUser = mock(CurrentUser.class);
        random = mock(RandomGenerator.class);
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        flairService = new FlairService(flairRepository, userFlairRepository, userRepository, userProgressRepository,
                mock(ProgressService.class), currentUser,
                new Flairs(flairRepository, clock, "https://badges.studily.ca/flairs/v1"), clock);
        progressService = new ProgressService(userProgressRepository, xpEventRepository, coinTransactionRepository,
                chestRepository, userRepository, badgeService, flairService, new UserTimeZones(userRepository, "UTC"),
                currentUser, clock);
        service = new ChestService(chestRepository, progressService, badgeService, flairService, currentUser, clock,
                random);
        seedFlairCatalog();

        progress = new UserProgress();
        progress.setUserId(1L);
        chest = new Chest();
        chest.setId(7L);
        chest.setUser(user(1L));
        chest.setSource(ChestSource.LEVEL);
        chest.setSourceRef("level:5");
        chest.setCreatedAt(NOW.minusSeconds(600));

        when(currentUser.id()).thenReturn(1L);
        when(userProgressRepository.findForUpdate(1L)).thenReturn(Optional.of(progress));
        when(userRepository.getReferenceById(anyLong())).thenAnswer(inv -> user(inv.getArgument(0)));
        when(chestRepository.findByIdAndUserId(7L, 1L)).thenReturn(Optional.of(chest));
        when(chestRepository.markOpened(7L, 1L, NOW)).thenReturn(1);
        when(xpEventRepository.save(any(XpEvent.class))).thenAnswer(inv -> {
            xpEvents.add(inv.getArgument(0));
            return inv.getArgument(0);
        });
        when(coinTransactionRepository.save(any(CoinTransaction.class))).thenAnswer(inv -> {
            coinTransactions.add(inv.getArgument(0));
            return inv.getArgument(0);
        });
        when(badgeService.evaluate(anyLong())).thenReturn(List.of());
        when(badgeService.grant(anyLong(), any(Badge.class), any(BadgeSource.class))).thenAnswer(inv -> {
            UserBadge ub = new UserBadge();
            ub.setBadge(inv.getArgument(1));
            ub.setSource(inv.getArgument(2));
            ub.setAcquiredAt(NOW);
            return ub;
        });
        when(badgeService.toDto(any(Badge.class), any())).thenAnswer(inv -> {
            Badge b = inv.getArgument(0);
            return new BadgeDto(b.getCode(), b.getCategory(), b.getTitle(), b.getDescription(),
                    "u/" + b.getImageKey(), b.getPriceCoins(), inv.getArgument(1) != null, NOW, null);
        });
        when(flairRepository.findByActiveTrueOrderBySortOrderAsc()).thenAnswer(inv -> List.copyOf(flairCatalog));
        when(userFlairRepository.findByUserId(1L)).thenAnswer(inv -> List.copyOf(ownedFlairs));
        when(userFlairRepository.save(any(UserFlair.class))).thenAnswer(inv -> {
            ownedFlairs.add(inv.getArgument(0));
            return inv.getArgument(0);
        });
    }

    private void seedFlairCatalog() {
        flairCatalog.add(flair("ring_mint", FlairRarity.COMMON, FlairUnlock.SHOP, 250, null, 10));
        flairCatalog.add(flair("ring_ocean", FlairRarity.COMMON, FlairUnlock.SHOP, 250, null, 20));
        flairCatalog.add(flair("ring_sunset", FlairRarity.RARE, FlairUnlock.SHOP, 500, null, 30));
        flairCatalog.add(flair("ring_gold", FlairRarity.RARE, FlairUnlock.SHOP, 750, null, 40));
        flairCatalog.add(flair("ring_neon", FlairRarity.EPIC, FlairUnlock.SHOP, 1200, null, 50));
        flairCatalog.add(flair("ring_aurora", FlairRarity.EPIC, FlairUnlock.SHOP, 1500, null, 60));
        flairCatalog.add(flair("ring_prism", FlairRarity.EPIC, FlairUnlock.CHEST, null, null, 70));
        flairCatalog.add(flair("ring_galaxy", FlairRarity.LEGENDARY, FlairUnlock.CHEST, null, null, 80));
        flairCatalog.add(flair("ring_ember", FlairRarity.RARE, FlairUnlock.STREAK, null, 7, 90));
        flairCatalog.add(flair("ring_blaze", FlairRarity.EPIC, FlairUnlock.STREAK, null, 30, 100));
        flairCatalog.add(flair("ring_inferno", FlairRarity.LEGENDARY, FlairUnlock.STREAK, null, 100, 110));
    }

    private static Flair flair(String code, FlairRarity rarity, FlairUnlock unlock, Integer price,
                               Integer streakDays, int sortOrder) {
        Flair f = new Flair();
        f.setCode(code);
        f.setTitle(code);
        f.setDescription(code);
        f.setRarity(rarity);
        f.setUnlock(unlock);
        f.setPriceCoins(price);
        f.setStreakDays(streakDays);
        f.setSortOrder(sortOrder);
        return f;
    }

    private Flair catalogFlair(String code) {
        return flairCatalog.stream().filter(f -> f.getCode().equals(code)).findFirst().orElseThrow();
    }

    private void own(String... codes) {
        for (String code : codes) {
            UserFlair uf = new UserFlair();
            uf.setUser(user(1L));
            uf.setFlair(catalogFlair(code));
            uf.setSource(FlairSource.PURCHASED);
            uf.setAcquiredAt(NOW.minusSeconds(3_600));
            ownedFlairs.add(uf);
        }
    }

    private static User user(Long id) {
        User u = new User();
        u.setId(id);
        return u;
    }

    private static Badge cosmetic(String code, int price) {
        Badge b = new Badge();
        b.setCode(code);
        b.setCategory(BadgeCategory.COSMETIC);
        b.setTitle(code);
        b.setDescription(code);
        b.setImageKey(code + ".webp");
        b.setPriceCoins(price);
        return b;
    }

    @Test
    void open_typicalRoll_appliesLootAndStoresItOnChest() {
        when(random.nextInt(91)).thenReturn(45);
        when(random.nextDouble()).thenReturn(0.1, 0.5, 0.5);
        when(random.nextInt(101)).thenReturn(50);

        ChestOpenResult result = service.open(7L);

        assertThat(chest.getOpenedAt()).isEqualTo(NOW);
        assertThat(chest.getLootCoins()).isEqualTo(75);
        assertThat(chest.getLootXp()).isEqualTo(100);
        assertThat(chest.getLootBadge()).isNull();
        assertThat(chest.getLootFlairCode()).isNull();
        verify(chestRepository).save(chest);
        assertThat(progress.getCoins()).isEqualTo(75);
        assertThat(progress.getXp()).isEqualTo(100);
        assertThat(coinTransactions).singleElement().satisfies(tx -> {
            assertThat(tx.getAmount()).isEqualTo(75);
            assertThat(tx.getReason()).isEqualTo(CoinReason.CHEST);
            assertThat(tx.getRef()).isEqualTo("chest:7");
        });
        assertThat(xpEvents).singleElement().satisfies(e -> {
            assertThat(e.getSource()).isEqualTo(XpSource.CHEST);
            assertThat(e.getAmount()).isEqualTo(100);
            assertThat(e.getDedupeKey()).isEqualTo("chest:7");
            assertThat(e.getRefId()).isEqualTo(7L);
        });
        assertThat(result.chest().loot().coins()).isEqualTo(75);
        assertThat(result.chest().loot().xp()).isEqualTo(100);
        assertThat(result.chest().loot().badge()).isNull();
        assertThat(result.chest().loot().flair()).isNull();
        assertThat(result.delta().newFlairs()).isEmpty();
        assertThat(result.delta().coinsGained()).isEqualTo(75);
        assertThat(result.delta().xpGained()).isEqualTo(100);
        verify(badgeService).evaluate(1L);
    }

    @Test
    void open_lowestRoll_givesThirtyCoinsOnly() {
        when(random.nextInt(91)).thenReturn(0);
        when(random.nextDouble()).thenReturn(0.4, 0.05, 0.05);

        ChestOpenResult result = service.open(7L);

        assertThat(chest.getLootCoins()).isEqualTo(30);
        assertThat(chest.getLootXp()).isZero();
        assertThat(result.delta().xpGained()).isZero();
        assertThat(xpEvents).isEmpty();
        verify(random, never()).nextInt(101);
        verify(badgeService, never()).unownedCosmetics(anyLong());
        verify(userFlairRepository, never()).save(any(UserFlair.class));
        assertThat(chest.getLootFlairCode()).isNull();
    }

    @Test
    void open_highestRoll_givesMaxCoinsMaxXpAndCosmetic() {
        Badge spark = cosmetic("cosmetic_spark", 300);
        Badge comet = cosmetic("cosmetic_comet", 600);
        Badge crown = cosmetic("cosmetic_crown", 1200);
        when(random.nextInt(91)).thenReturn(90);
        when(random.nextDouble()).thenReturn(0.3999, 0.0499, 0.05);
        when(random.nextInt(101)).thenReturn(100);
        when(badgeService.unownedCosmetics(1L)).thenReturn(List.of(spark, comet, crown));
        when(random.nextInt(3)).thenReturn(2);

        ChestOpenResult result = service.open(7L);

        assertThat(chest.getLootCoins()).isEqualTo(120);
        assertThat(chest.getLootXp()).isEqualTo(150);
        assertThat(chest.getLootBadge()).isSameAs(crown);
        verify(badgeService).grant(1L, crown, BadgeSource.CHEST);
        assertThat(result.chest().loot().badge().code()).isEqualTo("cosmetic_crown");
        assertThat(result.delta().newBadges()).extracting(BadgeDto::code).contains("cosmetic_crown");
        assertThat(progress.getCoins()).isEqualTo(120);
        assertThat(progress.getXp()).isEqualTo(150);
        assertThat(chest.getLootFlairCode()).isNull();
        assertThat(result.chest().loot().flair()).isNull();
        verify(random, times(3)).nextDouble();
    }

    @Test
    void open_badgeRollWhenAllCosmeticsOwned_givesHundredExtraCoins() {
        when(random.nextInt(91)).thenReturn(20);
        when(random.nextDouble()).thenReturn(0.9, 0.01, 0.9);
        when(badgeService.unownedCosmetics(1L)).thenReturn(List.of());

        ChestOpenResult result = service.open(7L);

        assertThat(chest.getLootCoins()).isEqualTo(150);
        assertThat(chest.getLootBadge()).isNull();
        assertThat(result.chest().loot().badge()).isNull();
        assertThat(progress.getCoins()).isEqualTo(150);
        assertThat(coinTransactions).singleElement().satisfies(tx -> assertThat(tx.getAmount()).isEqualTo(150));
        verify(badgeService, never()).grant(anyLong(), any(), any());
        verify(random, never()).nextInt(0);
        assertThat(chest.getLootFlairCode()).isNull();
    }

    @Test
    void open_flairRollHit_grantsUnownedLootableFlairFromChest() {
        when(random.nextInt(91)).thenReturn(20);
        when(random.nextDouble()).thenReturn(0.9, 0.9, 0.0499);
        when(random.nextInt(8)).thenReturn(7);

        ChestOpenResult result = service.open(7L);

        assertThat(chest.getLootFlairCode()).isEqualTo("ring_galaxy");
        assertThat(chest.getLootBadge()).isNull();
        assertThat(chest.getLootCoins()).isEqualTo(50);
        assertThat(ownedFlairs).singleElement().satisfies(uf -> {
            assertThat(uf.getFlair().getCode()).isEqualTo("ring_galaxy");
            assertThat(uf.getSource()).isEqualTo(FlairSource.CHEST);
            assertThat(uf.getUser().getId()).isEqualTo(1L);
            assertThat(uf.getAcquiredAt()).isEqualTo(NOW);
        });
        FlairDto loot = result.chest().loot().flair();
        assertThat(loot.code()).isEqualTo("ring_galaxy");
        assertThat(loot.rarity()).isEqualTo(FlairRarity.LEGENDARY);
        assertThat(loot.unlock()).isEqualTo(FlairUnlock.CHEST);
        assertThat(loot.owned()).isTrue();
        assertThat(loot.acquiredAt()).isEqualTo(NOW);
        assertThat(loot.equipped()).isFalse();
        assertThat(result.delta().newFlairs()).containsExactly(loot);
        assertThat(result.chest().loot().badge()).isNull();
        assertThat(progress.getCoins()).isEqualTo(50);
        verify(chestRepository).save(chest);
    }

    @Test
    void open_flairRollHit_picksAmongUnownedCandidatesInSortOrder() {
        own("ring_mint", "ring_ocean", "ring_sunset", "ring_gold", "ring_neon", "ring_aurora");
        when(random.nextDouble()).thenReturn(0.9, 0.9, 0.0);
        when(random.nextInt(2)).thenReturn(1);

        ChestOpenResult result = service.open(7L);

        assertThat(chest.getLootFlairCode()).isEqualTo("ring_galaxy");
        assertThat(result.chest().loot().flair().code()).isEqualTo("ring_galaxy");
        verify(random).nextInt(2);
    }

    @Test
    void open_flairRollAtChance_grantsNoFlair() {
        when(random.nextInt(91)).thenReturn(20);
        when(random.nextDouble()).thenReturn(0.9, 0.9, 0.05);

        ChestOpenResult result = service.open(7L);

        assertThat(chest.getLootFlairCode()).isNull();
        assertThat(result.chest().loot().flair()).isNull();
        assertThat(result.delta().newFlairs()).isEmpty();
        assertThat(ownedFlairs).isEmpty();
        assertThat(progress.getCoins()).isEqualTo(50);
    }

    @Test
    void open_flairRollWhenAllShopAndChestFlairsOwned_givesHundredExtraCoins() {
        own("ring_mint", "ring_ocean", "ring_sunset", "ring_gold", "ring_neon", "ring_aurora", "ring_prism",
                "ring_galaxy");
        when(random.nextInt(91)).thenReturn(20);
        when(random.nextDouble()).thenReturn(0.9, 0.9, 0.01);

        ChestOpenResult result = service.open(7L);

        assertThat(chest.getLootCoins()).isEqualTo(150);
        assertThat(chest.getLootFlairCode()).isNull();
        assertThat(result.chest().loot().flair()).isNull();
        assertThat(result.chest().loot().coins()).isEqualTo(150);
        assertThat(result.delta().newFlairs()).isEmpty();
        assertThat(progress.getCoins()).isEqualTo(150);
        assertThat(coinTransactions).singleElement().satisfies(tx -> assertThat(tx.getAmount()).isEqualTo(150));
        assertThat(ownedFlairs).hasSize(8);
        verify(userFlairRepository, never()).save(any(UserFlair.class));
        verify(random, never()).nextInt(0);
    }

    @Test
    void open_flairRollWhenOnlyStreakFlairsUnowned_neverDropsStreakFlair() {
        own("ring_mint", "ring_ocean", "ring_sunset", "ring_gold", "ring_neon", "ring_aurora", "ring_prism",
                "ring_galaxy");
        when(random.nextInt(91)).thenReturn(0);
        when(random.nextDouble()).thenReturn(0.9, 0.9, 0.0);
        when(random.nextInt(3)).thenReturn(0);

        ChestOpenResult result = service.open(7L);

        assertThat(chest.getLootFlairCode()).isNull();
        assertThat(chest.getLootCoins()).isEqualTo(130);
        assertThat(ownedFlairs).extracting(uf -> uf.getFlair().getUnlock()).doesNotContain(FlairUnlock.STREAK);
        assertThat(result.delta().newFlairs()).isEmpty();
        verify(random, never()).nextInt(3);
    }

    @Test
    void open_badgeAndFlairBothHit_grantsBoth() {
        Badge spark = cosmetic("cosmetic_spark", 300);
        when(random.nextInt(91)).thenReturn(10);
        when(random.nextDouble()).thenReturn(0.9, 0.0, 0.0);
        when(badgeService.unownedCosmetics(1L)).thenReturn(List.of(spark));
        when(random.nextInt(1)).thenReturn(0);
        when(random.nextInt(8)).thenReturn(0);

        ChestOpenResult result = service.open(7L);

        assertThat(chest.getLootBadge()).isSameAs(spark);
        assertThat(chest.getLootFlairCode()).isEqualTo("ring_mint");
        assertThat(result.chest().loot().badge().code()).isEqualTo("cosmetic_spark");
        assertThat(result.chest().loot().flair().code()).isEqualTo("ring_mint");
        assertThat(result.delta().newBadges()).extracting(BadgeDto::code).containsExactly("cosmetic_spark");
        assertThat(result.delta().newFlairs()).extracting(FlairDto::code).containsExactly("ring_mint");
        assertThat(chest.getLootCoins()).isEqualTo(40);
    }

    @Test
    void open_twice_throwsConflict() {
        when(random.nextInt(91)).thenReturn(10);
        when(random.nextDouble()).thenReturn(0.9);
        when(chestRepository.markOpened(7L, 1L, NOW)).thenReturn(1, 0);

        service.open(7L);

        assertThatThrownBy(() -> service.open(7L))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Chest already opened");
        assertThat(coinTransactions).hasSize(1);
        assertThat(progress.getCoins()).isEqualTo(40);
    }

    @Test
    void open_anotherUsersChest_throwsNotFound() {
        when(chestRepository.markOpened(8L, 1L, NOW)).thenReturn(0);
        when(chestRepository.findByIdAndUserId(8L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.open(8L)).isInstanceOf(NotFoundException.class);
        assertThat(coinTransactions).isEmpty();
        verify(random, never()).nextInt(anyInt());
    }

    @Test
    void open_locksProgressBeforeMarkingOpened() {
        when(random.nextDouble()).thenReturn(0.9);

        service.open(7L);

        InOrder order = inOrder(userProgressRepository, chestRepository);
        order.verify(userProgressRepository).findForUpdate(1L);
        order.verify(chestRepository).markOpened(7L, 1L, NOW);
    }

    @Test
    void rollLoot_seededRandom_staysWithinSpecRanges() {
        ChestService seeded = new ChestService(chestRepository, progressService, badgeService, flairService,
                currentUser, Clock.fixed(NOW, ZoneOffset.UTC), new Random(20261007L));
        Badge spark = cosmetic("cosmetic_spark", 300);
        when(badgeService.unownedCosmetics(1L)).thenReturn(List.of(spark));
        int draws = 20_000;
        int minCoins = Integer.MAX_VALUE;
        int maxCoins = Integer.MIN_VALUE;
        int minXp = Integer.MAX_VALUE;
        int maxXp = Integer.MIN_VALUE;
        int xpHits = 0;
        int badgeHits = 0;
        int flairHits = 0;
        Set<String> droppedFlairs = new HashSet<>();

        for (int i = 0; i < draws; i++) {
            ChestService.Loot loot = seeded.rollLoot(1L);
            assertThat(loot.coins()).isBetween(30, 120);
            minCoins = Math.min(minCoins, loot.coins());
            maxCoins = Math.max(maxCoins, loot.coins());
            if (loot.xp() > 0) {
                assertThat(loot.xp()).isBetween(50, 150);
                xpHits++;
                minXp = Math.min(minXp, loot.xp());
                maxXp = Math.max(maxXp, loot.xp());
            }
            if (loot.badge() != null) {
                assertThat(loot.badge()).isSameAs(spark);
                badgeHits++;
            }
            if (loot.flair() != null) {
                assertThat(loot.flair().getUnlock()).isIn(FlairUnlock.SHOP, FlairUnlock.CHEST);
                flairHits++;
                droppedFlairs.add(loot.flair().getCode());
            }
        }

        assertThat(minCoins).isEqualTo(30);
        assertThat(maxCoins).isEqualTo(120);
        assertThat(minXp).isEqualTo(50);
        assertThat(maxXp).isEqualTo(150);
        assertThat(xpHits / (double) draws).isBetween(0.38, 0.42);
        assertThat(badgeHits / (double) draws).isBetween(0.04, 0.06);
        assertThat(flairHits / (double) draws).isBetween(0.04, 0.06);
        assertThat(droppedFlairs).containsExactlyInAnyOrder("ring_mint", "ring_ocean", "ring_sunset", "ring_gold",
                "ring_neon", "ring_aurora", "ring_prism", "ring_galaxy");
    }

    @Test
    void maybeDrop_chestAlreadyOnThatLocalDate_skipsRoll() {
        ProgressDeltaBuilder delta = progressService.begin(1L);
        LocalDate day = LocalDate.of(2026, 10, 7);
        when(chestRepository.countByUserIdAndSourceAndLocalDate(1L, ChestSource.SESSION, day)).thenReturn(1L);

        Optional<Chest> dropped = service.maybeDrop(delta, ChestSource.SESSION, "session:5", 0.2, day);

        assertThat(dropped).isEmpty();
        verify(random, never()).nextDouble();
        verify(chestRepository, never()).save(any(Chest.class));
    }

    @Test
    void maybeDrop_rollUnderChance_grantsChestStampedWithLocalDate() {
        ProgressDeltaBuilder delta = progressService.begin(1L);
        LocalDate day = LocalDate.of(2026, 10, 7);
        when(random.nextDouble()).thenReturn(0.1999);

        Optional<Chest> dropped = service.maybeDrop(delta, ChestSource.SESSION, "session:5", 0.2, day);

        assertThat(dropped).isPresent();
        assertThat(dropped.get().getSource()).isEqualTo(ChestSource.SESSION);
        assertThat(dropped.get().getSourceRef()).isEqualTo("session:5");
        assertThat(dropped.get().getLocalDate()).isEqualTo(day);
        verify(chestRepository).save(dropped.get());
        verify(chestRepository, never()).countByUserIdAndSourceAndCreatedAtBetween(any(), any(), any(), any());
        assertThat(delta.build().chests()).hasSize(1);
    }

    @Test
    void maybeDrop_rollAtChance_grantsNothing() {
        ProgressDeltaBuilder delta = progressService.begin(1L);
        when(random.nextDouble()).thenReturn(0.2);

        assertThat(service.maybeDrop(delta, ChestSource.SESSION, "session:5", 0.2, LocalDate.of(2026, 10, 7)))
                .isEmpty();
        verify(chestRepository, never()).save(any(Chest.class));
    }

    @Test
    void unopened_listsCallersUnopenedChestsWithoutLoot() {
        when(chestRepository.findByUserIdAndOpenedAtIsNullOrderByCreatedAt(1L)).thenReturn(List.of(chest));

        assertThat(service.unopened()).singleElement().satisfies(dto -> {
            assertThat(dto.id()).isEqualTo(7L);
            assertThat(dto.source()).isEqualTo(ChestSource.LEVEL);
            assertThat(dto.loot()).isNull();
        });
    }
}
