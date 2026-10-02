package com.rnave.studily.ics;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.PublicUrlFetcher;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;

@Component
public class IcsFetcher {

    private static final int MAX_BYTES = 4 * 1024 * 1024;
    private static final Duration TIMEOUT = Duration.ofSeconds(8);
    private static final String ACCEPT = "text/calendar, text/plain;q=0.8, */*;q=0.5";

    private final PublicUrlFetcher fetcher;

    public IcsFetcher(PublicUrlFetcher fetcher) {
        this.fetcher = fetcher;
    }

    public String fetch(String rawUrl) {
        PublicUrlFetcher.Response response = fetcher.get(normalise(rawUrl), ACCEPT, MAX_BYTES, TIMEOUT);
        if (response.truncated()) {
            throw new BadRequestException("That calendar is too large to import");
        }
        return new String(response.body(), StandardCharsets.UTF_8);
    }

    private URI normalise(String rawUrl) {
        String trimmed = rawUrl.trim();
        if (trimmed.toLowerCase(Locale.ROOT).startsWith("webcal://")) {
            trimmed = "https://" + trimmed.substring("webcal://".length());
        }
        URI uri = PublicUrlFetcher.parse(trimmed);
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!scheme.equals("http") && !scheme.equals("https")) {
            throw new BadRequestException("Only http, https and webcal links can be imported");
        }
        return uri;
    }
}
