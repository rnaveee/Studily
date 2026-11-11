package com.rnave.studily.bot;

import com.rnave.studily.bot.BotDtos.BotMeta;
import com.rnave.studily.bot.BotDtos.MessageDto;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.util.List;

@Component
public class BotMessages {

    private final ObjectMapper mapper;

    public BotMessages(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public String write(BotMeta meta) {
        return meta == null ? null : mapper.writeValueAsString(meta);
    }

    public BotMeta read(String meta) {
        if (meta == null || meta.isBlank()) {
            return null;
        }
        return mapper.readValue(meta, BotMeta.class);
    }

    public MessageDto dto(BotMessage message) {
        BotMeta meta = read(message.getMeta());
        return new MessageDto(message.getId(), message.getRole(), message.getKind(), message.getContent(),
                meta == null || meta.citations() == null ? List.of() : meta.citations(),
                meta == null ? null : meta.problem(),
                meta == null ? null : meta.grade(),
                message.getCreatedAt());
    }
}
