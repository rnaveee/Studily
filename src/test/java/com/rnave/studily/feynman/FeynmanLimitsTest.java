package com.rnave.studily.feynman;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.TooManyRequestsException;
import com.rnave.studily.parse.AiFeature;
import com.rnave.studily.parse.CourseParseUsageRepository;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserTimeZones;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.ZoneId;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class FeynmanLimitsTest {

    private CourseParseUsageRepository usage;
    private FeynmanLimits limits;

    @BeforeEach
    void setUp() {
        usage = mock(CourseParseUsageRepository.class);
        CurrentUser currentUser = mock(CurrentUser.class);
        when(currentUser.id()).thenReturn(7L);
        when(currentUser.entity()).thenReturn(new User());
        UserTimeZones zones = mock(UserTimeZones.class);
        when(zones.zoneFor(any())).thenReturn(ZoneId.of("America/Vancouver"));
        when(zones.fallback()).thenReturn(ZoneId.of("America/Toronto"));
        when(usage.spendSince(any(), any())).thenReturn(List.of());
        limits = new FeynmanLimits(usage, currentUser, zones, 150, 2.0, 15.0);
    }

    private void used(long calls) {
        when(usage.countByUserIdAndFeatureAndSucceededTrueAndCreatedAtGreaterThanEqual(
                eq(7L), eq(AiFeature.FEYNMAN), any())).thenReturn(calls);
    }

    private void spent(long inputTokens) {
        when(usage.spendSince(any(), eq(AiFeature.FEYNMAN))).thenReturn(List.of(spend(inputTokens)));
    }

    @Test
    void check_allowsUntilTheDailyTurnCap() {
        used(149);

        assertThat(limits.remainingToday()).isEqualTo(1);
        assertThatNoException().isThrownBy(limits::check);

        used(150);

        assertThat(limits.remainingToday()).isZero();
        assertThatThrownBy(limits::check)
                .isInstanceOf(TooManyRequestsException.class)
                .hasMessageContaining("150 messages today");
    }

    @Test
    void check_restsForTheDayOnceTheDailyBudgetIsSpent() {
        used(0);
        spent(1_500_000);

        assertThat(limits.paused()).isTrue();
        assertThatThrownBy(limits::check).hasMessageContaining("resting for today");
    }

    @Test
    void check_restsUntilTheFirstOnceTheMonthlyBudgetIsSpent() {
        used(0);
        spent(8_000_000);

        assertThat(limits.paused()).isTrue();
        assertThatThrownBy(limits::check).hasMessageContaining("until the 1st");
    }

    @Test
    void paused_isFalseUnderBothBudgets() {
        used(0);
        spent(500_000);

        assertThat(limits.paused()).isFalse();
    }

    private static CourseParseUsageRepository.ModelSpend spend(long in) {
        return new CourseParseUsageRepository.ModelSpend() {
            public String getModel() {
                return "claude-sonnet-5-5";
            }

            public Long getInputTokens() {
                return in;
            }

            public Long getOutputTokens() {
                return 0L;
            }
        };
    }
}
