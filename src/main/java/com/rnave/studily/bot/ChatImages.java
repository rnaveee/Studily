package com.rnave.studily.bot;

import com.rnave.studily.bot.BotDtos.ImageInput;
import com.rnave.studily.bot.PracticeTutor.Photo;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.filebank.FileStorage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Component
public class ChatImages {

    static final int MAX_IMAGES = 4;

    private static final Logger log = LoggerFactory.getLogger(ChatImages.class);

    private final FileStorage storage;
    private final JdbcTemplate jdbc;
    private final long maxBytes;

    public ChatImages(FileStorage storage, JdbcTemplate jdbc,
                      @Value("${app.bot.chat.max-image-bytes}") long maxBytes) {
        this.storage = storage;
        this.jdbc = jdbc;
        this.maxBytes = maxBytes;
    }

    public record Stored(String mimeType, byte[] bytes) {
    }

    public List<Photo> decode(List<ImageInput> inputs) {
        if (inputs == null || inputs.isEmpty()) {
            return List.of();
        }
        if (inputs.size() > MAX_IMAGES) {
            throw new BadRequestException("Attach up to " + MAX_IMAGES + " images to one message.");
        }
        if (!storage.configured()) {
            throw new BadRequestException("Images can't be attached right now.");
        }
        List<Photo> photos = new ArrayList<>(inputs.size());
        for (ImageInput input : inputs) {
            byte[] bytes;
            try {
                bytes = Base64.getDecoder().decode(input == null || input.data() == null ? "" : input.data());
            } catch (IllegalArgumentException e) {
                throw new BadRequestException("That image couldn't be read. Try another one.");
            }
            if (bytes.length == 0) {
                throw new BadRequestException("That image couldn't be read. Try another one.");
            }
            if (bytes.length > maxBytes) {
                throw new BadRequestException("That image is too big. Images can be up to "
                        + Math.max(1, maxBytes / (1024 * 1024)) + " MB.");
            }
            String mimeType = PracticeService.photoMime(bytes);
            if (mimeType == null) {
                throw new BadRequestException("Images must be JPEG, PNG or WebP.");
            }
            photos.add(new Photo(mimeType, bytes));
        }
        return photos;
    }

    public List<String> newIds(int count) {
        List<String> ids = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            ids.add(UUID.randomUUID().toString());
        }
        return ids;
    }

    public void save(long userId, long messageId, List<String> ids, List<Photo> photos) {
        for (int i = 0; i < photos.size(); i++) {
            Photo photo = photos.get(i);
            String key = "bot-images/" + userId + "/" + ids.get(i);
            jdbc.update("""
                    INSERT INTO bot_message_images (id, message_id, user_id, storage_key, mime_type, size_bytes, position)
                    VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    UUID.fromString(ids.get(i)), messageId, userId, key, photo.mimeType(), photo.bytes().length, i);
            storage.put(key, photo.bytes(), photo.mimeType());
        }
    }

    public List<Photo> load(long messageId) {
        List<Photo> photos = new ArrayList<>();
        List<String[]> rows = jdbc.query(
                "SELECT storage_key, mime_type FROM bot_message_images WHERE message_id = ? ORDER BY position",
                (rs, i) -> new String[]{rs.getString(1), rs.getString(2)}, messageId);
        for (String[] row : rows) {
            try {
                photos.add(new Photo(row[1], storage.get(row[0])));
            } catch (RuntimeException e) {
                log.warn("Could not load chat image {}: {}", row[0], e.getMessage());
            }
        }
        return photos;
    }

    public Stored find(long userId, long chatId, UUID imageId) {
        List<String[]> rows = jdbc.query("""
                SELECT i.storage_key, i.mime_type
                FROM bot_message_images i
                JOIN bot_messages m ON m.id = i.message_id
                JOIN bot_chats c ON c.id = m.chat_id
                WHERE i.id = ? AND c.id = ? AND c.user_id = ? AND i.user_id = ?""",
                (rs, i) -> new String[]{rs.getString(1), rs.getString(2)}, imageId, chatId, userId, userId);
        if (rows.isEmpty()) {
            throw new NotFoundException("Image not found");
        }
        byte[] bytes;
        try {
            bytes = storage.get(rows.getFirst()[0]);
        } catch (RuntimeException e) {
            throw new NotFoundException("Image not found");
        }
        return new Stored(rows.getFirst()[1], bytes);
    }
}
