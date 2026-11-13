package com.rnave.studily.donation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface DonationRepository extends JpaRepository<Donation, UUID> {

    Optional<Donation> findByIdAndUserId(UUID id, Long userId);

    Optional<Donation> findByStripeSessionId(String stripeSessionId);

    @Query("select d from Donation d where d.userId = :userId "
            + "and d.status = com.rnave.studily.donation.DonationStatus.PENDING "
            + "and d.amountCents = :amountCents and d.createdAt > :since and d.checkoutUrl is not null "
            + "order by d.createdAt desc limit 1")
    Optional<Donation> findOpenCheckout(@Param("userId") Long userId, @Param("amountCents") int amountCents,
                                        @Param("since") Instant since);

    long countByUserIdAndCreatedAtAfter(Long userId, Instant since);

    boolean existsByStripePaymentIntent(String stripePaymentIntent);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "UPDATE donations SET status = 'PAID', paid_at = :now, stripe_payment_intent = :paymentIntent "
            + "WHERE id = :id AND status IN ('PENDING', 'EXPIRED')", nativeQuery = true)
    int markPaid(@Param("id") UUID id, @Param("now") Instant now, @Param("paymentIntent") String paymentIntent);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "UPDATE donations SET status = 'EXPIRED' WHERE id = :id AND status = 'PENDING'", nativeQuery = true)
    int markExpired(@Param("id") UUID id);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "UPDATE donations SET status = 'REFUNDED' WHERE stripe_payment_intent = :paymentIntent "
            + "AND status IN ('PAID', 'DISPUTED')", nativeQuery = true)
    int markRefunded(@Param("paymentIntent") String paymentIntent);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "UPDATE donations SET status = 'DISPUTED' WHERE stripe_payment_intent = :paymentIntent "
            + "AND status = 'PAID'", nativeQuery = true)
    int markDisputed(@Param("paymentIntent") String paymentIntent);
}
