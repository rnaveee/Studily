package com.rnave.studily.user;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.progress.ChestSource;
import com.rnave.studily.progress.ChestTier;
import com.rnave.studily.progress.ProgressDeltaBuilder;
import com.rnave.studily.progress.ProgressService;
import com.rnave.studily.progress.UserProgress;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WelcomeServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-14T18:00:00Z");

    private ProgressService progressService;
    private User user;
    private WelcomeService service;

    @BeforeEach
    void setUp() {
        progressService = mock(ProgressService.class);
        CurrentUser currentUser = mock(CurrentUser.class);
        user = new User();
        user.setId(4L);
        when(currentUser.entity()).thenReturn(user);
        UserProgress progress = new UserProgress();
        progress.setUserId(4L);
        when(progressService.begin(4L)).thenAnswer(inv -> new ProgressDeltaBuilder(progress));
        service = new WelcomeService(currentUser, progressService, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void finish_marksTheUserWelcomedAndGrantsTheDiamondChest() {
        service.finish();

        assertThat(user.getWelcomedAt()).isEqualTo(NOW);
        verify(progressService).grantChest(any(), eq(ChestSource.WELCOME),
                eq("welcome"), isNull(),
                eq(ChestTier.DIAMOND));
    }

    @Test
    void finish_twice_keepsTheFirstWelcomeTime() {
        service.finish();
        Instant first = user.getWelcomedAt();
        service.finish();

        assertThat(user.getWelcomedAt()).isEqualTo(first);
        verify(progressService, times(2)).grantChest(any(), any(), any(), any(), any());
    }
}
