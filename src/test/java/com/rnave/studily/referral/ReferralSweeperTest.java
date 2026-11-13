package com.rnave.studily.referral;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ReferralSweeperTest {

    @Test
    void sweepEvaluatesEveryPendingReferralOldestFirstAndSurvivesFailures() {
        ReferralRepository repository = mock(ReferralRepository.class);
        ReferralService service = mock(ReferralService.class);
        when(repository.findByStatusAndIdGreaterThanOrderByIdAsc(eq(ReferralStatus.PENDING), eq(0L), any(Pageable.class)))
                .thenReturn(List.of(referral(3L), referral(7L)));
        when(repository.findByStatusAndIdGreaterThanOrderByIdAsc(eq(ReferralStatus.PENDING), eq(7L), any(Pageable.class)))
                .thenReturn(List.of());
        doThrow(new IllegalStateException("boom")).when(service).evaluate(3L);

        new ReferralSweeper(repository, service).sweep();

        verify(service).evaluate(3L);
        verify(service).evaluate(7L);
        verify(repository).findByStatusAndIdGreaterThanOrderByIdAsc(eq(ReferralStatus.PENDING), eq(7L), any(Pageable.class));
        org.mockito.Mockito.verify(service, org.mockito.Mockito.times(2)).evaluate(anyLong());
    }

    private static Referral referral(Long id) {
        Referral referral = new Referral();
        referral.setId(id);
        return referral;
    }
}
