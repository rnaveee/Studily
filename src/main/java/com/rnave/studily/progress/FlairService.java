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
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class FlairService {

    static final Set<FlairUnlock> LOOTABLE = EnumSet.of(FlairUnlock.SHOP, FlairUnlock.CHEST);
    private static final Comparator<Flair> DISPLAY_ORDER = Comparator
            .comparingInt(Flair::getSortOrder)
            .thenComparing(Flair::getCode);

    private final FlairRepository flairRepository;
    private final UserFlairRepository userFlairRepository;
    private final UserRepository userRepository;
    private final UserProgressRepository userProgressRepository;
    private final ProgressService progressService;
    private final CurrentUser currentUser;
    private final Flairs flairs;
    private final Clock clock;

    public FlairService(FlairRepository flairRepository, UserFlairRepository userFlairRepository,
                        UserRepository userRepository, UserProgressRepository userProgressRepository,
                        @Lazy ProgressService progressService, CurrentUser currentUser, Flairs flairs,
                        Clock clock) {
        this.flairRepository = flairRepository;
        this.userFlairRepository = userFlairRepository;
        this.userRepository = userRepository;
        this.userProgressRepository = userProgressRepository;
        this.progressService = progressService;
        this.currentUser = currentUser;
        this.flairs = flairs;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<FlairDto> mine() {
        User user = currentUser.entity();
        Map<String, UserFlair> owned = ownedBy(user.getId());
        return activeFlairs().stream()
                .map(f -> toDto(f, owned.get(f.getCode()), f.getCode().equals(user.getEquippedFlairCode())))
                .toList();
    }

    @Transactional
    public FlairPurchaseResult purchase(String code) {
        Long userId = currentUser.id();
        ProgressDeltaBuilder delta = progressService.begin(userId);
        Flair flair = flairRepository.findById(code)
                .filter(Flair::isActive)
                .orElseThrow(() -> new NotFoundException("Flair not found"));
        if (flair.getUnlock() != FlairUnlock.SHOP || flair.getPriceCoins() == null) {
            throw new BadRequestException("This flair can't be bought");
        }
        if (userFlairRepository.existsByUserIdAndFlairCode(userId, code)) {
            throw new ConflictException("You already own this flair");
        }
        int price = flair.getPriceCoins();
        if (delta.progress().getCoins() < price) {
            throw new BadRequestException("Not enough coins");
        }
        progressService.addCoins(delta, -price, CoinReason.PURCHASE, "flair:" + code);
        UserFlair userFlair = grant(userId, flair, FlairSource.PURCHASED);
        return new FlairPurchaseResult(toDto(flair, userFlair, false), delta.progress().getCoins());
    }

    @Transactional
    public EquippedFlairResult equip(String code) {
        User user = currentUser.entity();
        if (code == null) {
            user.setEquippedFlairCode(null);
            userRepository.save(user);
            return new EquippedFlairResult(null);
        }
        UserFlair owned = ownedBy(user.getId()).get(code);
        if (owned == null) {
            throw new BadRequestException("You don't own this flair");
        }
        user.setEquippedFlairCode(code);
        userRepository.save(user);
        return new EquippedFlairResult(toDto(owned.getFlair(), owned, true));
    }

    @Transactional
    public List<FlairDto> evaluateEarned(Long userId) {
        int streakBest = userProgressRepository.findById(userId)
                .map(UserProgress::getStreakBest)
                .orElse(0);
        if (streakBest <= 0) {
            return List.of();
        }
        List<Flair> reached = activeFlairs().stream()
                .filter(f -> f.getUnlock() == FlairUnlock.STREAK && f.getStreakDays() != null
                        && streakBest >= f.getStreakDays())
                .toList();
        if (reached.isEmpty()) {
            return List.of();
        }
        Set<String> owned = ownedBy(userId).keySet();
        List<FlairDto> earned = new ArrayList<>();
        for (Flair flair : reached) {
            if (owned.contains(flair.getCode())) {
                continue;
            }
            UserFlair userFlair = grant(userId, flair, FlairSource.EARNED);
            earned.add(toDto(flair, userFlair, false));
        }
        return earned;
    }

    @Transactional
    public UserFlair grant(Long userId, Flair flair, FlairSource source) {
        UserFlair userFlair = new UserFlair();
        userFlair.setUser(userRepository.getReferenceById(userId));
        userFlair.setFlair(flair);
        userFlair.setSource(source);
        userFlair.setAcquiredAt(clock.instant());
        return userFlairRepository.save(userFlair);
    }

    @Transactional(readOnly = true)
    public List<Flair> unownedLootable(Long userId) {
        Set<String> owned = ownedBy(userId).keySet();
        return activeFlairs().stream()
                .filter(f -> LOOTABLE.contains(f.getUnlock()) && !owned.contains(f.getCode()))
                .toList();
    }

    public FlairDto toDto(Flair flair, UserFlair owned, boolean equipped) {
        return new FlairDto(
                flair.getCode(),
                flair.getTitle(),
                flair.getDescription(),
                flair.getRarity(),
                flair.getUnlock(),
                flair.getPriceCoins(),
                flair.getStreakDays(),
                flairs.imageUrl(flair.getImageKey()),
                owned != null,
                owned != null ? owned.getAcquiredAt() : null,
                equipped);
    }

    private Map<String, UserFlair> ownedBy(Long userId) {
        return userFlairRepository.findByUserId(userId).stream()
                .collect(Collectors.toMap(uf -> uf.getFlair().getCode(), Function.identity()));
    }

    private List<Flair> activeFlairs() {
        return flairRepository.findByActiveTrueOrderBySortOrderAsc().stream()
                .sorted(DISPLAY_ORDER)
                .toList();
    }
}
