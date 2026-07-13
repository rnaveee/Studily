package com.rnave.studily.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;

import java.time.Instant;
import java.util.Optional;

public interface AccountTokenRepository extends JpaRepository<AccountToken, Long> {

    Optional<AccountToken> findByTokenHashAndType(String tokenHash, AccountTokenType type);

    @Modifying
    void deleteByUserIdAndType(Long userId, AccountTokenType type);

    @Modifying
    void deleteByExpiresAtBefore(Instant cutoff);
}
