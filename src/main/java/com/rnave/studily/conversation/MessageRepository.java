package com.rnave.studily.conversation;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Optional;

public interface MessageRepository extends JpaRepository<Message, Long> {

    Slice<Message> findByConversationIdAndIdLessThanAndIdGreaterThanOrderByIdDesc(
            Long conversationId, Long beforeId, long afterId, Pageable pageable);

    Optional<Message> findTopByConversationIdAndIdGreaterThanOrderByIdDesc(Long conversationId, long afterId);

    Optional<Message> findTopByConversationIdOrderByIdDesc(Long conversationId);

    boolean existsByConversationIdAndSenderIdNotAndIdGreaterThanAndCreatedAtAfter(
            Long conversationId, Long senderId, long afterId, Instant after);
}
