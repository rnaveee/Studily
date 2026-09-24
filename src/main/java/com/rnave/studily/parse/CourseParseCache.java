package com.rnave.studily.parse;

import com.rnave.studily.parse.ExtractedInput.ExtractedImage;
import com.rnave.studily.semester.Semester;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HexFormat;
import java.util.Optional;

@Component
public class CourseParseCache {

    private static final Logger log = LoggerFactory.getLogger(CourseParseCache.class);
    static final Duration MAX_AGE = Duration.ofDays(180);

    private static final JsonMapper MAPPER = JsonMapper.builder()
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .build();

    private final CourseParseCacheRepository repository;

    public CourseParseCache(CourseParseCacheRepository repository) {
        this.repository = repository;
    }

    public Optional<CourseDraft> lookup(String key) {
        try {
            Optional<CourseDraft> hit = repository
                    .findByCacheKeyAndCreatedAtAfter(key, Instant.now().minus(MAX_AGE))
                    .map(entry -> MAPPER.readValue(entry.getDraft(), CourseDraft.class));
            hit.ifPresent(draft -> repository.recordHit(key));
            return hit;
        } catch (RuntimeException e) {
            log.warn("Could not read cached course parse: {}", e.getMessage());
            return Optional.empty();
        }
    }

    public void store(String key, CourseDraft draft, String model) {
        try {
            CourseParseCacheEntry entry = new CourseParseCacheEntry();
            entry.setCacheKey(key);
            entry.setDraft(MAPPER.writeValueAsString(draft));
            entry.setModel(model);
            repository.save(entry);
        } catch (RuntimeException e) {
            log.warn("Could not cache course parse: {}", e.getMessage());
        }
    }

    static String key(ExtractedInput input, Semester semester, ZoneId zone) {
        MessageDigest digest = sha256();
        update(digest, "v" + ClaudeCourseParser.PROMPT_VERSION);
        update(digest, zone.getId());
        if (semester != null) {
            update(digest, "semester:" + semester.getTerm() + ":" + semester.getYear()
                    + ":" + semester.getStartDate() + ":" + semester.getEndDate());
        } else {
            update(digest, "year:" + LocalDate.now(zone).getYear());
        }
        update(digest, input.text() == null ? "" : input.text().strip().replaceAll("\\s+", " "));
        for (ExtractedImage image : input.images()) {
            update(digest, image.mediaType());
            digest.update(image.data());
        }
        return HexFormat.of().formatHex(digest.digest());
    }

    @Scheduled(fixedRate = 24 * 60 * 60_000L)
    void evictExpired() {
        int removed = repository.deleteOlderThan(Instant.now().minus(MAX_AGE));
        if (removed > 0) {
            log.info("Removed {} expired course parse cache entries", removed);
        }
    }

    private static void update(MessageDigest digest, String part) {
        byte[] bytes = part.getBytes(StandardCharsets.UTF_8);
        digest.update(Integer.toString(bytes.length).getBytes(StandardCharsets.UTF_8));
        digest.update((byte) ':');
        digest.update(bytes);
    }

    private static MessageDigest sha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
