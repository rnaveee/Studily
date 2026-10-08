package com.rnave.studily.user;

import com.rnave.studily.progress.Flair;
import com.rnave.studily.progress.FlairRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.stream.Collectors;

@Component
public class Flairs {

    static final Duration CATALOG_TTL = Duration.ofMinutes(5);

    private final FlairRepository flairRepository;
    private final Clock clock;
    private final String baseUrl;
    private volatile Catalog catalog;

    public Flairs(FlairRepository flairRepository, Clock clock,
                  @Value("${app.progress.flair-base-url}") String baseUrl) {
        this.flairRepository = flairRepository;
        this.clock = clock;
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    public FlairRef refOf(User u) {
        String code = u.getEquippedFlairCode();
        if (code == null) {
            return null;
        }
        return new FlairRef(code, imageUrl(catalog().imageKeys().get(code)));
    }

    public String imageUrl(String imageKey) {
        return imageKey == null || imageKey.isBlank() ? null : baseUrl + "/" + imageKey;
    }

    private Catalog catalog() {
        Instant now = clock.instant();
        Catalog current = catalog;
        if (current == null || !current.loadedAt().plus(CATALOG_TTL).isAfter(now)) {
            Map<String, String> imageKeys = flairRepository.findAll().stream()
                    .filter(f -> f.getImageKey() != null)
                    .collect(Collectors.toUnmodifiableMap(Flair::getCode, Flair::getImageKey));
            current = new Catalog(imageKeys, now);
            catalog = current;
        }
        return current;
    }

    private record Catalog(Map<String, String> imageKeys, Instant loadedAt) {
    }
}
