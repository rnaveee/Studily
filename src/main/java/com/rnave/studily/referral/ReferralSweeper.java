package com.rnave.studily.referral;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class ReferralSweeper {

    private static final Logger log = LoggerFactory.getLogger(ReferralSweeper.class);
    private static final int BATCH = 100;

    private final ReferralRepository referralRepository;
    private final ReferralService referralService;

    public ReferralSweeper(ReferralRepository referralRepository, ReferralService referralService) {
        this.referralRepository = referralRepository;
        this.referralService = referralService;
    }

    @Scheduled(fixedDelayString = "${app.referrals.sweep-delay-ms:600000}",
            initialDelayString = "${app.referrals.sweep-initial-delay-ms:180000}")
    public void sweep() {
        long after = 0;
        while (true) {
            List<Referral> batch = referralRepository.findByStatusAndIdGreaterThanOrderByIdAsc(
                    ReferralStatus.PENDING, after, PageRequest.of(0, BATCH));
            if (batch.isEmpty()) {
                return;
            }
            for (Referral referral : batch) {
                after = referral.getId();
                try {
                    referralService.evaluate(referral.getId());
                } catch (RuntimeException e) {
                    log.warn("Referral {} could not be evaluated: {}", referral.getId(), e.getClass().getSimpleName());
                }
            }
        }
    }
}
