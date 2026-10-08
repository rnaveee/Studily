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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;

@Service
public class BadgeService {

    static final int MAX_FEATURED = 3;
    private static final Comparator<Badge> DISPLAY_ORDER = Comparator
            .comparing((Badge b) -> b.getCategory().ordinal())
            .thenComparingInt(Badge::getSortOrder)
            .thenComparing(Badge::getCode);

    private final BadgeRepository badgeRepository;
    private final UserBadgeRepository userBadgeRepository;
    private final UserRepository userRepository;
    private final UserProgressRepository userProgressRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final StudySessionRepository studySessionRepository;
    private final FlashcardRunRepository flashcardRunRepository;
    private final ProgressService progressService;
    private final CurrentUser currentUser;
    private final Clock clock;
    private final String badgeBaseUrl;
    private final Instant ogCutoff;

    public BadgeService(BadgeRepository badgeRepository, UserBadgeRepository userBadgeRepository,
                        UserRepository userRepository, UserProgressRepository userProgressRepository,
                        FriendRequestRepository friendRequestRepository,
                        StudySessionRepository studySessionRepository,
                        FlashcardRunRepository flashcardRunRepository,
                        @Lazy ProgressService progressService, CurrentUser currentUser, Clock clock,
                        @Value("${app.progress.badge-base-url}") String badgeBaseUrl,
                        @Value("${app.progress.og-cutoff}") String ogCutoff) {
        this.badgeRepository = badgeRepository;
        this.userBadgeRepository = userBadgeRepository;
        this.userRepository = userRepository;
        this.userProgressRepository = userProgressRepository;
        this.friendRequestRepository = friendRequestRepository;
        this.studySessionRepository = studySessionRepository;
        this.flashcardRunRepository = flashcardRunRepository;
        this.progressService = progressService;
        this.currentUser = currentUser;
        this.clock = clock;
        this.badgeBaseUrl = badgeBaseUrl.endsWith("/")
                ? badgeBaseUrl.substring(0, badgeBaseUrl.length() - 1) : badgeBaseUrl;
        this.ogCutoff = LocalDate.parse(ogCutoff.trim()).atStartOfDay(ZoneOffset.UTC).toInstant();
    }

    @Transactional
    public List<BadgeDto> evaluate(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        Set<String> owned = userBadgeRepository.findByUserId(userId).stream()
                .map(ub -> ub.getBadge().getCode())
                .collect(Collectors.toSet());
        UserProgress progress = userProgressRepository.findById(userId).orElse(null);
        Stats stats = new Stats(user, progress);
        Instant now = clock.instant();
        List<BadgeDto> earned = new ArrayList<>();
        for (Badge badge : activeBadges()) {
            if (badge.getCategory() == BadgeCategory.COSMETIC || owned.contains(badge.getCode())) {
                continue;
            }
            if (!BadgeRules.earned(badge.getCode(), stats)) {
                continue;
            }
            UserBadge userBadge = new UserBadge();
            userBadge.setUser(user);
            userBadge.setBadge(badge);
            userBadge.setSource(BadgeSource.EARNED);
            userBadge.setAcquiredAt(now);
            userBadgeRepository.save(userBadge);
            earned.add(toDto(badge, userBadge));
        }
        return earned;
    }

    @Transactional(readOnly = true)
    public List<BadgeDto> mine() {
        return listFor(currentUser.id());
    }

