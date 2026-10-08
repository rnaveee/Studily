package com.rnave.studily.progress;

import com.rnave.studily.progress.ProgressDtos.BadgeDto;
import com.rnave.studily.progress.ProgressDtos.ChestDto;
import com.rnave.studily.progress.ProgressDtos.FlairDto;
import com.rnave.studily.progress.ProgressDtos.ProgressDelta;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

public class ProgressDeltaBuilder {

    private final UserProgress progress;
    private final int levelBefore;
    private final long xpBefore;
    private final int coinsBefore;
    private final List<BadgeDto> newBadges = new ArrayList<>();
    private final List<FlairDto> newFlairs = new ArrayList<>();
    private final List<ChestDto> chests = new ArrayList<>();

    public ProgressDeltaBuilder(UserProgress progress) {
        this.progress = progress;
        this.levelBefore = progress.getLevel();
        this.xpBefore = progress.getXp();
        this.coinsBefore = progress.getCoins();
    }

    public UserProgress progress() {
        return progress;
    }

    public Long userId() {
        return progress.getUserId();
    }

    public void addBadge(BadgeDto badge) {
        newBadges.add(badge);
    }

    public void addBadges(Collection<BadgeDto> badges) {
        newBadges.addAll(badges);
    }

    public void addFlair(FlairDto flair) {
        newFlairs.add(flair);
    }

    public void addFlairs(Collection<FlairDto> flairs) {
        newFlairs.addAll(flairs);
    }

    public void addChest(ChestDto chest) {
        chests.add(chest);
    }

    public ProgressDelta build() {
        long xp = progress.getXp();
        int level = progress.getLevel();
        return new ProgressDelta(
                (int) (xp - xpBefore),
                levelBefore,
                level,
                xp,
                LevelMath.xpIntoLevel(xp, level),
                LevelMath.xpToNext(level),
                progress.getCoins() - coinsBefore,
                progress.getCoins(),
                List.copyOf(newBadges),
                List.copyOf(newFlairs),
                List.copyOf(chests));
    }
}
