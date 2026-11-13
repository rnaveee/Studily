package com.rnave.studily.referral;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ReferralRepository extends JpaRepository<Referral, Long> {

    Optional<Referral> findByInviteeId(Long inviteeId);

    long countByInviterId(Long inviterId);

    long countByInviterIdAndStatus(Long inviterId, ReferralStatus status);

    List<Referral> findByStatusAndIdGreaterThanOrderByIdAsc(ReferralStatus status, Long afterId, Pageable pageable);

    @Transactional
    @Modifying
    @Query(value = """
            INSERT INTO referrals (inviter_id, invitee_id, status, created_at)
            VALUES (:inviterId, :inviteeId, 'PENDING', :now) ON CONFLICT DO NOTHING
            """, nativeQuery = true)
    int insertPending(@Param("inviterId") Long inviterId, @Param("inviteeId") Long inviteeId,
                      @Param("now") Instant now);

    @Transactional
    @Modifying(flushAutomatically = true)
    @Query("""
            update Referral r set r.status = com.rnave.studily.referral.ReferralStatus.REWARDED, r.rewardedAt = :now
            where r.id = :id and r.status = com.rnave.studily.referral.ReferralStatus.PENDING
            """)
    int claim(@Param("id") Long id, @Param("now") Instant now);

    @Transactional
    @Modifying(flushAutomatically = true)
    @Query("""
            update Referral r set r.status = com.rnave.studily.referral.ReferralStatus.REJECTED, r.reason = :reason
            where r.id = :id and r.status = com.rnave.studily.referral.ReferralStatus.PENDING
            """)
    int reject(@Param("id") Long id, @Param("reason") String reason);
}
