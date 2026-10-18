package com.rnave.studily.parse;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.TooManyRequestsException;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserTimeZones;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CourseParseLimitsTest {

    private CourseParseUsageRepository usage;
    private CourseParseLimits limits;

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
        limits = new CourseParseLimits(usage, currentUser, zones, 10, 5.0, 100.0, "");
    }

    @Test
    void quotaResetAt_countsOnlyImportsAfterTheResetPoint() {
        CurrentUser currentUser = mock(CurrentUser.class);
        when(currentUser.id()).thenReturn(7L);
        when(currentUser.entity()).thenReturn(new User());
        UserTimeZones zones = mock(UserTimeZones.class);
        when(zones.zoneFor(any())).thenReturn(ZoneId.of("UTC"));
        Instant resetAt = Instant.now().minusSeconds(60);
        when(usage.countByUserIdAndFeatureAndSucceededTrueAndCreatedAtGreaterThanEqual(7L, AiFeature.COURSE, resetAt)).thenReturn(0L);
        when(usage.countByUserIdAndFeatureAndSucceededTrueAndCreatedAtGreaterThanEqual(eq(7L), eq(AiFeature.COURSE), argThat(
                since -> !since.equals(resetAt)))).thenReturn(10L);

        CourseParseLimits reset = new CourseParseLimits(usage, currentUser, zones, 10, 5.0, 100.0, resetAt.toString());

        assertThat(reset.remaining()).isEqualTo(10);
    }

    @Test
    void monthStart_isMidnightOnTheFirstInTheUsersZone() {
        ZonedDateTime lateOnTheLastDay = ZonedDateTime.of(2026, 9, 30, 23, 30, 0, 0, ZoneId.of("America/Vancouver"));

        assertThat(CourseParseLimits.monthStart(lateOnTheLastDay))
                .isEqualTo(Instant.parse("2026-09-01T07:00:00Z"));
    }

    @Test
    void check_allowsTheTenthImportAndBlocksTheEleventh() {
        when(usage.countByUserIdAndFeatureAndSucceededTrueAndCreatedAtGreaterThanEqual(eq(7L), eq(AiFeature.COURSE), any())).thenReturn(9L);
        assertThat(limits.remaining()).isEqualTo(1);
        assertThatNoException().isThrownBy(limits::check);

        when(usage.countByUserIdAndFeatureAndSucceededTrueAndCreatedAtGreaterThanEqual(eq(7L), eq(AiFeature.COURSE), any())).thenReturn(10L);
        assertThat(limits.remaining()).isZero();
        assertThatThrownBy(limits::check)
                .isInstanceOf(TooManyRequestsException.class)
                .hasMessageContaining("10 automatic imports");
    }

    @Test
    void check_pausesEveryoneOnceTodaysSpendReachesTheBudget() {
        when(usage.spendSince(any(), eq(AiFeature.COURSE)))
                .thenReturn(List.of(spend("claude-sonnet-5", 1_000_000, 300_000)));

        assertThat(limits.spentToday()).isEqualTo(5.0);
        assertThat(limits.paused()).isTrue();
        assertThatThrownBy(limits::check)
                .isInstanceOf(TooManyRequestsException.class)
                .hasMessageContaining("paused");
    }

    @Test
    void check_pausesUntilTheFirstOnceThisMonthsSpendReachesTheMonthlyBudget() {
        CurrentUser currentUser = mock(CurrentUser.class);
        when(currentUser.id()).thenReturn(7L);
        when(currentUser.entity()).thenReturn(new User());
        UserTimeZones zones = mock(UserTimeZones.class);
        when(zones.zoneFor(any())).thenReturn(ZoneId.of("UTC"));
        when(zones.fallback()).thenReturn(ZoneId.of("UTC"));
        when(usage.spendSince(any(), eq(AiFeature.COURSE)))
                .thenReturn(List.of(spend("claude-sonnet-5", 500_000, 100_000)));
        CourseParseLimits monthly = new CourseParseLimits(usage, currentUser, zones, 10, 50.0, 2.0, "");

        assertThat(monthly.spentThisMonth()).isEqualTo(2.0);
        assertThat(monthly.paused()).isTrue();
        assertThatThrownBy(monthly::check)
                .isInstanceOf(TooManyRequestsException.class)
                .hasMessageContaining("until the 1st");
    }

    @Test
    void spend_onlyCountsCourseUsage() {
        when(usage.spendSince(any(), eq(AiFeature.FLASHCARDS)))
                .thenReturn(List.of(spend("claude-haiku-5-5", 90_000_000, 10_000_000)));

        assertThat(limits.spentToday()).isZero();
        assertThat(limits.paused()).isFalse();
    }

    private static CourseParseUsageRepository.ModelSpend spend(String model, long in, long out) {
        return new CourseParseUsageRepository.ModelSpend() {
            public String getModel() {
                return model;
            }

            public Long getInputTokens() {
                return in;
            }

            public Long getOutputTokens() {
                return out;
            }
        };
    }
}
