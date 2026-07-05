package com.rnave.studily.conversation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ConversationMemberRepository extends JpaRepository<ConversationMember, Long> {

    boolean existsByConversationIdAndUserId(Long conversationId, Long userId);

    Optional<ConversationMember> findByConversationIdAndUserId(Long conversationId, Long userId);
}
