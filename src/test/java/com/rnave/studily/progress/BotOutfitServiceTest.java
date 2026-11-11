package com.rnave.studily.progress;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.progress.ProgressDtos.BotOutfitDto;
import com.rnave.studily.progress.ProgressDtos.BotOutfitPurchaseResult;
import com.rnave.studily.user.BotOutfitRef;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import com.rnave.studily.user.UserTimeZones;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

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
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class BotOutfitServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-10T18:00:00Z");

    private BotOutfitRepository outfitRepository;
    private UserBotOutfitRepository userOutfitRepository;
    private UserRepository userRepository;
    private CoinTransactionRepository coinTransactionRepository;
    private BotOutfitService service;

    private final Map<String, BotOutfit> catalog = new LinkedHashMap<>();
    private final List<UserBotOutfit> owned = new ArrayList<>();
    private final List<CoinTransaction> coinTransactions = new ArrayList<>();
    private User user;
    private UserProgress progress;

    @BeforeEach
    void setUp() {
        outfitRepository = mock(BotOutfitRepository.class);
        userOutfitRepository = mock(UserBotOutfitRepository.class);
        userRepository = mock(UserRepository.class);
        UserProgressRepository userProgressRepository = mock(UserProgressRepository.class);
        coinTransactionRepository = mock(CoinTransactionRepository.class);
        CurrentUser currentUser = mock(CurrentUser.class);
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

        ProgressService progressService = new ProgressService(userProgressRepository, mock(XpEventRepository.class),
                coinTransactionRepository, mock(ChestRepository.class), userRepository, mock(BadgeService.class),
                mock(FlairService.class), new UserTimeZones(userRepository, "UTC"), currentUser, clock);
        service = new BotOutfitService(outfitRepository, userOutfitRepository, userRepository, progressService,
                currentUser, clock);

        add("hoodie_classic", BotOutfitSlot.TOP, BotOutfitUnlock.STARTER, null);
        add("hoodie_varsity", BotOutfitSlot.TOP, BotOutfitUnlock.SHOP, 500);
        add("hoodie_aurora", BotOutfitSlot.TOP, BotOutfitUnlock.CHEST, null);
        add("pants_joggers", BotOutfitSlot.BOTTOM, BotOutfitUnlock.STARTER, null);
        add("pants_jeans", BotOutfitSlot.BOTTOM, BotOutfitUnlock.SHOP, 250);

        user = new User();
        user.setId(1L);
        progress = new UserProgress();
        progress.setUserId(1L);

        when(currentUser.id()).thenReturn(1L);
        when(currentUser.entity()).thenReturn(user);
        when(userRepository.getReferenceById(1L)).thenReturn(user);
        when(userProgressRepository.findById(1L)).thenAnswer(inv -> Optional.of(progress));
        when(userProgressRepository.findForUpdate(1L)).thenAnswer(inv -> Optional.of(progress));
        when(outfitRepository.findById(anyString()))
                .thenAnswer(inv -> Optional.ofNullable(catalog.get(inv.<String>getArgument(0))));
        when(outfitRepository.findAll()).thenAnswer(inv -> List.copyOf(catalog.values()));
        when(outfitRepository.findByActiveTrueOrderBySortOrderAsc())
                .thenAnswer(inv -> catalog.values().stream().filter(BotOutfit::isActive).toList());
        when(userOutfitRepository.findByUserId(1L)).thenAnswer(inv -> List.copyOf(owned));
        when(userOutfitRepository.existsByUserIdAndOutfitCode(eq(1L), anyString()))
                .thenAnswer(inv -> owned.stream().anyMatch(o -> o.getOutfit().getCode().equals(inv.getArgument(1))));
        when(userOutfitRepository.save(any(UserBotOutfit.class))).thenAnswer(inv -> {
            owned.add(inv.getArgument(0));
            return inv.getArgument(0);
        });
        when(coinTransactionRepository.save(any(CoinTransaction.class))).thenAnswer(inv -> {
            coinTransactions.add(inv.getArgument(0));
            return inv.getArgument(0);
        });
    }

    private void add(String code, BotOutfitSlot slot, BotOutfitUnlock unlock, Integer price) {
        BotOutfit o = new BotOutfit();
        o.setCode(code);
        o.setTitle(code);
        o.setSlot(slot);
        o.setRarity(FlairRarity.COMMON);
        o.setUnlock(unlock);
        o.setPriceCoins(price);
        o.setSortOrder((catalog.size() + 1) * 10);
        catalog.put(code, o);
    }

    private void own(String code) {
        UserBotOutfit row = new UserBotOutfit();
        row.setUser(user);
        row.setOutfit(catalog.get(code));
        row.setSource(BotOutfitSource.PURCHASED);
        owned.add(row);
    }

    @Test
    void purchase_shopOutfit_deductsCoinsAndGrantsIt() {
        progress.setCoins(600);

        BotOutfitPurchaseResult result = service.purchase("hoodie_varsity");

        assertThat(result.coins()).isEqualTo(100);
        assertThat(result.outfit().owned()).isTrue();
        assertThat(progress.getCoins()).isEqualTo(100);
        assertThat(coinTransactions).singleElement().satisfies(tx -> {
            assertThat(tx.getAmount()).isEqualTo(-500);
            assertThat(tx.getReason()).isEqualTo(CoinReason.PURCHASE);
            assertThat(tx.getRef()).isEqualTo("outfit:hoodie_varsity");
        });
        assertThat(owned).singleElement().satisfies(row -> {
            assertThat(row.getOutfit().getCode()).isEqualTo("hoodie_varsity");
            assertThat(row.getSource()).isEqualTo(BotOutfitSource.PURCHASED);
            assertThat(row.getAcquiredAt()).isEqualTo(NOW);
        });
    }

    @Test
    void purchase_notEnoughCoins_throwsAndChargesNothing() {
        progress.setCoins(499);

        assertThatThrownBy(() -> service.purchase("hoodie_varsity")).isInstanceOf(BadRequestException.class);
        assertThat(coinTransactions).isEmpty();
        assertThat(owned).isEmpty();
    }

    @Test
    void purchase_alreadyOwned_throwsConflict() {
        progress.setCoins(5000);
        own("pants_jeans");

        assertThatThrownBy(() -> service.purchase("pants_jeans")).isInstanceOf(ConflictException.class);
        assertThat(coinTransactions).isEmpty();
    }

    @Test
    void purchase_starterOutfit_throwsConflict() {
        progress.setCoins(5000);

        assertThatThrownBy(() -> service.purchase("hoodie_classic")).isInstanceOf(ConflictException.class);
        assertThat(coinTransactions).isEmpty();
    }

    @Test
    void purchase_chestOnlyOutfit_cannotBeBought() {
        progress.setCoins(99_999);

        assertThatThrownBy(() -> service.purchase("hoodie_aurora")).isInstanceOf(BadRequestException.class);
        assertThat(coinTransactions).isEmpty();
        assertThat(owned).isEmpty();
    }

    @Test
    void purchase_unknownOrInactive_throwsNotFound() {
        progress.setCoins(5000);
        catalog.get("pants_jeans").setActive(false);

        assertThatThrownBy(() -> service.purchase("cape_nope")).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.purchase("pants_jeans")).isInstanceOf(NotFoundException.class);
        assertThat(coinTransactions).isEmpty();
    }

    @Test
    void equip_starterOutfitsAreOwnedWithoutRows() {
        BotOutfitRef ref = service.equip("hoodie_classic", "pants_joggers");

        assertThat(ref).isEqualTo(new BotOutfitRef("hoodie_classic", "pants_joggers"));
        verify(userRepository).updateBotOutfit(1L, "hoodie_classic", "pants_joggers");
    }

    @Test
    void equip_purchasedOutfit_isWorn() {
        own("pants_jeans");

        service.equip("hoodie_classic", "pants_jeans");

        verify(userRepository).updateBotOutfit(1L, "hoodie_classic", "pants_jeans");
    }

    @Test
    void equip_nullOrBlank_takesThePieceOff() {
        BotOutfitRef ref = service.equip(null, " ");

        assertThat(ref).isEqualTo(new BotOutfitRef(null, null));
        verify(userRepository).updateBotOutfit(1L, null, null);
    }

    @Test
    void equip_unownedOutfit_isRejected() {
        assertThatThrownBy(() -> service.equip("hoodie_varsity", null)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.equip(null, "pants_jeans")).isInstanceOf(BadRequestException.class);
        verify(userRepository, never()).updateBotOutfit(anyLong(), any(), any());
    }

    @Test
    void equip_wrongSlot_isRejected() {
        assertThatThrownBy(() -> service.equip("pants_joggers", null)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.equip(null, "hoodie_classic")).isInstanceOf(BadRequestException.class);
        verify(userRepository, never()).updateBotOutfit(anyLong(), any(), any());
    }

    @Test
    void equip_unknownCode_isRejected() {
        assertThatThrownBy(() -> service.equip("cape_nope", null)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void mine_marksStartersAndPurchasesOwnedAndWornPiecesEquipped() {
        own("pants_jeans");
        user.setBotTopCode("hoodie_classic");
        user.setBotBottomCode("pants_jeans");

        List<BotOutfitDto> all = service.mine();

        assertThat(all).extracting(BotOutfitDto::code)
                .containsExactly("hoodie_classic", "hoodie_varsity", "hoodie_aurora", "pants_joggers", "pants_jeans");
        assertThat(all).filteredOn(BotOutfitDto::owned).extracting(BotOutfitDto::code)
                .containsExactly("hoodie_classic", "pants_joggers", "pants_jeans");
        assertThat(all).filteredOn(BotOutfitDto::equipped).extracting(BotOutfitDto::code)
                .containsExactly("hoodie_classic", "pants_jeans");
    }

    @Test
    void unownedChestOutfits_excludesShopStarterAndOwned() {
        assertThat(service.unownedChestOutfits(1L)).extracting(BotOutfit::getCode).containsExactly("hoodie_aurora");

        own("hoodie_aurora");

        assertThat(service.unownedChestOutfits(1L)).isEmpty();
    }
}
