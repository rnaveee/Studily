package com.rnave.studily.progress;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.progress.ProgressDtos.EquippedFlairResult;
import com.rnave.studily.progress.ProgressDtos.FlairDto;
import com.rnave.studily.progress.ProgressDtos.FlairPurchaseResult;
import com.rnave.studily.user.Flairs;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FlairServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-08T18:00:00Z");
    private static final String BASE_URL = "https://badges.studily.ca/flairs/v1";

    private FlairRepository flairRepository;
    private UserFlairRepository userFlairRepository;
    private UserRepository userRepository;
    private UserProgressRepository userProgressRepository;
    private CoinTransactionRepository coinTransactionRepository;
    private CurrentUser currentUser;
    private FlairService service;

    private final Map<String, Flair> catalog = new LinkedHashMap<>();
    private final List<UserFlair> owned = new ArrayList<>();
    private final List<CoinTransaction> coinTransactions = new ArrayList<>();
    private User user;
    private UserProgress progress;

    @BeforeEach
    void setUp() {
        flairRepository = mock(FlairRepository.class);
        userFlairRepository = mock(UserFlairRepository.class);
        userRepository = mock(UserRepository.class);
        userProgressRepository = mock(UserProgressRepository.class);
        coinTransactionRepository = mock(CoinTransactionRepository.class);
        currentUser = mock(CurrentUser.class);
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

        ProgressService progressService = new ProgressService(userProgressRepository, mock(XpEventRepository.class),
                coinTransactionRepository, mock(ChestRepository.class), userRepository, mock(BadgeService.class),
                mock(FlairService.class), new UserTimeZones(userRepository, "UTC"), currentUser, clock);
        service = new FlairService(flairRepository, userFlairRepository, userRepository, userProgressRepository,
                progressService, currentUser, new Flairs(flairRepository, clock, BASE_URL), clock);

        seedCatalog();
        user = new User();
        user.setId(1L);
        progress = new UserProgress();
        progress.setUserId(1L);

        when(currentUser.id()).thenReturn(1L);
        when(currentUser.entity()).thenReturn(user);
        when(userRepository.getReferenceById(1L)).thenReturn(user);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userProgressRepository.findById(1L)).thenAnswer(inv -> Optional.of(progress));
        when(userProgressRepository.findForUpdate(1L)).thenAnswer(inv -> Optional.of(progress));
        when(flairRepository.findByActiveTrueOrderBySortOrderAsc())
                .thenAnswer(inv -> catalog.values().stream().filter(Flair::isActive).toList());
        when(flairRepository.findById(anyString()))
                .thenAnswer(inv -> Optional.ofNullable(catalog.get(inv.<String>getArgument(0))));
        when(flairRepository.findAll()).thenAnswer(inv -> List.copyOf(catalog.values()));
        when(userFlairRepository.findByUserId(1L)).thenAnswer(inv -> List.copyOf(owned));
        when(userFlairRepository.existsByUserIdAndFlairCode(eq(1L), anyString()))
                .thenAnswer(inv -> owned.stream().anyMatch(uf -> uf.getFlair().getCode().equals(inv.getArgument(1))));
        when(userFlairRepository.save(any(UserFlair.class))).thenAnswer(inv -> {
            owned.add(inv.getArgument(0));
            return inv.getArgument(0);
        });
        when(coinTransactionRepository.save(any(CoinTransaction.class))).thenAnswer(inv -> {
            coinTransactions.add(inv.getArgument(0));
            return inv.getArgument(0);
        });
    }

    private void seedCatalog() {
        add("ring_mint", FlairRarity.COMMON, FlairUnlock.SHOP, 250, null);
        add("ring_ocean", FlairRarity.COMMON, FlairUnlock.SHOP, 250, null);
        add("ring_sunset", FlairRarity.RARE, FlairUnlock.SHOP, 500, null);
        add("ring_gold", FlairRarity.RARE, FlairUnlock.SHOP, 750, null);
        add("ring_neon", FlairRarity.EPIC, FlairUnlock.SHOP, 1200, null);
        add("ring_aurora", FlairRarity.EPIC, FlairUnlock.SHOP, 1500, null);
        add("ring_prism", FlairRarity.EPIC, FlairUnlock.CHEST, null, null);
        add("ring_galaxy", FlairRarity.LEGENDARY, FlairUnlock.CHEST, null, null);
        add("ring_ember", FlairRarity.RARE, FlairUnlock.STREAK, null, 7);
        add("ring_blaze", FlairRarity.EPIC, FlairUnlock.STREAK, null, 30);
        add("ring_inferno", FlairRarity.LEGENDARY, FlairUnlock.STREAK, null, 100);
    }

    private void add(String code, FlairRarity rarity, FlairUnlock unlock, Integer price, Integer streakDays) {
        Flair f = new Flair();
        f.setCode(code);
        f.setTitle(code);
        f.setDescription(code);
        f.setRarity(rarity);
        f.setUnlock(unlock);
        f.setPriceCoins(price);
        f.setStreakDays(streakDays);
        f.setSortOrder((catalog.size() + 1) * 10);
        catalog.put(code, f);
    }

    private UserFlair own(String code, FlairSource source) {
        UserFlair uf = new UserFlair();
        uf.setUser(user);
        uf.setFlair(catalog.get(code));
        uf.setSource(source);
        uf.setAcquiredAt(NOW.minusSeconds(3_600));
        owned.add(uf);
        return uf;
    }

    private List<String> ownedCodes() {
        return owned.stream().map(uf -> uf.getFlair().getCode()).toList();
    }

    @Test
    void purchase_unknownFlair_throwsNotFound() {
        progress.setCoins(5000);

        assertThatThrownBy(() -> service.purchase("ring_nope")).isInstanceOf(NotFoundException.class);
        assertThat(coinTransactions).isEmpty();
        assertThat(owned).isEmpty();
    }

    @Test
    void purchase_inactiveFlair_throwsNotFound() {
        progress.setCoins(5000);
        catalog.get("ring_mint").setActive(false);

        assertThatThrownBy(() -> service.purchase("ring_mint")).isInstanceOf(NotFoundException.class);
        assertThat(coinTransactions).isEmpty();
    }

    @Test
    void purchase_inactiveOwnedFlairWithNoCoins_throwsNotFoundBeforeOtherChecks() {
        catalog.get("ring_galaxy").setActive(false);
        own("ring_galaxy", FlairSource.CHEST);

        assertThatThrownBy(() -> service.purchase("ring_galaxy")).isInstanceOf(NotFoundException.class);
    }

    @Test
    void purchase_chestFlairOwnedWithNoCoins_throwsBadRequestBeforeConflict() {
        own("ring_prism", FlairSource.CHEST);

        assertThatThrownBy(() -> service.purchase("ring_prism"))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("This flair can't be bought");
    }

    @Test
    void purchase_streakFlair_throwsBadRequest() {
        progress.setCoins(5000);

        assertThatThrownBy(() -> service.purchase("ring_ember"))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("This flair can't be bought");
        assertThat(coinTransactions).isEmpty();
        assertThat(owned).isEmpty();
    }

    @Test
    void purchase_shopFlairWithoutPrice_throwsBadRequest() {
        progress.setCoins(5000);
        catalog.get("ring_mint").setPriceCoins(null);

        assertThatThrownBy(() -> service.purchase("ring_mint"))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("This flair can't be bought");
    }

    @Test
    void purchase_alreadyOwnedWithNoCoins_throwsConflictBeforeCoinCheck() {
        own("ring_mint", FlairSource.CHEST);

        assertThatThrownBy(() -> service.purchase("ring_mint"))
                .isInstanceOf(ConflictException.class)
                .hasMessage("You already own this flair");
        assertThat(coinTransactions).isEmpty();
    }

    @Test
    void purchase_notEnoughCoins_throwsBadRequestAndChangesNothing() {
        progress.setCoins(249);

        assertThatThrownBy(() -> service.purchase("ring_mint"))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Not enough coins");
        assertThat(progress.getCoins()).isEqualTo(249);
        assertThat(coinTransactions).isEmpty();
        assertThat(owned).isEmpty();
    }

    @Test
    void purchase_exactCoins_deductsCoinsWritesLedgerAndGrantsFlair() {
        progress.setCoins(250);

        FlairPurchaseResult result = service.purchase("ring_mint");

        assertThat(result.coins()).isZero();
        assertThat(progress.getCoins()).isZero();
        assertThat(result.flair().code()).isEqualTo("ring_mint");
        assertThat(result.flair().owned()).isTrue();
        assertThat(result.flair().acquiredAt()).isEqualTo(NOW);
        assertThat(result.flair().equipped()).isFalse();
        assertThat(result.flair().priceCoins()).isEqualTo(250);
        assertThat(coinTransactions).singleElement().satisfies(tx -> {
            assertThat(tx.getAmount()).isEqualTo(-250);
            assertThat(tx.getReason()).isEqualTo(CoinReason.PURCHASE);
            assertThat(tx.getRef()).isEqualTo("flair:ring_mint");
            assertThat(tx.getUser().getId()).isEqualTo(1L);
        });
        assertThat(owned).singleElement().satisfies(uf -> {
            assertThat(uf.getFlair().getCode()).isEqualTo("ring_mint");
            assertThat(uf.getSource()).isEqualTo(FlairSource.PURCHASED);
            assertThat(uf.getUser()).isSameAs(user);
            assertThat(uf.getAcquiredAt()).isEqualTo(NOW);
        });
        assertThat(user.getEquippedFlairCode()).isNull();
    }

    @Test
    void purchase_withSpareCoins_returnsRemainingBalance() {
        progress.setCoins(2000);

        FlairPurchaseResult result = service.purchase("ring_aurora");

        assertThat(result.coins()).isEqualTo(500);
        assertThat(progress.getCoins()).isEqualTo(500);
    }

    @Test
    void purchase_locksProgressBeforeCheckingFlair() {
        progress.setCoins(700);

        service.purchase("ring_sunset");

        InOrder order = inOrder(userProgressRepository, flairRepository, userFlairRepository);
        order.verify(userProgressRepository).insertIfMissing(1L);
        order.verify(userProgressRepository).findForUpdate(1L);
        order.verify(flairRepository).findById("ring_sunset");
        order.verify(userFlairRepository).existsByUserIdAndFlairCode(1L, "ring_sunset");
        order.verify(userFlairRepository).save(any(UserFlair.class));
        assertThat(progress.getCoins()).isEqualTo(200);
    }

    @Test
    void equip_ownedFlair_setsEquippedCodeAndReturnsEquippedDto() {
        own("ring_gold", FlairSource.PURCHASED);

        EquippedFlairResult result = service.equip("ring_gold");

        assertThat(user.getEquippedFlairCode()).isEqualTo("ring_gold");
        verify(userRepository).save(user);
        assertThat(result.equipped().code()).isEqualTo("ring_gold");
        assertThat(result.equipped().equipped()).isTrue();
        assertThat(result.equipped().owned()).isTrue();
        assertThat(result.equipped().acquiredAt()).isEqualTo(NOW.minusSeconds(3_600));
    }

    @Test
    void equip_anotherOwnedFlair_replacesEquipped() {
        own("ring_gold", FlairSource.PURCHASED);
        own("ring_ember", FlairSource.EARNED);
        user.setEquippedFlairCode("ring_gold");

        service.equip("ring_ember");

        assertThat(user.getEquippedFlairCode()).isEqualTo("ring_ember");
    }

    @Test
    void equip_unownedFlair_throwsBadRequestAndKeepsCurrent() {
        own("ring_gold", FlairSource.PURCHASED);
        user.setEquippedFlairCode("ring_gold");

        assertThatThrownBy(() -> service.equip("ring_galaxy"))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("You don't own this flair");
        assertThat(user.getEquippedFlairCode()).isEqualTo("ring_gold");
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void equip_unknownCode_throwsBadRequest() {
        assertThatThrownBy(() -> service.equip("ring_nope"))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("You don't own this flair");
        assertThat(user.getEquippedFlairCode()).isNull();
    }

    @Test
    void equip_null_unequips() {
        own("ring_gold", FlairSource.PURCHASED);
        user.setEquippedFlairCode("ring_gold");

        EquippedFlairResult result = service.equip(null);

        assertThat(result.equipped()).isNull();
        assertThat(user.getEquippedFlairCode()).isNull();
        verify(userRepository).save(user);
    }

    @Test
    void mine_listsActiveFlairsInSortOrderWithOwnedAndEquipped() {
        own("ring_ocean", FlairSource.PURCHASED);
        own("ring_ember", FlairSource.EARNED);
        user.setEquippedFlairCode("ring_ember");
        catalog.get("ring_neon").setActive(false);
        catalog.get("ring_galaxy").setImageKey("galaxy.webp");

        List<FlairDto> flairs = service.mine();

        assertThat(flairs).extracting(FlairDto::code).containsExactly("ring_mint", "ring_ocean", "ring_sunset",
                "ring_gold", "ring_aurora", "ring_prism", "ring_galaxy", "ring_ember", "ring_blaze", "ring_inferno");
        assertThat(flairs).filteredOn(FlairDto::owned).extracting(FlairDto::code)
                .containsExactly("ring_ocean", "ring_ember");
        assertThat(flairs).filteredOn(FlairDto::equipped).extracting(FlairDto::code).containsExactly("ring_ember");
        assertThat(flairs).filteredOn(f -> !f.owned()).allSatisfy(f -> assertThat(f.acquiredAt()).isNull());
        assertThat(flairs).filteredOn(f -> f.code().equals("ring_galaxy")).singleElement()
                .satisfies(f -> assertThat(f.imageUrl()).isEqualTo(BASE_URL + "/galaxy.webp"));
        assertThat(flairs).filteredOn(f -> f.code().equals("ring_ember")).singleElement().satisfies(f -> {
            assertThat(f.unlock()).isEqualTo(FlairUnlock.STREAK);
            assertThat(f.streakDays()).isEqualTo(7);
            assertThat(f.priceCoins()).isNull();
            assertThat(f.imageUrl()).isNull();
        });
    }

    @Test
    void evaluateEarned_streakBestZero_grantsNothing() {
        progress.setStreakBest(0);

        assertThat(service.evaluateEarned(1L)).isEmpty();
        verify(userFlairRepository, never()).save(any());
    }

    @Test
    void evaluateEarned_noProgressRow_grantsNothing() {
        when(userProgressRepository.findById(1L)).thenReturn(Optional.empty());

        assertThat(service.evaluateEarned(1L)).isEmpty();
        verify(userFlairRepository, never()).save(any());
    }

    @Test
    void evaluateEarned_streakBestSix_grantsNothing() {
        progress.setStreakBest(6);

        assertThat(service.evaluateEarned(1L)).isEmpty();
        assertThat(owned).isEmpty();
    }

    @Test
    void evaluateEarned_streakBestSeven_grantsEmberAsEarned() {
        progress.setStreakBest(7);

        List<FlairDto> earned = service.evaluateEarned(1L);

        assertThat(earned).extracting(FlairDto::code).containsExactly("ring_ember");
        assertThat(earned.get(0).owned()).isTrue();
        assertThat(earned.get(0).equipped()).isFalse();
        assertThat(earned.get(0).acquiredAt()).isEqualTo(NOW);
        assertThat(owned).singleElement().satisfies(uf -> {
            assertThat(uf.getFlair().getCode()).isEqualTo("ring_ember");
            assertThat(uf.getSource()).isEqualTo(FlairSource.EARNED);
            assertThat(uf.getUser()).isSameAs(user);
        });
    }

    @Test
    void evaluateEarned_thresholds() {
        int[] bests = {6, 7, 29, 30, 99, 100, 365};
        List<List<String>> expected = List.of(
                List.of(),
                List.of("ring_ember"),
                List.of("ring_ember"),
                List.of("ring_ember", "ring_blaze"),
                List.of("ring_ember", "ring_blaze"),
                List.of("ring_ember", "ring_blaze", "ring_inferno"),
                List.of("ring_ember", "ring_blaze", "ring_inferno"));
        for (int i = 0; i < bests.length; i++) {
            owned.clear();
            progress.setStreakBest(bests[i]);

            assertThat(service.evaluateEarned(1L)).extracting(FlairDto::code)
                    .as("streak_best %d", bests[i])
                    .containsExactlyElementsOf(expected.get(i));
        }
    }

    @Test
    void evaluateEarned_usesBestStreakNotCurrent() {
        progress.setStreakCurrent(0);
        progress.setStreakBest(120);

        assertThat(service.evaluateEarned(1L)).extracting(FlairDto::code)
                .containsExactly("ring_ember", "ring_blaze", "ring_inferno");
    }

    @Test
    void evaluateEarned_calledTwice_isIdempotent() {
        progress.setStreakBest(30);

        assertThat(service.evaluateEarned(1L)).hasSize(2);
        assertThat(service.evaluateEarned(1L)).isEmpty();
        assertThat(ownedCodes()).containsExactly("ring_ember", "ring_blaze");
    }

    @Test
    void evaluateEarned_alreadyOwnsLowerTier_grantsOnlyMissing() {
        own("ring_ember", FlairSource.EARNED);
        progress.setStreakBest(100);

        assertThat(service.evaluateEarned(1L)).extracting(FlairDto::code)
                .containsExactly("ring_blaze", "ring_inferno");
        assertThat(ownedCodes()).containsExactly("ring_ember", "ring_blaze", "ring_inferno");
    }

    @Test
    void evaluateEarned_neverGrantsShopOrChestFlairs() {
        progress.setStreakBest(10_000);

        service.evaluateEarned(1L);

        assertThat(owned).allSatisfy(uf -> assertThat(uf.getFlair().getUnlock()).isEqualTo(FlairUnlock.STREAK));
    }

    @Test
    void evaluateEarned_inactiveStreakFlair_isNotGranted() {
        catalog.get("ring_blaze").setActive(false);
        progress.setStreakBest(30);

        assertThat(service.evaluateEarned(1L)).extracting(FlairDto::code).containsExactly("ring_ember");
    }

    @Test
    void unownedLootable_excludesOwnedAndStreakFlairsInSortOrder() {
        own("ring_ocean", FlairSource.PURCHASED);
        own("ring_prism", FlairSource.CHEST);

        assertThat(service.unownedLootable(1L)).extracting(Flair::getCode)
                .containsExactly("ring_mint", "ring_sunset", "ring_gold", "ring_neon", "ring_aurora", "ring_galaxy");
    }
}
