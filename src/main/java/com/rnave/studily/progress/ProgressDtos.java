package com.rnave.studily.progress;

import java.time.Instant;
import java.util.List;

public class ProgressDtos {

    public record BadgeDto(
            String code,
            BadgeCategory category,
            String title,
            String description,
            String imageUrl,
            Integer priceCoins,
            boolean owned,
            Instant acquiredAt,
            Integer featuredSlot) {
    }

    public record FlairDto(
            String code,
            String title,
            String description,
            FlairRarity rarity,
            FlairUnlock unlock,
            Integer priceCoins,
            Integer streakDays,
            String imageUrl,
            boolean owned,
            Instant acquiredAt,
            boolean equipped) {
    }

    public record StreakDto(int current, int best, double multiplier) {
    }

    public record ProgressDto(
            int level,
            long xp,
            long xpIntoLevel,
            long xpForNext,
            int coins,
            StreakDto streak,
            List<BadgeDto> featuredBadges,
            int badgeCount,
            int badgeTotal,
            long unopenedChests) {
    }

    public record PublicProgressDto(
            Long userId,
            int level,
            long xp,
            long xpIntoLevel,
            long xpForNext,
            int streakCurrent,
            List<BadgeDto> featuredBadges,
            int badgeCount,
            int badgeTotal) {
    }

    public record LootDto(int coins, int xp, BadgeDto badge, FlairDto flair) {
    }

    public record ChestDto(Long id, ChestSource source, Instant createdAt, Instant openedAt, LootDto loot) {

        public static ChestDto of(Chest c, BadgeDto lootBadge) {
            return of(c, lootBadge, null);
        }

        public static ChestDto of(Chest c, BadgeDto lootBadge, FlairDto lootFlair) {
            LootDto loot = c.getOpenedAt() == null ? null : new LootDto(
                    c.getLootCoins() == null ? 0 : c.getLootCoins(),
                    c.getLootXp() == null ? 0 : c.getLootXp(),
                    lootBadge,
                    lootFlair);
            return new ChestDto(c.getId(), c.getSource(), c.getCreatedAt(), c.getOpenedAt(), loot);
        }
    }

    public record ProgressDelta(
            int xpGained,
            int levelBefore,
            int levelAfter,
            long xp,
            long xpIntoLevel,
            long xpForNext,
            int coinsGained,
            int coins,
            List<BadgeDto> newBadges,
            List<FlairDto> newFlairs,
            List<ChestDto> chests) {
    }

    public record FeaturedBadgesRequest(List<String> codes) {
    }

    public record PurchaseResult(BadgeDto badge, int coins) {
    }

    public record FlairPurchaseResult(FlairDto flair, int coins) {
    }

    public record EquipFlairRequest(String code) {
    }

    public record EquippedFlairResult(FlairDto equipped) {
    }

    public record ChestOpenResult(ChestDto chest, ProgressDelta delta) {
    }

    public record BadgeSummary(List<BadgeDto> featured, int count, int total) {
    }
}
