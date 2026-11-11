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
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class BotOutfitService {

    private static final Comparator<BotOutfit> DISPLAY_ORDER = Comparator
            .comparingInt(BotOutfit::getSortOrder)
            .thenComparing(BotOutfit::getCode);

    private final BotOutfitRepository outfitRepository;
    private final UserBotOutfitRepository userOutfitRepository;
    private final UserRepository userRepository;
    private final ProgressService progressService;
    private final CurrentUser currentUser;
    private final Clock clock;

    public BotOutfitService(BotOutfitRepository outfitRepository, UserBotOutfitRepository userOutfitRepository,
                            UserRepository userRepository, @Lazy ProgressService progressService,
                            CurrentUser currentUser, Clock clock) {
        this.outfitRepository = outfitRepository;
        this.userOutfitRepository = userOutfitRepository;
        this.userRepository = userRepository;
        this.progressService = progressService;
        this.currentUser = currentUser;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<BotOutfitDto> mine() {
        User user = currentUser.entity();
        Set<String> owned = purchasedBy(user.getId());
        return outfitRepository.findAll().stream()
                .filter(o -> o.isActive() || owned.contains(o.getCode()))
                .sorted(DISPLAY_ORDER)
                .map(o -> toDto(o, isOwned(o, owned), isWorn(o, user)))
                .toList();
    }

    @Transactional
    public BotOutfitPurchaseResult purchase(String code) {
        Long userId = currentUser.id();
        ProgressDeltaBuilder delta = progressService.begin(userId);
        BotOutfit outfit = outfitRepository.findById(code)
                .filter(BotOutfit::isActive)
                .orElseThrow(() -> new NotFoundException("Outfit not found"));
        if (outfit.getUnlock() == BotOutfitUnlock.STARTER) {
            throw new ConflictException("You already own this outfit");
        }
        if (outfit.getUnlock() != BotOutfitUnlock.SHOP || outfit.getPriceCoins() == null) {
            throw new BadRequestException("This outfit can't be bought");
        }
        if (userOutfitRepository.existsByUserIdAndOutfitCode(userId, code)) {
            throw new ConflictException("You already own this outfit");
        }
        int price = outfit.getPriceCoins();
        if (delta.progress().getCoins() < price) {
            throw new BadRequestException("Not enough coins");
        }
        progressService.addCoins(delta, -price, CoinReason.PURCHASE, "outfit:" + code);
        grant(userId, outfit, BotOutfitSource.PURCHASED);
        return new BotOutfitPurchaseResult(toDto(outfit, true, false), delta.progress().getCoins());
    }

    @Transactional
    public BotOutfitRef equip(String top, String bottom) {
        Long userId = currentUser.id();
        Set<String> owned = purchasedBy(userId);
        String topCode = checkWearable(top, BotOutfitSlot.TOP, owned);
        String bottomCode = checkWearable(bottom, BotOutfitSlot.BOTTOM, owned);
        userRepository.updateBotOutfit(userId, topCode, bottomCode);
        return new BotOutfitRef(topCode, bottomCode);
    }

    @Transactional
    public UserBotOutfit grant(Long userId, BotOutfit outfit, BotOutfitSource source) {
        UserBotOutfit row = new UserBotOutfit();
        row.setUser(userRepository.getReferenceById(userId));
        row.setOutfit(outfit);
        row.setSource(source);
        row.setAcquiredAt(clock.instant());
        return userOutfitRepository.save(row);
    }

    @Transactional(readOnly = true)
    public List<BotOutfit> unownedChestOutfits(Long userId) {
        Set<String> owned = purchasedBy(userId);
        return outfitRepository.findByActiveTrueOrderBySortOrderAsc().stream()
                .filter(o -> o.getUnlock() == BotOutfitUnlock.CHEST && !owned.contains(o.getCode()))
                .sorted(DISPLAY_ORDER)
                .toList();
    }

    public BotOutfitDto toDto(BotOutfit outfit, boolean owned, boolean equipped) {
        return new BotOutfitDto(outfit.getCode(), outfit.getTitle(), outfit.getSlot(), outfit.getRarity(),
                outfit.getUnlock(), outfit.getPriceCoins(), owned, equipped);
    }

    private String checkWearable(String code, BotOutfitSlot slot, Set<String> owned) {
        if (code == null || code.isBlank()) {
            return null;
        }
        BotOutfit outfit = outfitRepository.findById(code)
                .orElseThrow(() -> new BadRequestException("Unknown outfit"));
        if (outfit.getSlot() != slot) {
            throw new BadRequestException("That outfit doesn't go there");
        }
        if (!isOwned(outfit, owned)) {
            throw new BadRequestException("You don't own this outfit");
        }
        return outfit.getCode();
    }

    private static boolean isOwned(BotOutfit outfit, Set<String> purchased) {
        return outfit.getUnlock() == BotOutfitUnlock.STARTER || purchased.contains(outfit.getCode());
    }

    private static boolean isWorn(BotOutfit outfit, User user) {
        return outfit.getCode().equals(user.getBotTopCode()) || outfit.getCode().equals(user.getBotBottomCode());
    }

    private Set<String> purchasedBy(Long userId) {
        return userOutfitRepository.findByUserId(userId).stream()
                .map(row -> row.getOutfit().getCode())
                .collect(Collectors.toSet());
    }
}
