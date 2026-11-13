package com.rnave.studily.donation;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "donations")
@Getter
@Setter
public class Donation {

    @Id
    private UUID id;

    @Column(name = "user_id")
    private Long userId;

    @Column(nullable = false)
    private int amountCents;

    @Column(nullable = false, length = 3)
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private DonationStatus status;

    private String stripeSessionId;

    private String stripePaymentIntent;

    @Column(columnDefinition = "text")
    private String checkoutUrl;

    @Column(nullable = false)
    private Instant createdAt;

    private Instant paidAt;
}
