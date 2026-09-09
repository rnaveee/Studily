package com.rnave.studily.parse;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.parse.CourseParseDtos.ParseAccuracyDto;
import com.rnave.studily.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CourseParseFeedbackServiceTest {

    private CourseParseUsageRepository usageRepository;
    private CourseParseFeedbackRepository feedbackRepository;
    private CurrentUser currentUser;
    private CourseParseFeedbackService service;

    private User me;

    @BeforeEach
    void setUp() {
        usageRepository = mock(CourseParseUsageRepository.class);
        feedbackRepository = mock(CourseParseFeedbackRepository.class);
        currentUser = mock(CurrentUser.class);
        service = new CourseParseFeedbackService(usageRepository, feedbackRepository, currentUser);

        me = new User();
        me.setId(1L);
        when(currentUser.id()).thenReturn(1L);
        when(currentUser.entity()).thenReturn(me);
    }

    private CourseParseUsage usageOwnedBy(User owner) {
        CourseParseUsage usage = new CourseParseUsage();
        usage.setId(9L);
        usage.setUser(owner);
        return usage;
    }

    @Test
    void ratingStoresTheChoiceAgainstTheParse() {
        when(usageRepository.findById(9L)).thenReturn(Optional.of(usageOwnedBy(me)));
        when(feedbackRepository.existsByParseId(9L)).thenReturn(false);

        service.rate(9L, ParseRating.MINOR_FIXES);

        verify(feedbackRepository).save(any(CourseParseFeedback.class));
    }

    @Test
    void ratingTwiceKeepsTheFirstAnswer() {
        when(usageRepository.findById(9L)).thenReturn(Optional.of(usageOwnedBy(me)));
        when(feedbackRepository.existsByParseId(9L)).thenReturn(true);

        service.rate(9L, ParseRating.ACCURATE);

        verify(feedbackRepository, never()).save(any());
    }

    @Test
    void cannotRateSomeoneElsesParse() {
        User other = new User();
        other.setId(2L);
        when(usageRepository.findById(9L)).thenReturn(Optional.of(usageOwnedBy(other)));

        assertThatThrownBy(() -> service.rate(9L, ParseRating.ACCURATE))
                .isInstanceOf(NotFoundException.class);
        verify(feedbackRepository, never()).save(any());
    }

    @Test
    void accuracyIsWithheldUntilEnoughPeopleHaveAnswered() {
        when(feedbackRepository.countByCreatedAtAfter(any())).thenReturn(5L);

        ParseAccuracyDto accuracy = service.accuracy();

        assertThat(accuracy.successRate()).isNull();
        assertThat(accuracy.sampleSize()).isEqualTo(5);
        verify(feedbackRepository, never()).countByRatingNotAndCreatedAtAfter(any(), any());
    }

    @Test
    void accuracyCountsAnythingShortOfInaccurateAsWorking() {
        when(feedbackRepository.countByCreatedAtAfter(any())).thenReturn(40L);
        when(feedbackRepository.countByRatingNotAndCreatedAtAfter(
                eq(ParseRating.INACCURATE), any(Instant.class))).thenReturn(34L);

        assertThat(service.accuracy().successRate()).isEqualTo(85L);
    }

    @Test
    void accuracyIsCachedUntilANewRatingArrives() {
        when(feedbackRepository.countByCreatedAtAfter(any())).thenReturn(40L);
        when(feedbackRepository.countByRatingNotAndCreatedAtAfter(any(), any())).thenReturn(40L);
        assertThat(service.accuracy().successRate()).isEqualTo(100L);

        when(feedbackRepository.countByCreatedAtAfter(any())).thenReturn(50L);
        when(feedbackRepository.countByRatingNotAndCreatedAtAfter(any(), any())).thenReturn(25L);
        assertThat(service.accuracy().successRate()).isEqualTo(100L);

        when(usageRepository.findById(9L)).thenReturn(Optional.of(usageOwnedBy(me)));
        service.rate(9L, ParseRating.INACCURATE);

        assertThat(service.accuracy().successRate()).isEqualTo(50L);
    }
}
