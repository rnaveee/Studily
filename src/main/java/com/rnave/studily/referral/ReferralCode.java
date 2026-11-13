package com.rnave.studily.referral;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "referral_codes")
@Getter
@Setter
public class ReferralCode {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(nullable = false, unique = true, length = 16)
    private String code;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
