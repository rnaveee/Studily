package com.rnave.studily.moderation;

import org.springframework.data.jpa.repository.JpaRepository;

public interface BannedEmailRepository extends JpaRepository<BannedEmail, Long> {

    boolean existsByEmailHash(String emailHash);

    boolean existsByUserId(Long userId);

    void deleteByUserId(Long userId);
}
