package com.rnave.studily.conversation;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Optional;

public interface MessageRepository extends JpaRepository<Message, Long> {

    Slice<Message> findByConversationIdOrderByIdDesc(Long conversationId, Pageable pageable);

    Slice<Message> findByConversationIdAndIdLessThanOrderByIdDesc(Long conversationId, Long beforeId, Pageable pageable);

    Optional<Message> findTopByConversationIdOrderByCreatedAtDesc(Long conversationId);

    boolean existsByConversationIdAndSenderIdNotAndCreatedAtAfter(Long conversationId, Long senderId, Instant after);
}
