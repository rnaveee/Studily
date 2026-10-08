package com.rnave.studily.progress;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;

public interface XpEventRepository extends JpaRepository<XpEvent, Long> {

    boolean existsByDedupeKey(String key);

    long countByUserIdAndSourceAndCreatedAtAfter(Long userId, XpSource source, Instant after);

    boolean existsByUserIdAndSourceNot(Long userId, XpSource source);

    @Query("""
            select coalesce(sum(e.amount), 0) from XpEvent e
            where e.user.id = :userId and e.source = :source
              and e.createdAt between :from and :to
            """)
    int sumAmountByUserIdAndSourceAndCreatedAtBetween(@Param("userId") Long userId,
                                                      @Param("source") XpSource source,
                                                      @Param("from") Instant from,
                                                      @Param("to") Instant to);
}
