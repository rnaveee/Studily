package com.rnave.studily.conversation;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface MessageRepository extends JpaRepository<Message, Long> {

    @Query("select m from Message m join fetch m.sender where m.id in :ids")
    List<Message> findWithSenderByIdIn(@Param("ids") Collection<Long> ids);

    Slice<Message> findByConversationIdAndIdLessThanAndIdGreaterThanOrderByIdDesc(
            Long conversationId, Long beforeId, long afterId, Pageable pageable);

    Optional<Message> findTopByConversationIdAndIdGreaterThanOrderByIdDesc(Long conversationId, long afterId);

    Optional<Message> findTopByConversationIdOrderByIdDesc(Long conversationId);

    boolean existsByConversationIdAndSenderIdNotAndIdGreaterThanAndCreatedAtAfter(
            Long conversationId, Long senderId, long afterId, Instant after);
}
