package com.rnave.studily.progress;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.progress.ProgressDtos.BadgeDto;
import com.rnave.studily.progress.ProgressDtos.BadgeSummary;
import com.rnave.studily.progress.ProgressDtos.ProgressDelta;
import com.rnave.studily.progress.ProgressDtos.ProgressDto;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import com.rnave.studily.user.UserTimeZones;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProgressServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-07T18:00:00Z");
    private static final ZoneId VANCOUVER = ZoneId.of("America/Vancouver");

    private UserProgressRepository userProgressRepository;
    private XpEventRepository xpEventRepository;
    private CoinTransactionRepository coinTransactionRepository;
    private ChestRepository chestRepository;
    private UserRepository userRepository;
    private BadgeService badgeService;
    private CurrentUser currentUser;
    private UserTimeZones timeZones;
    private ProgressService service;

    private final Map<Long, UserProgress> rows = new HashMap<>();
    private final Map<Long, User> users = new HashMap<>();
    private final List<XpEvent> xpEvents = new ArrayList<>();
    private final List<CoinTransaction> coinTransactions = new ArrayList<>();
    private final List<Chest> chests = new ArrayList<>();

    @BeforeEach
    void setUp() {
        userProgressRepository = mock(UserProgressRepository.class);
        xpEventRepository = mock(XpEventRepository.class);
        coinTransactionRepository = mock(CoinTransactionRepository.class);
        chestRepository = mock(ChestRepository.class);
        userRepository = mock(UserRepository.class);
        badgeService = mock(BadgeService.class);
        currentUser = mock(CurrentUser.class);
        timeZones = new UserTimeZones(userRepository, "UTC");
        service = serviceAt(NOW);

        when(userProgressRepository.findForUpdate(anyLong()))
                .thenAnswer(inv -> Optional.ofNullable(rows.get(inv.<Long>getArgument(0))));
        when(userProgressRepository.findById(anyLong()))
                .thenAnswer(inv -> Optional.ofNullable(rows.get(inv.<Long>getArgument(0))));
        when(userRepository.getReferenceById(anyLong())).thenAnswer(inv -> user(inv.getArgument(0)));
        when(userRepository.findById(anyLong()))
                .thenAnswer(inv -> Optional.ofNullable(users.get(inv.<Long>getArgument(0))));
        when(xpEventRepository.existsByUserIdAndSourceNot(anyLong(), eq(XpSource.FRIEND))).thenReturn(true);
        when(xpEventRepository.existsByDedupeKey(anyString())).thenAnswer(inv -> xpEvents.stream()
                .anyMatch(e -> e.getDedupeKey().equals(inv.getArgument(0))));
        when(xpEventRepository.save(any(XpEvent.class))).thenAnswer(inv -> {
            xpEvents.add(inv.getArgument(0));
            return inv.getArgument(0);
        });
        when(coinTransactionRepository.save(any(CoinTransaction.class))).thenAnswer(inv -> {
            coinTransactions.add(inv.getArgument(0));
            return inv.getArgument(0);
        });
        when(chestRepository.save(any(Chest.class))).thenAnswer(inv -> {
            chests.add(inv.getArgument(0));
            return inv.getArgument(0);
        });
        when(badgeService.evaluate(anyLong())).thenReturn(List.of());
    }

    private ProgressService serviceAt(Instant instant) {
        return new ProgressService(userProgressRepository, xpEventRepository, coinTransactionRepository,
                chestRepository, userRepository, badgeService, timeZones, currentUser,
                Clock.fixed(instant, ZoneOffset.UTC));
    }

    private ProgressService serviceAt(Instant instant, String fallbackZone) {
        return new ProgressService(userProgressRepository, xpEventRepository, coinTransactionRepository,
                chestRepository, userRepository, badgeService, new UserTimeZones(userRepository, fallbackZone),
                currentUser, Clock.fixed(instant, ZoneOffset.UTC));
    }

    private User user(Long id) {
        return users.computeIfAbsent(id, key -> {
            User u = new User();
            u.setId(key);
            u.setUsername("user" + key);
            u.setName("User " + key);
            u.setCreatedAt(NOW.minus(Duration.ofDays(30)));
            return u;
        });
    }

    private UserProgress progress(Long userId, long xp) {
        user(userId);
        UserProgress p = new UserProgress();
        p.setUserId(userId);
        p.setXp(xp);
        p.setLevel(LevelMath.levelFor(xp));
        rows.put(userId, p);
        return p;
    }

    @Test
    void grantXp_withinLevel_recordsEventWithoutLevelUp() {
        UserProgress p = progress(1L, 100);

        ProgressDelta delta = service.grantXp(1L, XpSource.STUDY_BLOCK, 60, "study-block:9", 9L).build();

        assertThat(p.getXp()).isEqualTo(160);
        assertThat(p.getLevel()).isEqualTo(1);
        assertThat(p.getCoins()).isZero();
        assertThat(coinTransactions).isEmpty();
        assertThat(xpEvents).singleElement().satisfies(e -> {
            assertThat(e.getSource()).isEqualTo(XpSource.STUDY_BLOCK);
            assertThat(e.getAmount()).isEqualTo(60);
            assertThat(e.getDedupeKey()).isEqualTo("study-block:9");
            assertThat(e.getRefId()).isEqualTo(9L);
            assertThat(e.getCreatedAt()).isEqualTo(NOW);
            assertThat(e.getUser().getId()).isEqualTo(1L);
        });
        assertThat(delta.xpGained()).isEqualTo(60);
        assertThat(delta.levelBefore()).isEqualTo(1);
        assertThat(delta.levelAfter()).isEqualTo(1);
    }

    @Test
    void grantXp_crossingOneLevel_awardsLevelUpCoins() {
        UserProgress p = progress(1L, 400);

        ProgressDelta delta = service.grantXp(1L, XpSource.STUDY_BLOCK, 150, "study-block:9", 9L).build();

        assertThat(p.getXp()).isEqualTo(550);
        assertThat(p.getLevel()).isEqualTo(2);
        assertThat(p.getCoins()).isEqualTo(30);
        assertThat(coinTransactions).singleElement().satisfies(tx -> {
            assertThat(tx.getAmount()).isEqualTo(30);
            assertThat(tx.getReason()).isEqualTo(CoinReason.LEVEL_UP);
            assertThat(tx.getRef()).isEqualTo("level:2");
        });
        assertThat(chests).isEmpty();
        assertThat(delta.xpGained()).isEqualTo(150);
        assertThat(delta.levelBefore()).isEqualTo(1);
        assertThat(delta.levelAfter()).isEqualTo(2);
        assertThat(delta.xp()).isEqualTo(550);
        assertThat(delta.xpIntoLevel()).isEqualTo(50);
        assertThat(delta.xpForNext()).isEqualTo(550);
        assertThat(delta.coinsGained()).isEqualTo(30);
        assertThat(delta.coins()).isEqualTo(30);
    }

    @Test
    void grantXp_crossingSeveralLevels_awardsCoinsPerLevelAndChestOnMultiplesOfFive() {
        UserProgress p = progress(1L, 0);

        ProgressDelta delta = service.grantXp(1L, XpSource.CHEST, 6300, "chest:1", 1L).build();

        assertThat(p.getLevel()).isEqualTo(10);
        assertThat(coinTransactions).extracting(CoinTransaction::getRef)
                .containsExactly("level:2", "level:3", "level:4", "level:5", "level:6",
                        "level:7", "level:8", "level:9", "level:10");
        assertThat(coinTransactions).extracting(CoinTransaction::getAmount)
                .containsExactly(30, 35, 40, 45, 50, 55, 60, 65, 70);
        assertThat(coinTransactions).allSatisfy(tx -> assertThat(tx.getReason()).isEqualTo(CoinReason.LEVEL_UP));
        assertThat(p.getCoins()).isEqualTo(450);
        assertThat(chests).extracting(Chest::getSource).containsOnly(ChestSource.LEVEL);
        assertThat(chests).extracting(Chest::getSourceRef).containsExactly("level:5", "level:10");
        assertThat(chests).extracting(Chest::getLocalDate).containsOnlyNulls();
        assertThat(delta.chests()).hasSize(2);
        assertThat(delta.levelBefore()).isEqualTo(1);
        assertThat(delta.levelAfter()).isEqualTo(10);
        assertThat(delta.coinsGained()).isEqualTo(450);
    }

    @Test
    void grantXp_levelAlwaysMatchesLevelMath() {
        UserProgress p = progress(1L, 0);
        int[] grants = {499, 1, 1799, 1, 4000, 12000, 7};

        for (int i = 0; i < grants.length; i++) {
            service.grantXp(1L, XpSource.CHEST, grants[i], "chest:" + i, (long) i);
            assertThat(p.getLevel()).isEqualTo(LevelMath.levelFor(p.getXp()));
        }
        assertThat(p.getXp()).isEqualTo(18307);
        assertThat(p.getLevel()).isEqualTo(20);
    }

    @Test
    void grantXp_existingDedupeKey_changesNothing() {
        UserProgress p = progress(1L, 400);
        when(xpEventRepository.existsByDedupeKey("study-block:9")).thenReturn(true);

        ProgressDeltaBuilder builder = service.grantXp(1L, XpSource.STUDY_BLOCK, 150, "study-block:9", 9L);
        int granted = service.grantXp(builder, XpSource.STUDY_BLOCK, 150, "study-block:9", 9L);

        assertThat(granted).isZero();
        assertThat(p.getXp()).isEqualTo(400);
        assertThat(p.getLevel()).isEqualTo(1);
        assertThat(p.getCoins()).isZero();
        assertThat(xpEvents).isEmpty();
        assertThat(coinTransactions).isEmpty();
        assertThat(builder.build().xpGained()).isZero();
    }

    @Test
    void grantXp_zeroAmount_changesNothing() {
        UserProgress p = progress(1L, 400);

        ProgressDeltaBuilder builder = service.begin(1L);
        int granted = service.grantXp(builder, XpSource.STUDY_TASK, 0, "study-task:1", 1L);

        assertThat(granted).isZero();
        assertThat(p.getXp()).isEqualTo(400);
        assertThat(xpEvents).isEmpty();
        verify(xpEventRepository, never()).existsByDedupeKey(anyString());
    }

    @Test
    void grantXp_locksRowBeforeCheckingDedupeKey() {
        progress(1L, 0);

        service.grantXp(1L, XpSource.STUDY_BLOCK, 60, "study-block:9", 9L);

        InOrder order = inOrder(userProgressRepository, xpEventRepository);
        order.verify(userProgressRepository).insertIfMissing(1L);
        order.verify(userProgressRepository).findForUpdate(1L);
        order.verify(xpEventRepository).existsByDedupeKey("study-block:9");
        order.verify(xpEventRepository).save(any(XpEvent.class));
    }

    @Test
    void ensure_missingRowAfterInsert_throwsNotFound() {
        assertThatThrownBy(() -> service.ensure(42L)).isInstanceOf(NotFoundException.class);
        verify(userProgressRepository).insertIfMissing(42L);
    }

    @Test
    void addCoins_overdraft_throwsBadRequestAndWritesNothing() {
        UserProgress p = progress(1L, 0);
        p.setCoins(100);
        ProgressDeltaBuilder builder = service.begin(1L);

        assertThatThrownBy(() -> service.addCoins(builder, -101, CoinReason.PURCHASE, "badge:x"))
                .isInstanceOf(BadRequestException.class);
        assertThat(p.getCoins()).isEqualTo(100);
        assertThat(coinTransactions).isEmpty();
    }

    @Test
    void grantChest_sameSourceRefTwice_grantsOnce() {
        progress(1L, 0);
        ProgressDeltaBuilder builder = service.begin(1L);
        when(chestRepository.existsByUserIdAndSourceAndSourceRef(1L, ChestSource.LEVEL, "level:5"))
                .thenReturn(false, true);

        Optional<Chest> first = service.grantChest(builder, ChestSource.LEVEL, "level:5");
        Optional<Chest> second = service.grantChest(builder, ChestSource.LEVEL, "level:5");

        assertThat(first).isPresent();
        assertThat(second).isEmpty();
        assertThat(chests).hasSize(1);
        assertThat(builder.build().chests()).hasSize(1);
    }

    @Test
    void finish_addsNewlyEarnedBadgesToDelta() {
        progress(1L, 0);
        BadgeDto badge = new BadgeDto("level_1", BadgeCategory.LEVEL, "Level 1", "Start.", "u/level_1.webp",
                null, true, NOW, null);
        when(badgeService.evaluate(1L)).thenReturn(List.of(badge));

        ProgressDelta delta = service.finish(service.begin(1L));

        assertThat(delta.newBadges()).containsExactly(badge);
    }

    @Test
    void multiplierFor_streaks_matchesSpec() {
        assertThat(service.multiplierFor(0)).isEqualByComparingTo("1.00");
        assertThat(service.multiplierFor(1)).isEqualByComparingTo("1.00");
        assertThat(service.multiplierFor(2)).isEqualByComparingTo("1.10");
        assertThat(service.multiplierFor(3)).isEqualByComparingTo("1.20");
        assertThat(service.multiplierFor(6)).isEqualByComparingTo("1.50");
        assertThat(service.multiplierFor(20)).isEqualByComparingTo("1.50");
    }

    @Test
    void multiplierFor_hasTwoDecimalScale() {
        assertThat(service.multiplierFor(3).scale()).isEqualTo(2);
        assertThat(service.multiplierFor(20)).isEqualTo(new BigDecimal("1.50"));
    }

    @Test
    void effectiveStreak_lastDayTodayOrYesterdayInUserZone_keepsStreak() {
        ProgressService late = serviceAt(Instant.parse("2026-10-08T05:00:00Z"));
        UserProgress p = progress(1L, 0);
        p.setStreakCurrent(5);

        p.setStreakLastDate(LocalDate.of(2026, 10, 7));
        assertThat(late.effectiveStreak(p, VANCOUVER)).isEqualTo(5);

        p.setStreakLastDate(LocalDate.of(2026, 10, 6));
        assertThat(late.effectiveStreak(p, VANCOUVER)).isEqualTo(5);
    }

    @Test
    void effectiveStreak_lastDayOlderThanYesterdayInUserZone_isZero() {
        ProgressService late = serviceAt(Instant.parse("2026-10-08T05:00:00Z"));
        UserProgress p = progress(1L, 0);
        p.setStreakCurrent(5);
        p.setStreakLastDate(LocalDate.of(2026, 10, 5));

        assertThat(late.effectiveStreak(p, VANCOUVER)).isZero();
    }

    @Test
    void effectiveStreak_usesUserZoneNotUtc() {
        ProgressService late = serviceAt(Instant.parse("2026-10-08T05:00:00Z"));
        UserProgress p = progress(1L, 0);
        p.setStreakCurrent(5);
        p.setStreakLastDate(LocalDate.of(2026, 10, 6));

        assertThat(late.effectiveStreak(p, VANCOUVER)).isEqualTo(5);
        assertThat(late.effectiveStreak(p, ZoneOffset.UTC)).isZero();
    }

    @Test
    void effectiveStreak_noStreakDate_isZero() {
        UserProgress p = progress(1L, 0);
        p.setStreakCurrent(3);

        assertThat(service.effectiveStreak(p, VANCOUVER)).isZero();
    }

    @Test
    void recordQualifiedDay_sameDay_changesNothing() {
        UserProgress p = progress(1L, 0);
        p.setStreakCurrent(3);
        p.setStreakBest(3);
        p.setStreakLastDate(LocalDate.of(2026, 10, 7));

        service.recordQualifiedDay(service.begin(1L), LocalDate.of(2026, 10, 7));

        assertThat(p.getStreakCurrent()).isEqualTo(3);
        assertThat(p.getStreakBest()).isEqualTo(3);
        assertThat(chests).isEmpty();
    }

    @Test
    void recordQualifiedDay_consecutiveDay_extendsStreakAndBest() {
        UserProgress p = progress(1L, 0);
        p.setStreakCurrent(3);
        p.setStreakBest(3);
        p.setStreakLastDate(LocalDate.of(2026, 10, 6));

        service.recordQualifiedDay(service.begin(1L), LocalDate.of(2026, 10, 7));

        assertThat(p.getStreakCurrent()).isEqualTo(4);
        assertThat(p.getStreakBest()).isEqualTo(4);
        assertThat(p.getStreakLastDate()).isEqualTo(LocalDate.of(2026, 10, 7));
    }

    @Test
    void recordQualifiedDay_afterGap_restartsAtOneAndKeepsBest() {
        UserProgress p = progress(1L, 0);
        p.setStreakCurrent(5);
        p.setStreakBest(9);
        p.setStreakLastDate(LocalDate.of(2026, 10, 5));

        service.recordQualifiedDay(service.begin(1L), LocalDate.of(2026, 10, 7));

        assertThat(p.getStreakCurrent()).isEqualTo(1);
        assertThat(p.getStreakBest()).isEqualTo(9);
        assertThat(p.getStreakLastDate()).isEqualTo(LocalDate.of(2026, 10, 7));
    }

    @Test
    void recordQualifiedDay_firstEver_startsAtOne() {
        UserProgress p = progress(1L, 0);

        service.recordQualifiedDay(service.begin(1L), LocalDate.of(2026, 10, 7));

        assertThat(p.getStreakCurrent()).isEqualTo(1);
        assertThat(p.getStreakBest()).isEqualTo(1);
    }

    @Test
    void recordQualifiedDay_reachingSeven_grantsStreakChest() {
        UserProgress p = progress(1L, 0);
        p.setStreakCurrent(6);
        p.setStreakBest(6);
        p.setStreakLastDate(LocalDate.of(2026, 10, 6));
        ProgressDeltaBuilder builder = service.begin(1L);

        service.recordQualifiedDay(builder, LocalDate.of(2026, 10, 7));

        assertThat(p.getStreakCurrent()).isEqualTo(7);
        assertThat(chests).singleElement().satisfies(c -> {
            assertThat(c.getSource()).isEqualTo(ChestSource.STREAK);
            assertThat(c.getSourceRef()).isEqualTo("streak:2026-10-07");
            assertThat(c.getLocalDate()).isEqualTo(LocalDate.of(2026, 10, 7));
        });
        assertThat(builder.build().chests()).hasSize(1);
    }

    @Test
    void recordQualifiedDay_reachingEight_grantsNoChest() {
        UserProgress p = progress(1L, 0);
        p.setStreakCurrent(7);
        p.setStreakLastDate(LocalDate.of(2026, 10, 6));

        service.recordQualifiedDay(service.begin(1L), LocalDate.of(2026, 10, 7));

        assertThat(p.getStreakCurrent()).isEqualTo(8);
        assertThat(chests).isEmpty();
    }

    @Test
    void onFriendshipAccepted_grantsFiftyXpToBothAndEvaluatesBadges() {
        UserProgress requester = progress(1L, 0);
        UserProgress addressee = progress(2L, 0);

        service.onFriendshipAccepted(1L, 2L);

        assertThat(requester.getXp()).isEqualTo(50);
        assertThat(addressee.getXp()).isEqualTo(50);
        assertThat(xpEvents).extracting(XpEvent::getDedupeKey)
                .containsExactlyInAnyOrder("friend:1:2", "friend:2:1");
        assertThat(xpEvents).allSatisfy(e -> {
            assertThat(e.getSource()).isEqualTo(XpSource.FRIEND);
            assertThat(e.getAmount()).isEqualTo(50);
        });
        assertThat(xpEvents).filteredOn(e -> e.getUser().getId().equals(1L))
                .singleElement().satisfies(e -> assertThat(e.getRefId()).isEqualTo(2L));
        verify(badgeService).evaluate(1L);
        verify(badgeService).evaluate(2L);
    }

    @Test
    void onFriendshipAccepted_repeatPair_grantsNothing() {
        UserProgress requester = progress(1L, 0);
        UserProgress addressee = progress(2L, 0);
        when(xpEventRepository.existsByDedupeKey("friend:1:2")).thenReturn(true);
        when(xpEventRepository.existsByDedupeKey("friend:2:1")).thenReturn(true);

        service.onFriendshipAccepted(2L, 1L);

        assertThat(requester.getXp()).isZero();
        assertThat(addressee.getXp()).isZero();
        assertThat(xpEvents).isEmpty();
    }

    @Test
    void onFriendshipAccepted_eleventhGrantInWindow_grantsNothingToThatUser() {
        UserProgress busy = progress(1L, 0);
        UserProgress fresh = progress(2L, 0);
        when(xpEventRepository.sumAmountByUserIdAndSourceAndCreatedAtBetween(1L, XpSource.FRIEND,
                NOW.minus(Duration.ofHours(24)), NOW)).thenReturn(500);

        service.onFriendshipAccepted(1L, 2L);

        assertThat(busy.getXp()).isZero();
        assertThat(fresh.getXp()).isEqualTo(50);
        assertThat(xpEvents).filteredOn(e -> e.getAmount() > 0).extracting(XpEvent::getDedupeKey)
                .containsExactly("friend:2:1");
    }

    @Test
    void onFriendshipAccepted_tenthGrantInWindow_isStillGranted() {
        UserProgress p = progress(1L, 0);
        progress(2L, 0);
        when(xpEventRepository.sumAmountByUserIdAndSourceAndCreatedAtBetween(eq(1L), eq(XpSource.FRIEND), any(),
                any())).thenReturn(450);

        service.onFriendshipAccepted(1L, 2L);

        assertThat(p.getXp()).isEqualTo(50);
    }

    @Test
    void onFriendshipAccepted_locksLowerUserIdFirst() {
        progress(1L, 0);
        progress(2L, 0);

        service.onFriendshipAccepted(2L, 1L);

        InOrder order = inOrder(userProgressRepository);
        order.verify(userProgressRepository).findForUpdate(1L);
        order.verify(userProgressRepository).findForUpdate(2L);
    }

    @Test
    void onFriendshipAccepted_sameUser_doesNothing() {
        progress(1L, 0);

        service.onFriendshipAccepted(1L, 1L);

        verify(userProgressRepository, never()).findForUpdate(anyLong());
        assertThat(xpEvents).isEmpty();
    }

    @Test
    void me_returnsEffectiveStreakMultiplierCoinsAndChests() {
        User me = user(1L);
        me.setTimezone("America/Vancouver");
        when(currentUser.entity()).thenReturn(me);
        UserProgress p = progress(1L, 2724);
        p.setCoins(85);
        p.setStreakCurrent(3);
        p.setStreakBest(8);
        p.setStreakLastDate(LocalDate.of(2026, 10, 6));
        when(badgeService.summary(1L)).thenReturn(new BadgeSummary(List.of(), 4, 24));
        when(chestRepository.countByUserIdAndOpenedAtIsNull(1L)).thenReturn(2L);

        ProgressDto dto = service.me();

        assertThat(dto.level()).isEqualTo(5);
        assertThat(dto.xpIntoLevel()).isEqualTo(424);
        assertThat(dto.xpForNext()).isEqualTo(700);
        assertThat(dto.coins()).isEqualTo(85);
        assertThat(dto.streak().current()).isEqualTo(3);
        assertThat(dto.streak().best()).isEqualTo(8);
        assertThat(dto.streak().multiplier()).isEqualTo(1.2);
        assertThat(dto.badgeCount()).isEqualTo(4);
        assertThat(dto.badgeTotal()).isEqualTo(24);
        assertThat(dto.unopenedChests()).isEqualTo(2);
        verify(badgeService).evaluate(1L);
    }

    @Test
    void onFriendshipAccepted_otherAccountUnderSevenDaysOld_withholdsXpFromRecipient() {
        UserProgress veteran = progress(1L, 0);
        UserProgress newcomer = progress(2L, 0);
        user(2L).setCreatedAt(NOW.minus(Duration.ofDays(7)).plusSeconds(1));

        service.onFriendshipAccepted(1L, 2L);

        assertThat(veteran.getXp()).isZero();
        assertThat(newcomer.getXp()).isEqualTo(50);
        assertThat(xpEvents).filteredOn(e -> e.getAmount() > 0).extracting(XpEvent::getDedupeKey)
                .containsExactly("friend:2:1");
    }

    @Test
    void onFriendshipAccepted_pairIneligibleAtAccept_neverPaysLater() {
        UserProgress veteran = progress(1L, 0);
        progress(2L, 0);
        user(2L).setCreatedAt(NOW.minus(Duration.ofDays(1)));
        service.onFriendshipAccepted(1L, 2L);

        user(2L).setCreatedAt(NOW.minus(Duration.ofDays(30)));
        service.onFriendshipAccepted(1L, 2L);

        assertThat(veteran.getXp()).isZero();
        assertThat(xpEvents).filteredOn(e -> e.getDedupeKey().equals("friend:1:2"))
                .allSatisfy(e -> assertThat(e.getAmount()).isZero());
    }

    @Test
    void onFriendshipAccepted_otherAccountExactlySevenDaysOld_grantsXp() {
        UserProgress veteran = progress(1L, 0);
        progress(2L, 0);
        user(2L).setCreatedAt(NOW.minus(Duration.ofDays(7)));

        service.onFriendshipAccepted(1L, 2L);

        assertThat(veteran.getXp()).isEqualTo(50);
    }

    @Test
    void onFriendshipAccepted_otherAccountWithOnlyFriendXp_withholdsXpFromRecipient() {
        UserProgress requester = progress(1L, 0);
        UserProgress addressee = progress(2L, 0);
        when(xpEventRepository.existsByUserIdAndSourceNot(2L, XpSource.FRIEND)).thenReturn(false);

        service.onFriendshipAccepted(1L, 2L);

        assertThat(requester.getXp()).isZero();
        assertThat(addressee.getXp()).isEqualTo(50);
    }

    @Test
    void onFriendshipAccepted_twoFreshAccounts_grantNoXpButStillEvaluateBadges() {
        UserProgress first = progress(1L, 0);
        UserProgress second = progress(2L, 0);
        user(1L).setCreatedAt(NOW.minus(Duration.ofDays(1)));
        user(2L).setCreatedAt(NOW.minus(Duration.ofDays(2)));
        when(xpEventRepository.existsByUserIdAndSourceNot(anyLong(), eq(XpSource.FRIEND))).thenReturn(false);

        service.onFriendshipAccepted(1L, 2L);

        assertThat(first.getXp()).isZero();
        assertThat(second.getXp()).isZero();
        assertThat(xpEvents).allSatisfy(e -> assertThat(e.getAmount()).isZero());
        verify(badgeService).evaluate(1L);
        verify(badgeService).evaluate(2L);
    }

    @Test
    void me_usesStoredProgressZoneWhileLiveZoneChangeIsUnderSevenDays() {
        ProgressService late = serviceAt(Instant.parse("2026-10-08T05:00:00Z"));
        User me = user(1L);
        me.setTimezone("Asia/Tokyo");
        when(currentUser.entity()).thenReturn(me);
        UserProgress p = progress(1L, 0);
        p.setProgressZone("America/Vancouver");
        p.setProgressZoneChangedAt(Instant.parse("2026-10-07T05:00:00Z"));
        p.setStreakCurrent(3);
        p.setStreakLastDate(LocalDate.of(2026, 10, 6));
        when(badgeService.summary(1L)).thenReturn(new BadgeSummary(List.of(), 0, 24));

        ProgressDto dto = late.me();

        assertThat(dto.streak().current()).isEqualTo(3);
        assertThat(p.getProgressZone()).isEqualTo("America/Vancouver");
        assertThat(p.getProgressZoneChangedAt()).isEqualTo(Instant.parse("2026-10-07T05:00:00Z"));
    }

    @Test
    void me_liveZoneChangedSevenDaysAfterLastSwitch_adoptsLiveZone() {
        Instant now = Instant.parse("2026-10-08T05:00:00Z");
        ProgressService late = serviceAt(now);
        User me = user(1L);
        me.setTimezone("Asia/Tokyo");
        when(currentUser.entity()).thenReturn(me);
        UserProgress p = progress(1L, 0);
        p.setProgressZone("America/Vancouver");
        p.setProgressZoneChangedAt(now.minus(Duration.ofDays(7)));
        p.setStreakCurrent(3);
        p.setStreakLastDate(LocalDate.of(2026, 10, 6));
        when(badgeService.summary(1L)).thenReturn(new BadgeSummary(List.of(), 0, 24));

        ProgressDto dto = late.me();

        assertThat(p.getProgressZone()).isEqualTo("Asia/Tokyo");
        assertThat(p.getProgressZoneChangedAt()).isEqualTo(now);
        assertThat(dto.streak().current()).isZero();
    }

    @Test
    void me_noProgressZoneYet_adoptsLiveZoneAndStampsChange() {
        User me = user(1L);
        me.setTimezone("America/Vancouver");
        when(currentUser.entity()).thenReturn(me);
        UserProgress p = progress(1L, 0);
        when(badgeService.summary(1L)).thenReturn(new BadgeSummary(List.of(), 0, 24));

        service.me();

        assertThat(p.getProgressZone()).isEqualTo("America/Vancouver");
        assertThat(p.getProgressZoneChangedAt()).isEqualTo(NOW);
    }

    @Test
    void publicFor_usesProgressZoneWhileLiveZoneChangeIsCoolingDown() {
        ProgressService late = serviceAt(Instant.parse("2026-10-08T05:00:00Z"));
        user(2L).setTimezone("Asia/Tokyo");
        UserProgress p = progress(2L, 0);
        p.setProgressZone("America/Vancouver");
        p.setProgressZoneChangedAt(Instant.parse("2026-10-07T05:00:00Z"));
        p.setStreakCurrent(3);
        p.setStreakLastDate(LocalDate.of(2026, 10, 6));
        when(badgeService.summary(2L)).thenReturn(new BadgeSummary(List.of(), 0, 24));

        assertThat(late.publicFor(2L).streakCurrent()).isEqualTo(3);
    }

    @Test
    void publicFor_neverWritesTheViewedUsersProgressZone() {
        user(2L).setTimezone("Asia/Tokyo");
        UserProgress unset = progress(2L, 0);
        when(badgeService.summary(2L)).thenReturn(new BadgeSummary(List.of(), 0, 24));

        service.publicFor(2L);

        assertThat(unset.getProgressZone()).isNull();
        assertThat(unset.getProgressZoneChangedAt()).isNull();
        verify(userProgressRepository, never()).findForUpdate(anyLong());
    }

    @Test
    void progressZone_noZoneAndNoReportedTimezone_adoptsFallbackWithoutStamp() {
        ProgressService withFallback = serviceAt(NOW, "America/Toronto");
        User u = user(1L);
        u.setTimezone(null);
        UserProgress p = progress(1L, 0);

        assertThat(withFallback.progressZone(p, u)).isEqualTo(ZoneId.of("America/Toronto"));
        assertThat(p.getProgressZone()).isEqualTo("America/Toronto");
        assertThat(p.getProgressZoneChangedAt()).isNull();
    }

    @Test
    void progressZone_firstReportedZoneAfterFallback_isAdoptedImmediately() {
        User u = user(1L);
        u.setTimezone(null);
        UserProgress p = progress(1L, 0);
        serviceAt(NOW, "America/Toronto").progressZone(p, u);

        u.setTimezone("America/Vancouver");
        Instant shortlyAfter = NOW.plus(Duration.ofHours(1));
        ZoneId zone = serviceAt(shortlyAfter, "America/Toronto").progressZone(p, u);

        assertThat(zone).isEqualTo(VANCOUVER);
        assertThat(p.getProgressZone()).isEqualTo("America/Vancouver");
        assertThat(p.getProgressZoneChangedAt()).isEqualTo(shortlyAfter);
    }

    @Test
    void progressZone_noZoneWithReportedTimezone_adoptsItAndStampsChange() {
        User u = user(1L);
        u.setTimezone("America/Vancouver");
        UserProgress p = progress(1L, 0);

        assertThat(serviceAt(NOW, "America/Toronto").progressZone(p, u)).isEqualTo(VANCOUVER);
        assertThat(p.getProgressZone()).isEqualTo("America/Vancouver");
        assertThat(p.getProgressZoneChangedAt()).isEqualTo(NOW);
    }

    @Test
    void progressZone_firstReportMatchingFallback_stampsChangeAndStartsCooldown() {
        User u = user(1L);
        u.setTimezone(null);
        UserProgress p = progress(1L, 0);
        serviceAt(NOW, "America/Toronto").progressZone(p, u);
        assertThat(p.getProgressZoneChangedAt()).isNull();

        u.setTimezone("America/Toronto");
        Instant reportedAt = NOW.plus(Duration.ofHours(1));
        assertThat(serviceAt(reportedAt, "America/Toronto").progressZone(p, u))
                .isEqualTo(ZoneId.of("America/Toronto"));
        assertThat(p.getProgressZone()).isEqualTo("America/Toronto");
        assertThat(p.getProgressZoneChangedAt()).isEqualTo(reportedAt);

        u.setTimezone("America/Vancouver");
        Instant almostWeekLater = reportedAt.plus(Duration.ofDays(7)).minusSeconds(1);
        assertThat(serviceAt(almostWeekLater, "America/Toronto").progressZone(p, u))
                .isEqualTo(ZoneId.of("America/Toronto"));
        assertThat(p.getProgressZoneChangedAt()).isEqualTo(reportedAt);

        Instant weekLater = reportedAt.plus(Duration.ofDays(7));
        assertThat(serviceAt(weekLater, "America/Toronto").progressZone(p, u)).isEqualTo(VANCOUVER);
        assertThat(p.getProgressZone()).isEqualTo("America/Vancouver");
        assertThat(p.getProgressZoneChangedAt()).isEqualTo(weekLater);
    }

    @Test
    void progressZone_matchesLiveZone_keepsStampUntouched() {
        User u = user(1L);
        u.setTimezone("America/Vancouver");
        UserProgress p = progress(1L, 0);
        p.setProgressZone("America/Vancouver");
        p.setProgressZoneChangedAt(NOW.minus(Duration.ofDays(40)));

        assertThat(service.progressZone(p, u)).isEqualTo(VANCOUVER);
        assertThat(p.getProgressZoneChangedAt()).isEqualTo(NOW.minus(Duration.ofDays(40)));
    }

    @Test
    void progressZone_liveZoneChangedWithinSevenDaysOfLastSwitch_keepsStoredZone() {
        User u = user(1L);
        u.setTimezone("Asia/Tokyo");
        UserProgress p = progress(1L, 0);
        p.setProgressZone("America/Vancouver");
        p.setProgressZoneChangedAt(NOW.minus(Duration.ofDays(7)).plusSeconds(1));

        assertThat(service.progressZone(p, u)).isEqualTo(VANCOUVER);
        assertThat(p.getProgressZone()).isEqualTo("America/Vancouver");
        assertThat(p.getProgressZoneChangedAt()).isEqualTo(NOW.minus(Duration.ofDays(7)).plusSeconds(1));
    }

    @Test
    void progressZone_liveZoneChangedSevenDaysAfterLastSwitch_adoptsLiveZone() {
        User u = user(1L);
        u.setTimezone("Asia/Tokyo");
        UserProgress p = progress(1L, 0);
        p.setProgressZone("America/Vancouver");
        p.setProgressZoneChangedAt(NOW.minus(Duration.ofDays(7)));

        assertThat(service.progressZone(p, u)).isEqualTo(ZoneId.of("Asia/Tokyo"));
        assertThat(p.getProgressZone()).isEqualTo("Asia/Tokyo");
        assertThat(p.getProgressZoneChangedAt()).isEqualTo(NOW);
    }

    @Test
    void progressZone_secondSwitchWithinCooldown_isIgnored() {
        User u = user(1L);
        u.setTimezone("Asia/Tokyo");
        UserProgress p = progress(1L, 0);
        p.setProgressZone("America/Vancouver");
        p.setProgressZoneChangedAt(NOW.minus(Duration.ofDays(8)));
        service.progressZone(p, u);

        u.setTimezone("Europe/London");
        ProgressService nextDay = serviceAt(NOW.plus(Duration.ofDays(1)));

        assertThat(nextDay.progressZone(p, u)).isEqualTo(ZoneId.of("Asia/Tokyo"));
        assertThat(p.getProgressZoneChangedAt()).isEqualTo(NOW);
    }

    @Test
    void readProgressZone_neverWrites() {
        User u = user(1L);
        u.setTimezone("Asia/Tokyo");
        UserProgress unset = progress(1L, 0);

        assertThat(service.readProgressZone(unset, u)).isEqualTo(ZoneId.of("Asia/Tokyo"));
        assertThat(unset.getProgressZone()).isNull();
        assertThat(unset.getProgressZoneChangedAt()).isNull();
    }

    @Test
    void publicFor_unknownUser_throwsNotFound() {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.publicFor(99L)).isInstanceOf(NotFoundException.class);
    }
}
