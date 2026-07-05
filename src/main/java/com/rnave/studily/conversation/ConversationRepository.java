package com.rnave.studily.conversation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    @Query("""
            select c from Conversation c
            where exists (select 1 from ConversationMember m where m.conversation = c and m.user.id = :userId)
            order by c.lastMessageAt desc nulls last, c.createdAt desc
            """)
    List<Conversation> findForUser(@Param("userId") Long userId);

    @Query("""
            select c from Conversation c
            where c.type = :type
              and exists (select 1 from ConversationMember m where m.conversation = c and m.user.id = :userId)
            order by c.lastMessageAt desc nulls last, c.createdAt desc
            """)
    List<Conversation> findForUserByType(@Param("userId") Long userId, @Param("type") ConversationType type);

    @Query("""
            select c from Conversation c
            where c.type = com.rnave.studily.conversation.ConversationType.DIRECT
              and exists (select 1 from ConversationMember m where m.conversation = c and m.user.id = :a)
              and exists (select 1 from ConversationMember m where m.conversation = c and m.user.id = :b)
            """)
    Optional<Conversation> findDirectBetween(@Param("a") Long a, @Param("b") Long b);
}
