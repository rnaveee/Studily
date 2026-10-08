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

    public record LootDto(int coins, int xp, BadgeDto badge) {
    }

    public record ChestDto(Long id, ChestSource source, Instant createdAt, Instant openedAt, LootDto loot) {

        public static ChestDto of(Chest c, BadgeDto lootBadge) {
            LootDto loot = c.getOpenedAt() == null ? null : new LootDto(
                    c.getLootCoins() == null ? 0 : c.getLootCoins(),
                    c.getLootXp() == null ? 0 : c.getLootXp(),
                    lootBadge);
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
            List<ChestDto> chests) {
    }

    public record FeaturedBadgesRequest(List<String> codes) {
    }

    public record PurchaseResult(BadgeDto badge, int coins) {
    }

    public record ChestOpenResult(ChestDto chest, ProgressDelta delta) {
    }

    public record BadgeSummary(List<BadgeDto> featured, int count, int total) {
    }
}
