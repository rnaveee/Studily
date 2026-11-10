package com.rnave.studily.bot;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface BotMessageRepository extends JpaRepository<BotMessage, Long> {

    List<BotMessage> findByChatIdOrderByIdAsc(Long chatId);

    @Query("""
            select count(m) from BotMessage m, BotChat c
            where m.chatId = c.id and c.userId = :userId and c.mode = :mode
              and m.role = com.rnave.studily.bot.BotRole.USER and m.createdAt >= :since""")
    long countUserMessagesSince(@Param("userId") Long userId, @Param("mode") BotMode mode,
                                @Param("since") Instant since);
}
