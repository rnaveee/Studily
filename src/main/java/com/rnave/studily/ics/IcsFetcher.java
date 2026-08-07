package com.rnave.studily.ics;

import com.rnave.studily.config.BadRequestException;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;

@Component
public class IcsFetcher {

    private static final int MAX_BYTES = 4 * 1024 * 1024;
    private static final int MAX_REDIRECTS = 3;
    private static final Duration TIMEOUT = Duration.ofSeconds(8);

    private final HttpClient client = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NEVER)
            .connectTimeout(TIMEOUT)
            .build();

    public String fetch(String rawUrl) {
        URI uri = normalise(rawUrl);

        for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
            requirePublicHost(uri);
            HttpResponse<InputStream> response = send(uri);
            int status = response.statusCode();

            if (status >= 300 && status < 400) {
                String location = response.headers().firstValue("location")
                        .orElseThrow(() -> new BadRequestException("That link redirected somewhere we could not follow"));
                uri = normalise(uri.resolve(location).toString());
                continue;
            }
            if (status != 200) {
                throw new BadRequestException("That link returned HTTP " + status);
            }
            return read(response);
        }
        throw new BadRequestException("That link redirected too many times");
    }

    private HttpResponse<InputStream> send(URI uri) {
        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(TIMEOUT)
                .header("Accept", "text/calendar, text/plain;q=0.8, */*;q=0.5")
                .header("User-Agent", "Studily/1.0 (+https://studily.ca)")
                .GET()
                .build();
        try {
            return client.send(request, HttpResponse.BodyHandlers.ofInputStream());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BadRequestException("Could not reach that link");
        } catch (Exception e) {
            throw new BadRequestException("Could not reach that link");
        }
    }

    private String read(HttpResponse<InputStream> response) {
        try (InputStream in = response.body()) {
            byte[] bytes = in.readNBytes(MAX_BYTES);
            if (bytes.length >= MAX_BYTES) {
                throw new BadRequestException("That calendar is too large to import");
            }
            return new String(bytes, StandardCharsets.UTF_8);
        } catch (BadRequestException e) {
            throw e;
        } catch (Exception e) {
            throw new BadRequestException("Could not read that calendar");
        }
    }

    private URI normalise(String rawUrl) {
        String trimmed = rawUrl.trim();
        if (trimmed.toLowerCase(Locale.ROOT).startsWith("webcal://")) {
            trimmed = "https://" + trimmed.substring("webcal://".length());
        }
        URI uri;
        try {
            uri = URI.create(trimmed);
        } catch (RuntimeException e) {
            throw new BadRequestException("That does not look like a valid link");
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!scheme.equals("http") && !scheme.equals("https")) {
            throw new BadRequestException("Only http, https and webcal links can be imported");
        }
        if (uri.getHost() == null) {
            throw new BadRequestException("That does not look like a valid link");
        }
        return uri;
    }

    private void requirePublicHost(URI uri) {
        InetAddress[] addresses;
        try {
            addresses = InetAddress.getAllByName(uri.getHost());
        } catch (UnknownHostException e) {
            throw new BadRequestException("We could not find that host");
        }
        for (InetAddress address : addresses) {
            if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress()
                    || address.isSiteLocalAddress() || address.isMulticastAddress() || isUniqueLocal(address)) {
                throw new BadRequestException("That link points to a private address");
            }
        }
    }

    private boolean isUniqueLocal(InetAddress address) {
        byte[] bytes = address.getAddress();
        return bytes.length == 16 && (bytes[0] & 0xFE) == 0xFC;
    }
}
