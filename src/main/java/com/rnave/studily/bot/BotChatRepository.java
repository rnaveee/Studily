package com.rnave.studily.bot;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BotChatRepository extends JpaRepository<BotChat, Long> {

    Optional<BotChat> findByIdAndUserId(Long id, Long userId);

    List<BotChat> findByUserIdAndModeAndTemporaryFalseOrderByUpdatedAtDesc(Long userId, BotMode mode);

    Optional<BotChat> findFirstByParentChatIdAndUserIdOrderByIdDesc(Long parentChatId, Long userId);
}
