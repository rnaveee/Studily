package com.rnave.studily.conversation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface MessageLikeRepository extends JpaRepository<MessageLike, Long> {

    Optional<MessageLike> findByMessageIdAndUserId(Long messageId, Long userId);

    @Query("select l.message.id as messageId, l.user.id as userId from MessageLike l "
            + "where l.message.id in :messageIds")
    List<LikeRow> findRowsByMessageIds(Collection<Long> messageIds);

    @Query("select l.user.id from MessageLike l where l.message.id = :messageId")
    List<Long> findUserIdsByMessageId(Long messageId);

    interface LikeRow {
        Long getMessageId();

        Long getUserId();
    }
}
