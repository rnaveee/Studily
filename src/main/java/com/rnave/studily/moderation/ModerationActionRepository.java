package com.rnave.studily.moderation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

public interface ModerationActionRepository extends JpaRepository<ModerationAction, Long> {

    @Query("""
            select a from ModerationAction a
            where a.userId = :userId and a.type in :types and a.revokedAt is null
              and (a.endsAt is null or a.endsAt > :now)
            order by a.createdAt desc""")
    List<ModerationAction> findActive(@Param("userId") Long userId,
                                      @Param("types") Collection<ModerationActionType> types,
                                      @Param("now") Instant now);

    List<ModerationAction> findByUserIdAndTypeAndAcknowledgedAtIsNullAndRevokedAtIsNullOrderByCreatedAtAsc(
            Long userId, ModerationActionType type);

    List<ModerationAction> findByUserIdOrderByCreatedAtDesc(Long userId);

    @Modifying
    @Query("""
            update ModerationAction a set a.acknowledgedAt = :now
            where a.userId = :userId and a.id in :ids and a.type = :type and a.acknowledgedAt is null""")
    int acknowledge(@Param("userId") Long userId,
                    @Param("ids") Collection<Long> ids,
                    @Param("type") ModerationActionType type,
                    @Param("now") Instant now);
}
