package com.rnave.studily.filebank;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface BankFileRepository extends JpaRepository<BankFile, Long> {

    Optional<BankFile> findByIdAndUserId(Long id, Long userId);

    List<BankFile> findByCourseIdAndUserIdOrderByCreatedAtDesc(Long courseId, Long userId);

    List<BankFile> findByChatIdAndUserIdOrderByCreatedAtDesc(Long chatId, Long userId);

    List<BankFile> findByIdInAndUserId(Collection<Long> ids, Long userId);

    Optional<BankFile> findByCourseIdAndSha256(Long courseId, String sha256);

    Optional<BankFile> findByChatIdAndSha256(Long chatId, String sha256);

    long countByUserId(Long userId);

    @Query("select coalesce(sum(f.sizeBytes), 0) from BankFile f where f.userId = :userId")
    long totalBytes(@Param("userId") Long userId);
}
