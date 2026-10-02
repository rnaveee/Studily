package com.rnave.studily.config;

import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Arrays;
import java.util.Locale;

@Component
public class PublicUrlFetcher {

    private static final int MAX_REDIRECTS = 3;
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(8);
    private static final String USER_AGENT = "Mozilla/5.0 (compatible; Studily/1.0; +https://studily.ca)";

    private final HttpClient client = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NEVER)
            .connectTimeout(CONNECT_TIMEOUT)
            .build();

    public record Response(URI uri, String contentType, byte[] body, boolean truncated) {
    }

    public Response get(URI start, String accept, int maxBytes, Duration timeout) {
        URI uri = requireHttp(start);

        for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
            requirePublicHost(uri);
            HttpResponse<InputStream> response = send(uri, accept, timeout);
            int status = response.statusCode();

            if (status >= 300 && status < 400) {
                close(response);
                String location = response.headers().firstValue("location")
                        .orElseThrow(() -> new BadRequestException("That link redirected somewhere we could not follow"));
                uri = requireHttp(resolve(uri, location));
                continue;
            }
            if (status != 200) {
                close(response);
                throw new BadRequestException("That link returned HTTP " + status);
            }
            String contentType = response.headers().firstValue("content-type").orElse("");
            return read(uri, contentType, response, maxBytes);
        }
        throw new BadRequestException("That link redirected too many times");
    }

    public static URI parse(String rawUrl) {
        URI uri;
        try {
            uri = URI.create(rawUrl.trim());
        } catch (RuntimeException e) {
            throw new BadRequestException("That does not look like a valid link");
        }
        if (uri.getHost() == null) {
            throw new BadRequestException("That does not look like a valid link");
        }
        return uri;
    }

    private URI resolve(URI base, String location) {
        try {
            return base.resolve(location.trim());
        } catch (RuntimeException e) {
            throw new BadRequestException("That link redirected somewhere we could not follow");
        }
    }

    private URI requireHttp(URI uri) {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!scheme.equals("http") && !scheme.equals("https")) {
            throw new BadRequestException("Only http and https links are supported");
        }
        if (uri.getHost() == null) {
            throw new BadRequestException("That does not look like a valid link");
        }
        return uri;
    }

    private HttpResponse<InputStream> send(URI uri, String accept, Duration timeout) {
        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(timeout)
                .header("Accept", accept)
                .header("User-Agent", USER_AGENT)
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

    private Response read(URI uri, String contentType, HttpResponse<InputStream> response, int maxBytes) {
        try (InputStream in = response.body()) {
            byte[] bytes = in.readNBytes(maxBytes + 1);
            boolean truncated = bytes.length > maxBytes;
            return new Response(uri, contentType, truncated ? Arrays.copyOf(bytes, maxBytes) : bytes, truncated);
        } catch (Exception e) {
            throw new BadRequestException("Could not read that link");
        }
    }

    private void close(HttpResponse<InputStream> response) {
        try {
            response.body().close();
        } catch (Exception ignored) {
        }
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
                    || address.isSiteLocalAddress() || address.isMulticastAddress() || isUniqueLocal(address)
                    || isCarrierGradeNat(address)) {
                throw new BadRequestException("That link points to a private address");
            }
        }
    }

    private boolean isUniqueLocal(InetAddress address) {
        byte[] bytes = address.getAddress();
        return bytes.length == 16 && (bytes[0] & 0xFE) == 0xFC;
    }

    private boolean isCarrierGradeNat(InetAddress address) {
        if (!(address instanceof Inet4Address)) return false;
        byte[] bytes = address.getAddress();
        return (bytes[0] & 0xFF) == 100 && (bytes[1] & 0xC0) == 64;
    }
}
