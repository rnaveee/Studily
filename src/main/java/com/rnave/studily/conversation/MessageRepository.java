package com.rnave.studily.conversation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface MessageRepository extends JpaRepository<Message, Long> {

    List<Message> findTop500ByConversationIdOrderByCreatedAtDesc(Long conversationId);

    Optional<Message> findTopByConversationIdOrderByCreatedAtDesc(Long conversationId);

    boolean existsByConversationIdAndSenderIdNotAndCreatedAtAfter(Long conversationId, Long senderId, Instant after);
}
