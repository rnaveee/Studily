package com.rnave.studily.progress;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.flashcard.FlashcardRunRepository;
import com.rnave.studily.friend.FriendRequestRepository;
import com.rnave.studily.progress.ProgressDtos.BadgeDto;
import com.rnave.studily.progress.ProgressDtos.BadgeSummary;
import com.rnave.studily.progress.ProgressDtos.PurchaseResult;
import com.rnave.studily.studysession.StudySessionRepository;
import com.rnave.studily.studysession.StudySessionStatus;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import com.rnave.studily.user.UserTimeZones;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class BadgeServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-20T12:00:00Z");
    private static final String BASE_URL = "https://badges.studily.ca/badges/v1";

    private BadgeRepository badgeRepository;
    private UserBadgeRepository userBadgeRepository;
    private UserRepository userRepository;
    private UserProgressRepository userProgressRepository;
    private FriendRequestRepository friendRequestRepository;
    private StudySessionRepository studySessionRepository;
    private FlashcardRunRepository flashcardRunRepository;
    private CoinTransactionRepository coinTransactionRepository;
    private CurrentUser currentUser;
    private BadgeService service;

    private final Map<String, Badge> catalog = new LinkedHashMap<>();
    private final List<UserBadge> owned = new ArrayList<>();
    private final List<CoinTransaction> coinTransactions = new ArrayList<>();
    private User user;
    private UserProgress progress;

    @BeforeEach
    void setUp() {
        badgeRepository = mock(BadgeRepository.class);
        userBadgeRepository = mock(UserBadgeRepository.class);
        userRepository = mock(UserRepository.class);
        userProgressRepository = mock(UserProgressRepository.class);
        friendRequestRepository = mock(FriendRequestRepository.class);
        studySessionRepository = mock(StudySessionRepository.class);
        flashcardRunRepository = mock(FlashcardRunRepository.class);
        coinTransactionRepository = mock(CoinTransactionRepository.class);
        currentUser = mock(CurrentUser.class);
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

        ProgressService progressService = new ProgressService(userProgressRepository, mock(XpEventRepository.class),
                coinTransactionRepository, mock(ChestRepository.class), userRepository, mock(BadgeService.class),
                new UserTimeZones(userRepository, "UTC"), currentUser, clock);
        service = new BadgeService(badgeRepository, userBadgeRepository, userRepository, userProgressRepository,
                friendRequestRepository, studySessionRepository, flashcardRunRepository, progressService,
                currentUser, clock, BASE_URL + "/", "2026-10-11");

        seedCatalog();
        user = new User();
        user.setId(1L);
        user.setCreatedAt(NOW.minusSeconds(86_400));
        progress = new UserProgress();
        progress.setUserId(1L);

        when(currentUser.id()).thenReturn(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userRepository.existsById(1L)).thenReturn(true);
        when(userRepository.getReferenceById(1L)).thenReturn(user);
        when(userProgressRepository.findById(1L)).thenAnswer(inv -> Optional.of(progress));
        when(userProgressRepository.findForUpdate(1L)).thenAnswer(inv -> Optional.of(progress));
        when(badgeRepository.findByActiveTrueOrderByCategoryAscSortOrderAsc())
                .thenAnswer(inv -> catalog.values().stream().filter(Badge::isActive).toList());
        when(badgeRepository.findById(anyString()))
                .thenAnswer(inv -> Optional.ofNullable(catalog.get(inv.<String>getArgument(0))));
        when(userBadgeRepository.findByUserId(1L)).thenAnswer(inv -> List.copyOf(owned));
        when(userBadgeRepository.existsByUserIdAndBadgeCode(eq(1L), anyString()))
                .thenAnswer(inv -> owned.stream().anyMatch(ub -> ub.getBadge().getCode().equals(inv.getArgument(1))));
        when(userBadgeRepository.save(any(UserBadge.class))).thenAnswer(inv -> {
            owned.add(inv.getArgument(0));
            return inv.getArgument(0);
        });
        when(coinTransactionRepository.save(any(CoinTransaction.class))).thenAnswer(inv -> {
            coinTransactions.add(inv.getArgument(0));
            return inv.getArgument(0);
        });
    }

    private void seedCatalog() {
        String[][] rows = {
                {"level_1", "LEVEL"}, {"level_5", "LEVEL"}, {"level_10", "LEVEL"}, {"level_20", "LEVEL"},
                {"level_30", "LEVEL"}, {"level_50", "LEVEL"}, {"level_75", "LEVEL"}, {"level_100", "LEVEL"},
                {"friends_5", "SOCIAL"}, {"friends_10", "SOCIAL"}, {"friends_20", "SOCIAL"},
                {"friends_50", "SOCIAL"}, {"schoolmates_10", "SOCIAL"},
                {"og", "TENURE"}, {"member_1m", "TENURE"}, {"member_6m", "TENURE"}, {"member_1y", "TENURE"},
                {"first_session", "STUDY"}, {"streak_7", "STUDY"}, {"streak_30", "STUDY"},
                {"hours_10", "STUDY"}, {"hours_100", "STUDY"},
                {"runs_10", "FLASHCARDS"}, {"runs_100", "FLASHCARDS"},
                {"cosmetic_spark", "COSMETIC", "300"}, {"cosmetic_comet", "COSMETIC", "600"},
                {"cosmetic_crown", "COSMETIC", "1200"}};
        int sort = 0;
        for (String[] row : rows) {
            Badge badge = new Badge();
            badge.setCode(row[0]);
            badge.setCategory(BadgeCategory.valueOf(row[1]));
            badge.setTitle(row[0]);
            badge.setDescription(row[0]);
            badge.setImageKey(row[0] + ".webp");
            badge.setPriceCoins(row.length > 2 ? Integer.valueOf(row[2]) : null);
            badge.setSortOrder(sort += 10);
            catalog.put(row[0], badge);
        }
    }

    private UserBadge own(String code, Integer slot) {
        UserBadge ub = new UserBadge();
        ub.setUser(user);
        ub.setBadge(catalog.get(code));
        ub.setSource(BadgeSource.EARNED);
        ub.setAcquiredAt(NOW.minusSeconds(3600));
        ub.setFeaturedSlot(slot);
        owned.add(ub);
        return ub;
    }

    private List<String> earnedCodes() {
        owned.clear();
        return service.evaluate(1L).stream().map(BadgeDto::code).toList();
    }

    @Test
    void evaluate_newUser_earnsOnlyLevelOne() {
        List<BadgeDto> earned = service.evaluate(1L);

        assertThat(earned).extracting(BadgeDto::code).containsExactly("level_1");
        assertThat(earned.get(0).owned()).isTrue();
        assertThat(earned.get(0).acquiredAt()).isEqualTo(NOW);
        assertThat(earned.get(0).imageUrl()).isEqualTo(BASE_URL + "/level_1.webp");
        assertThat(owned).singleElement().satisfies(ub -> {
            assertThat(ub.getSource()).isEqualTo(BadgeSource.EARNED);
            assertThat(ub.getUser()).isSameAs(user);
        });
    }

    @Test
    void evaluate_alreadyOwned_insertsNothing() {
        own("level_1", null);

        assertThat(service.evaluate(1L)).isEmpty();
        verify(userBadgeRepository, never()).save(any());
    }

    @Test
    void evaluate_neverAwardsCosmetics() {
        progress.setLevel(100);
        progress.setStreakBest(100);
        when(friendRequestRepository.countFriendsOf(1L)).thenReturn(100L);

        assertThat(earnedCodes()).noneMatch(code -> code.startsWith("cosmetic_"));
    }

    @Test
    void evaluate_unknownUser_throwsNotFound() {
        when(userRepository.findById(9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.evaluate(9L)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void evaluate_levelThresholds() {
        progress.setLevel(9);
        assertThat(earnedCodes()).containsExactly("level_1", "level_5");

        progress.setLevel(10);
        assertThat(earnedCodes()).containsExactly("level_1", "level_5", "level_10");

        progress.setLevel(100);
        assertThat(earnedCodes()).contains("level_20", "level_30", "level_50", "level_75", "level_100");
    }

    @Test
    void evaluate_ogCutoffBoundary() {
        user.setCreatedAt(Instant.parse("2026-10-10T23:59:59.999Z"));
        assertThat(earnedCodes()).contains("og");

        user.setCreatedAt(Instant.parse("2026-10-11T00:00:00Z"));
        assertThat(earnedCodes()).doesNotContain("og");
    }

    @Test
    void evaluate_memberOneMonthBoundary() {
        user.setCreatedAt(Instant.parse("2026-09-20T12:00:00Z"));
        assertThat(earnedCodes()).contains("member_1m").doesNotContain("member_6m");

        user.setCreatedAt(Instant.parse("2026-09-20T12:00:00.001Z"));
        assertThat(earnedCodes()).doesNotContain("member_1m");
    }

    @Test
    void evaluate_memberSixMonthsBoundary() {
        user.setCreatedAt(Instant.parse("2026-04-20T12:00:00Z"));
        assertThat(earnedCodes()).contains("member_1m", "member_6m").doesNotContain("member_1y");

        user.setCreatedAt(Instant.parse("2026-04-20T12:00:00.001Z"));
        assertThat(earnedCodes()).contains("member_1m").doesNotContain("member_6m");
    }

    @Test
    void evaluate_memberOneYearBoundary() {
        user.setCreatedAt(Instant.parse("2025-10-20T12:00:00Z"));
        assertThat(earnedCodes()).contains("member_1m", "member_6m", "member_1y");

        user.setCreatedAt(Instant.parse("2025-10-20T12:00:00.001Z"));
        assertThat(earnedCodes()).contains("member_6m").doesNotContain("member_1y");
    }

    @Test
    void evaluate_friendThresholds() {
        when(friendRequestRepository.countFriendsOf(1L)).thenReturn(4L);
        assertThat(earnedCodes()).noneMatch(code -> code.startsWith("friends_"));

        when(friendRequestRepository.countFriendsOf(1L)).thenReturn(5L);
        assertThat(earnedCodes()).filteredOn(code -> code.startsWith("friends_")).containsExactly("friends_5");

        when(friendRequestRepository.countFriendsOf(1L)).thenReturn(10L);
        assertThat(earnedCodes()).filteredOn(code -> code.startsWith("friends_"))
                .containsExactly("friends_5", "friends_10");

        when(friendRequestRepository.countFriendsOf(1L)).thenReturn(49L);
        assertThat(earnedCodes()).filteredOn(code -> code.startsWith("friends_"))
                .containsExactly("friends_5", "friends_10", "friends_20");

        when(friendRequestRepository.countFriendsOf(1L)).thenReturn(50L);
        assertThat(earnedCodes()).filteredOn(code -> code.startsWith("friends_"))
                .containsExactly("friends_5", "friends_10", "friends_20", "friends_50");
    }

    @Test
    void evaluate_schoolmatesThreshold() {
        user.setSchoolKey("sfu");
        when(friendRequestRepository.countSchoolmateFriendsOf(1L, "sfu")).thenReturn(9L);
        assertThat(earnedCodes()).doesNotContain("schoolmates_10");

        when(friendRequestRepository.countSchoolmateFriendsOf(1L, "sfu")).thenReturn(10L);
        assertThat(earnedCodes()).contains("schoolmates_10");
    }

    @Test
    void evaluate_noSchool_neverCountsSchoolmates() {
        user.setSchoolKey(null);

        assertThat(earnedCodes()).doesNotContain("schoolmates_10");
        verify(friendRequestRepository, never()).countSchoolmateFriendsOf(anyLong(), any());
    }

    @Test
    void evaluate_hoursThresholds() {
        when(studySessionRepository.sumCreditedMinutesByUserId(1L)).thenReturn(599L);
        assertThat(earnedCodes()).doesNotContain("hours_10", "hours_100");

        when(studySessionRepository.sumCreditedMinutesByUserId(1L)).thenReturn(600L);
        assertThat(earnedCodes()).contains("hours_10").doesNotContain("hours_100");

        when(studySessionRepository.sumCreditedMinutesByUserId(1L)).thenReturn(5999L);
        assertThat(earnedCodes()).doesNotContain("hours_100");

        when(studySessionRepository.sumCreditedMinutesByUserId(1L)).thenReturn(6000L);
        assertThat(earnedCodes()).contains("hours_10", "hours_100");
    }

    @Test
    void evaluate_runsThresholdsCountOnlyXpEligibleRunsOfFiveCards() {
        when(flashcardRunRepository.countByUserIdAndCompletedAtIsNotNullAndCardCountGreaterThanEqual(anyLong(), anyInt()))
                .thenReturn(500L);
        stubEligibleRuns(9L);
        assertThat(earnedCodes()).doesNotContain("runs_10", "runs_100");

        stubEligibleRuns(10L);
        assertThat(earnedCodes()).contains("runs_10").doesNotContain("runs_100");

        stubEligibleRuns(99L);
        assertThat(earnedCodes()).contains("runs_10").doesNotContain("runs_100");

        stubEligibleRuns(100L);
        assertThat(earnedCodes()).contains("runs_10", "runs_100");
    }

    private void stubEligibleRuns(long count) {
        when(flashcardRunRepository.countByUserIdAndCompletedAtIsNotNullAndCardCountGreaterThanEqualAndXpReasonNotIn(
                eq(1L), eq(5), argThat(reasons -> reasons != null
                        && Set.copyOf(reasons).equals(Set.of("TOO_FAST", "TOO_FEW"))))).thenReturn(count);
    }

    @Test
    void evaluate_streakThresholdsUseBestStreak() {
        progress.setStreakCurrent(0);
        progress.setStreakBest(6);
        assertThat(earnedCodes()).doesNotContain("streak_7");

        progress.setStreakBest(7);
        assertThat(earnedCodes()).contains("streak_7").doesNotContain("streak_30");

        progress.setStreakBest(30);
        assertThat(earnedCodes()).contains("streak_7", "streak_30");
    }

    @Test
    void evaluate_firstSessionNeedsCompletedSession() {
        assertThat(earnedCodes()).doesNotContain("first_session");

        when(studySessionRepository.existsByUserIdAndStatus(1L, StudySessionStatus.COMPLETED)).thenReturn(true);
        assertThat(earnedCodes()).contains("first_session");
    }

    @Test
    void purchase_unknownBadge_throwsNotFound() {
        progress.setCoins(5000);

        assertThatThrownBy(() -> service.purchase("cosmetic_nope")).isInstanceOf(NotFoundException.class);
        assertThat(coinTransactions).isEmpty();
    }

    @Test
    void purchase_inactiveBadge_throwsNotFound() {
        progress.setCoins(5000);
        catalog.get("cosmetic_spark").setActive(false);

        assertThatThrownBy(() -> service.purchase("cosmetic_spark")).isInstanceOf(NotFoundException.class);
    }

    @Test
    void purchase_nonCosmeticOwnedWithNoCoins_throwsBadRequestBeforeConflict() {
        own("level_5", null);

        assertThatThrownBy(() -> service.purchase("level_5"))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("This badge can't be bought");
    }

    @Test
    void purchase_cosmeticWithoutPrice_throwsBadRequest() {
        progress.setCoins(5000);
        catalog.get("cosmetic_spark").setPriceCoins(null);

        assertThatThrownBy(() -> service.purchase("cosmetic_spark"))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("This badge can't be bought");
    }

    @Test
    void purchase_alreadyOwnedWithNoCoins_throwsConflictBeforeCoinCheck() {
        own("cosmetic_spark", null);

        assertThatThrownBy(() -> service.purchase("cosmetic_spark"))
                .isInstanceOf(ConflictException.class)
                .hasMessage("You already own this badge");
    }

    @Test
    void purchase_notEnoughCoins_throwsBadRequestAndChangesNothing() {
        progress.setCoins(299);

        assertThatThrownBy(() -> service.purchase("cosmetic_spark"))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Not enough coins");
        assertThat(progress.getCoins()).isEqualTo(299);
        assertThat(coinTransactions).isEmpty();
        assertThat(owned).isEmpty();
    }

    @Test
    void purchase_exactCoins_deductsCoinsAndGrantsBadge() {
        progress.setCoins(300);

        PurchaseResult result = service.purchase("cosmetic_spark");

        assertThat(result.coins()).isZero();
        assertThat(progress.getCoins()).isZero();
        assertThat(result.badge().code()).isEqualTo("cosmetic_spark");
        assertThat(result.badge().owned()).isTrue();
        assertThat(coinTransactions).singleElement().satisfies(tx -> {
            assertThat(tx.getAmount()).isEqualTo(-300);
            assertThat(tx.getReason()).isEqualTo(CoinReason.PURCHASE);
            assertThat(tx.getRef()).isEqualTo("badge:cosmetic_spark");
        });
        assertThat(owned).singleElement().satisfies(ub -> {
            assertThat(ub.getBadge().getCode()).isEqualTo("cosmetic_spark");
            assertThat(ub.getSource()).isEqualTo(BadgeSource.PURCHASED);
            assertThat(ub.getAcquiredAt()).isEqualTo(NOW);
        });
    }

    @Test
    void purchase_locksProgressBeforeCheckingBadge() {
        progress.setCoins(700);

        service.purchase("cosmetic_comet");

        InOrder order = inOrder(userProgressRepository, badgeRepository);
        order.verify(userProgressRepository).insertIfMissing(1L);
        order.verify(userProgressRepository).findForUpdate(1L);
        order.verify(badgeRepository).findById("cosmetic_comet");
        assertThat(progress.getCoins()).isEqualTo(100);
    }

    @Test
    void setFeatured_moreThanThree_throwsBadRequest() {
        own("level_1", null);
        own("level_5", null);
        own("og", null);
        own("friends_5", null);

        assertThatThrownBy(() -> service.setFeatured(List.of("level_1", "level_5", "og", "friends_5")))
                .isInstanceOf(BadRequestException.class);
        verify(userBadgeRepository, never()).saveAllAndFlush(anyIterable());
    }

    @Test
    void setFeatured_duplicates_throwsBadRequest() {
        own("level_1", null);

        assertThatThrownBy(() -> service.setFeatured(List.of("level_1", "level_1")))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void setFeatured_unownedBadge_throwsBadRequest() {
        own("level_1", null);

        assertThatThrownBy(() -> service.setFeatured(List.of("level_1", "level_100")))
                .isInstanceOf(BadRequestException.class);
        verify(userBadgeRepository, never()).saveAllAndFlush(anyIterable());
    }

    @Test
    void setFeatured_nullCode_throwsBadRequest() {
        own("level_1", null);

        assertThatThrownBy(() -> service.setFeatured(Arrays.asList("level_1", null)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void setFeatured_ownedBadges_assignsSlotsInOrderAndClearsOthers() {
        UserBadge level1 = own("level_1", 1);
        UserBadge level5 = own("level_5", 2);
        UserBadge friends5 = own("friends_5", null);
        UserBadge og = own("og", null);

        List<BadgeDto> result = service.setFeatured(List.of("og", "level_1", "friends_5"));

        assertThat(result).extracting(BadgeDto::code).containsExactly("og", "level_1", "friends_5");
        assertThat(result).extracting(BadgeDto::featuredSlot).containsExactly(1, 2, 3);
        assertThat(og.getFeaturedSlot()).isEqualTo(1);
        assertThat(level1.getFeaturedSlot()).isEqualTo(2);
        assertThat(friends5.getFeaturedSlot()).isEqualTo(3);
        assertThat(level5.getFeaturedSlot()).isNull();
    }

    @Test
    void setFeatured_emptyList_clearsAllSlots() {
        UserBadge level1 = own("level_1", 1);
        UserBadge og = own("og", 3);

        assertThat(service.setFeatured(List.of())).isEmpty();
        assertThat(level1.getFeaturedSlot()).isNull();
        assertThat(og.getFeaturedSlot()).isNull();
    }

    @Test
    void summary_totalCountsActiveNonCosmeticPlusOwnedCosmetics() {
        own("level_1", 2);
        own("og", 1);
        own("cosmetic_comet", null);

        BadgeSummary summary = service.summary(1L);

        assertThat(summary.total()).isEqualTo(25);
        assertThat(summary.count()).isEqualTo(3);
        assertThat(summary.featured()).extracting(BadgeDto::code).containsExactly("og", "level_1");
    }

    @Test
    void mine_listsEveryActiveBadgeWithOwnedFlags() {
        own("level_1", null);

        List<BadgeDto> badges = service.mine();

        assertThat(badges).hasSize(27);
        assertThat(badges).filteredOn(BadgeDto::owned).extracting(BadgeDto::code).containsExactly("level_1");
        assertThat(badges).filteredOn(b -> b.code().equals("cosmetic_crown"))
                .singleElement().satisfies(b -> assertThat(b.priceCoins()).isEqualTo(1200));
    }

    @Test
    void forUser_unknownUser_throwsNotFound() {
        when(userRepository.existsById(99L)).thenReturn(false);

        assertThatThrownBy(() -> service.forUser(99L)).isInstanceOf(NotFoundException.class);
        verify(userBadgeRepository, never()).findByUserId(99L);
    }

    @Test
    void unownedCosmetics_excludesOwned() {
        own("cosmetic_spark", null);

        assertThat(service.unownedCosmetics(1L)).extracting(Badge::getCode)
                .containsExactly("cosmetic_comet", "cosmetic_crown");
    }
}
