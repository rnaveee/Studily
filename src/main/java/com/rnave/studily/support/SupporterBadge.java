package com.rnave.studily.support;

import com.rnave.studily.progress.Badge;
import com.rnave.studily.progress.BadgeRepository;
import com.rnave.studily.progress.BadgeService;
import com.rnave.studily.progress.BadgeSource;
import com.rnave.studily.progress.ProgressDeltaBuilder;
import com.rnave.studily.progress.UserBadge;
import com.rnave.studily.progress.UserBadgeRepository;
import org.springframework.stereotype.Component;

@Component
public class SupporterBadge {

    public static final String CODE = "supporter";

    private final BadgeRepository badgeRepository;
    private final UserBadgeRepository userBadgeRepository;
    private final BadgeService badgeService;

    public SupporterBadge(BadgeRepository badgeRepository, UserBadgeRepository userBadgeRepository, BadgeService badgeService) {
        this.badgeRepository = badgeRepository;
        this.userBadgeRepository = userBadgeRepository;
        this.badgeService = badgeService;
    }

    public boolean grantIfMissing(Long userId, ProgressDeltaBuilder delta) {
        if (userBadgeRepository.existsByUserIdAndBadgeCode(userId, CODE)) {
            return false;
        }
        Badge badge = badgeRepository.findById(CODE).orElse(null);
        if (badge == null) {
            return false;
        }
        UserBadge owned = badgeService.grant(userId, badge, BadgeSource.EARNED);
        if (delta != null) {
            delta.addBadge(badgeService.toDto(badge, owned));
        }
        return true;
    }
}