    @Transactional(readOnly = true)
    public List<BadgeDto> forUser(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new NotFoundException("User not found");
        }
        return listFor(userId);
    }

    @Transactional(readOnly = true)
    public BadgeSummary summary(Long userId) {
        List<UserBadge> owned = userBadgeRepository.findByUserId(userId);
        long activeNonCosmetic = activeBadges().stream()
                .filter(b -> b.getCategory() != BadgeCategory.COSMETIC)
                .count();
        long ownedCosmetic = owned.stream()
                .filter(ub -> ub.getBadge().getCategory() == BadgeCategory.COSMETIC)
                .count();
        long ownedCounted = owned.stream()
                .filter(ub -> ub.getBadge().isActive() || ub.getBadge().getCategory() == BadgeCategory.COSMETIC)
                .count();
        List<BadgeDto> featured = owned.stream()
                .filter(ub -> ub.getFeaturedSlot() != null)
                .sorted(Comparator.comparing(UserBadge::getFeaturedSlot))
                .map(ub -> toDto(ub.getBadge(), ub))
                .toList();
        return new BadgeSummary(featured, (int) ownedCounted, (int) (activeNonCosmetic + ownedCosmetic));
    }

    @Transactional
    public List<BadgeDto> setFeatured(List<String> codes) {
        Long userId = currentUser.id();
        List<String> requested = codes == null ? List.of() : codes;
        if (requested.size() > MAX_FEATURED) {
            throw new BadRequestException("You can feature up to 3 badges");
        }
        if (new HashSet<>(requested).size() != requested.size()) {
            throw new BadRequestException("Each badge can only be featured once");
        }
        progressService.ensure(userId);
        Map<String, UserBadge> owned = userBadgeRepository.findByUserId(userId).stream()
                .collect(Collectors.toMap(ub -> ub.getBadge().getCode(), Function.identity()));
        for (String code : requested) {
            if (code == null || !owned.containsKey(code)) {
                throw new BadRequestException("You can only feature badges you own");
            }
        }
        List<UserBadge> cleared = owned.values().stream()
                .filter(ub -> ub.getFeaturedSlot() != null)
                .toList();
        cleared.forEach(ub -> ub.setFeaturedSlot(null));
        userBadgeRepository.saveAllAndFlush(cleared);
        List<UserBadge> featured = new ArrayList<>();
        for (int i = 0; i < requested.size(); i++) {
            UserBadge ub = owned.get(requested.get(i));
            ub.setFeaturedSlot(i + 1);
            featured.add(ub);
        }
        userBadgeRepository.saveAllAndFlush(featured);
        return featured.stream().map(ub -> toDto(ub.getBadge(), ub)).toList();
    }

    @Transactional
    public PurchaseResult purchase(String code) {
        Long userId = currentUser.id();
        ProgressDeltaBuilder delta = progressService.begin(userId);
        Badge badge = badgeRepository.findById(code)
                .filter(Badge::isActive)
                .orElseThrow(() -> new NotFoundException("Badge not found"));
        if (badge.getCategory() != BadgeCategory.COSMETIC || badge.getPriceCoins() == null) {
            throw new BadRequestException("This badge can't be bought");
        }
        if (userBadgeRepository.existsByUserIdAndBadgeCode(userId, code)) {
            throw new ConflictException("You already own this badge");
        }
        int price = badge.getPriceCoins();
        if (delta.progress().getCoins() < price) {
            throw new BadRequestException("Not enough coins");
        }
        progressService.addCoins(delta, -price, CoinReason.PURCHASE, "badge:" + code);
        UserBadge userBadge = grant(userId, badge, BadgeSource.PURCHASED);
        return new PurchaseResult(toDto(badge, userBadge), delta.progress().getCoins());
    }

    @Transactional
    public UserBadge grant(Long userId, Badge badge, BadgeSource source) {
        UserBadge userBadge = new UserBadge();
        userBadge.setUser(userRepository.getReferenceById(userId));
        userBadge.setBadge(badge);
        userBadge.setSource(source);
        userBadge.setAcquiredAt(clock.instant());
        return userBadgeRepository.save(userBadge);
    }

    @Transactional(readOnly = true)
    public List<Badge> unownedCosmetics(Long userId) {
        Set<String> owned = userBadgeRepository.findByUserId(userId).stream()
                .map(ub -> ub.getBadge().getCode())
                .collect(Collectors.toSet());
        return activeBadges().stream()
                .filter(b -> b.getCategory() == BadgeCategory.COSMETIC && !owned.contains(b.getCode()))
                .toList();
    }

    public BadgeDto toDto(Badge badge, UserBadge owned) {
        return new BadgeDto(
                badge.getCode(),
                badge.getCategory(),
                badge.getTitle(),
                badge.getDescription(),
                badgeBaseUrl + "/" + badge.getImageKey(),
                badge.getPriceCoins(),
                owned != null,
                owned != null ? owned.getAcquiredAt() : null,
                owned != null ? owned.getFeaturedSlot() : null);
    }

    private List<BadgeDto> listFor(Long userId) {
        Map<String, UserBadge> owned = userBadgeRepository.findByUserId(userId).stream()
                .collect(Collectors.toMap(ub -> ub.getBadge().getCode(), Function.identity()));
        return activeBadges().stream()
                .map(b -> toDto(b, owned.get(b.getCode())))
                .toList();
    }

    private List<Badge> activeBadges() {
        return badgeRepository.findByActiveTrueOrderByCategoryAscSortOrderAsc().stream()
                .sorted(DISPLAY_ORDER)
                .toList();
    }

    private final class Stats implements BadgeRules.Stats {

        private final User user;
        private final UserProgress progress;
        private final Supplier<Long> friends;
        private final Supplier<Long> schoolmates;
        private final Supplier<Boolean> completedSession;
        private final Supplier<Long> studyMinutes;
        private final Supplier<Long> completedRuns;

        Stats(User user, UserProgress progress) {
            this.user = user;
            this.progress = progress;
            Long userId = user.getId();
            this.friends = memo(() -> friendRequestRepository.countFriendsOf(userId));
            this.schoolmates = memo(() -> user.getSchoolKey() == null ? 0L
                    : friendRequestRepository.countSchoolmateFriendsOf(userId, user.getSchoolKey()));
            this.completedSession = memo(() -> studySessionRepository
                    .existsByUserIdAndStatus(userId, StudySessionStatus.COMPLETED));
            this.studyMinutes = memo(() -> studySessionRepository.sumCreditedMinutesByUserId(userId));
            this.completedRuns = memo(() -> flashcardRunRepository
                    .countByUserIdAndCompletedAtIsNotNullAndCardCountGreaterThanEqual(userId, 5));
        }

        @Override
        public int level() {
            return progress == null ? 1 : progress.getLevel();
        }

        @Override
        public int streakBest() {
            return progress == null ? 0 : progress.getStreakBest();
        }

        @Override
        public long friends() {
            return friends.get();
        }

        @Override
        public long schoolmateFriends() {
            return schoolmates.get();
        }

        @Override
        public Instant joinedAt() {
            return user.getCreatedAt();
        }

        @Override
        public Instant ogCutoff() {
            return ogCutoff;
        }

        @Override
        public Instant now() {
            return clock.instant();
        }

        @Override
        public boolean completedSession() {
            return completedSession.get();
        }

        @Override
        public long studyMinutes() {
            return studyMinutes.get();
        }

        @Override
        public long completedRuns() {
            return completedRuns.get();
        }
    }

    private static <T> Supplier<T> memo(Supplier<T> source) {
        return new Supplier<>() {
            private T value;
            private boolean loaded;

            @Override
            public T get() {
                if (!loaded) {
                    value = source.get();
                    loaded = true;
                }
                return value;
            }
        };
    }
}
