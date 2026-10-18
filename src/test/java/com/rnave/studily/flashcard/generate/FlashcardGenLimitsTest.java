package com.rnave.studily.flashcard.generate;

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

class FlashcardGenLimitsTest {

    private CourseParseUsageRepository usage;
    private FlashcardGenLimits limits;

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
        limits = new FlashcardGenLimits(usage, currentUser, zones, 20, 0.75, 8.0);
    }

    private void used(long documents) {
        when(usage.countByUserIdAndFeatureAndSucceededTrueAndCreatedAtGreaterThanEqual(
                eq(7L), eq(AiFeature.FLASHCARDS), any())).thenReturn(documents);
    }

    @Test
    void check_countsDocumentsNotRequests() {
        used(18);

        assertThat(limits.remaining()).isEqualTo(2);
        assertThatNoException().isThrownBy(() -> limits.check(2));
        assertThatThrownBy(() -> limits.check(3))
                .isInstanceOf(TooManyRequestsException.class)
                .hasMessageContaining("2 documents left");
    }

    @Test
    void check_blocksOnceTheMonthlyAllowanceIsUsed() {
        used(20);

        assertThatThrownBy(() -> limits.check(1))
                .isInstanceOf(TooManyRequestsException.class)
                .hasMessageContaining("all 20 documents");
    }

    @Test
    void check_pausesEveryoneWhenTheMonthlyBudgetIsSpent() {
        used(0);
        when(usage.spendSince(any(), eq(AiFeature.FLASHCARDS))).thenReturn(List.of(spend(70_000_000, 2_000_000)));

        assertThat(limits.paused()).isTrue();
        assertThatThrownBy(() -> limits.check(1)).hasMessageContaining("until the 1st");
    }

    private static CourseParseUsageRepository.ModelSpend spend(long in, long out) {
        return new CourseParseUsageRepository.ModelSpend() {
            public String getModel() {
                return "claude-haiku-5-5";
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
