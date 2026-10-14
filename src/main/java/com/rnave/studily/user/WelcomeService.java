package com.rnave.studily.user;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.progress.ChestSource;
import com.rnave.studily.progress.ChestTier;
import com.rnave.studily.progress.ProgressDeltaBuilder;
import com.rnave.studily.progress.ProgressDtos.ProgressDelta;
import com.rnave.studily.progress.ProgressService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;

@Service
public class WelcomeService {

    static final String CHEST_REF = "welcome";

    private final CurrentUser currentUser;
    private final ProgressService progressService;
    private final Clock clock;

    public WelcomeService(CurrentUser currentUser, ProgressService progressService, Clock clock) {
        this.currentUser = currentUser;
        this.progressService = progressService;
        this.clock = clock;
    }

    @Transactional
    public ProgressDelta finish() {
        User user = currentUser.entity();
        ProgressDeltaBuilder delta = progressService.begin(user.getId());
        if (user.getWelcomedAt() == null) {
            user.setWelcomedAt(clock.instant());
        }
        progressService.grantChest(delta, ChestSource.WELCOME, CHEST_REF, null, ChestTier.DIAMOND);
        return progressService.finish(delta);
    }
}
