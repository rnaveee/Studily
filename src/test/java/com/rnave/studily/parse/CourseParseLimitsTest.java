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
        when(usage.spendSince(any())).thenReturn(List.of());
        limits = new CourseParseLimits(usage, currentUser, zones, 10, 5.0, "");
    }

    @Test
    void quotaResetAt_countsOnlyImportsAfterTheResetPoint() {
        CurrentUser currentUser = mock(CurrentUser.class);
        when(currentUser.id()).thenReturn(7L);
        when(currentUser.entity()).thenReturn(new User());
        UserTimeZones zones = mock(UserTimeZones.class);
        when(zones.zoneFor(any())).thenReturn(ZoneId.of("UTC"));
        Instant resetAt = Instant.now().minusSeconds(60);
        when(usage.countByUserIdAndCreatedAtGreaterThanEqual(7L, resetAt)).thenReturn(0L);
        when(usage.countByUserIdAndCreatedAtGreaterThanEqual(eq(7L), argThat(
                since -> !since.equals(resetAt)))).thenReturn(10L);

        CourseParseLimits reset = new CourseParseLimits(usage, currentUser, zones, 10, 5.0, resetAt.toString());

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
        when(usage.countByUserIdAndCreatedAtGreaterThanEqual(eq(7L), any())).thenReturn(9L);
        assertThat(limits.remaining()).isEqualTo(1);
        assertThatNoException().isThrownBy(limits::check);

        when(usage.countByUserIdAndCreatedAtGreaterThanEqual(eq(7L), any())).thenReturn(10L);
        assertThat(limits.remaining()).isZero();
        assertThatThrownBy(limits::check)
                .isInstanceOf(TooManyRequestsException.class)
                .hasMessageContaining("10 automatic imports");
    }

    @Test
    void check_pausesEveryoneOnceTodaysSpendReachesTheBudget() {
        when(usage.spendSince(any())).thenReturn(List.of(spend("claude-sonnet-5", 1_000_000, 300_000)));

        assertThat(limits.spentToday()).isEqualTo(5.0);
        assertThat(limits.paused()).isTrue();
        assertThatThrownBy(limits::check)
                .isInstanceOf(TooManyRequestsException.class)
                .hasMessageContaining("paused");
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
