package com.rnave.studily.linkpreview;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.PublicUrlFetcher;
import com.rnave.studily.config.WebpSize;
import net.coobird.thumbnailator.Thumbnails;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.Collections;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class LinkPreviewService {

    private static final int URL_MAX = 2048;
    private static final int HTML_MAX_BYTES = 1024 * 1024;
    private static final int IMAGE_MAX_BYTES = 3 * 1024 * 1024;
    private static final int OEMBED_MAX_BYTES = 64 * 1024;
    private static final int WEBP_PASSTHROUGH_BYTES = 150 * 1024;
    private static final long IMAGE_MAX_PIXELS = 40_000_000L;
    private static final int IMAGE_MIN_SIDE = 48;
    private static final int THUMB_SIDE = 480;
    private static final Duration TIMEOUT = Duration.ofSeconds(5);
    private static final long TTL_MS = Duration.ofHours(24).toMillis();
    private static final long MISS_TTL_MS = Duration.ofMinutes(30).toMillis();
    private static final int CACHE_SIZE = 500;
    private static final Pattern CHARSET = Pattern.compile("charset=\"?([\\w.:-]+)", Pattern.CASE_INSENSITIVE);
    private static final String USER_AGENT =
            "Mozilla/5.0 (compatible; Studily/1.0; +https://studily.ca) facebookexternalhit/1.1 Twitterbot/1.0";
    private static final String IMAGE_ACCEPT = "image/jpeg, image/png;q=0.9, image/gif;q=0.8, image/webp;q=0.5";
    private static final Set<String> YOUTUBE_HOSTS =
            Set.of("youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be");
    private static final Map<String, String> OEMBED_ENDPOINTS = Map.of(
            "tiktok.com", "https://www.tiktok.com/oembed?url=",
            "open.spotify.com", "https://open.spotify.com/oembed?url=",
            "vimeo.com", "https://vimeo.com/api/oembed.json?url=");

    private record Cached(LinkPreviewDto preview, long expiresAt) {
    }

    private final PublicUrlFetcher fetcher;
    private final ObjectMapper objectMapper;
    private final Map<String, Cached> cache = Collections.synchronizedMap(
            new LinkedHashMap<>(64, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, Cached> eldest) {
                    return size() > CACHE_SIZE;
                }
            });

    public LinkPreviewService(PublicUrlFetcher fetcher, ObjectMapper objectMapper) {
        this.fetcher = fetcher;
        this.objectMapper = objectMapper;
    }

    public Optional<LinkPreviewDto> preview(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank() || rawUrl.length() > URL_MAX) {
            throw new BadRequestException("That does not look like a valid link");
        }
        URI uri = PublicUrlFetcher.parse(rawUrl);
        String key = uri.toString();
        long now = System.currentTimeMillis();

        Cached hit = cache.get(key);
        if (hit != null && hit.expiresAt() > now) {
            return Optional.ofNullable(hit.preview());
        }

        LinkPreviewDto preview;
        try {
            preview = build(uri);
        } catch (RuntimeException e) {
            preview = null;
        }
        cache.put(key, new Cached(preview, now + (preview == null ? MISS_TTL_MS : TTL_MS)));
        return Optional.ofNullable(preview);
    }

    private LinkPreviewDto build(URI uri) {
        LinkPreviewParser.Meta meta = oembed(uri);
        if (meta == null) {
            meta = page(uri);
        }
        if (meta == null || (meta.title() == null && meta.description() == null)) {
            return null;
        }

        String image = meta.imageUrl() == null ? null : thumbnail(meta.imageUrl());
        return new LinkPreviewDto(uri.toString(), meta.siteName(), meta.title(), meta.description(), image);
    }

    static String oembedEndpoint(URI uri) {
        String host = LinkPreviewParser.host(uri);
        if (host == null) return null;
        host = host.toLowerCase(Locale.ROOT);
        if (YOUTUBE_HOSTS.contains(host)) return "https://www.youtube.com/oembed?format=json&url=";
        String bare = host.startsWith("m.") ? host.substring(2) : host;
        return OEMBED_ENDPOINTS.get(bare);
    }

    private LinkPreviewParser.Meta oembed(URI uri) {
        String endpoint = oembedEndpoint(uri);
        if (endpoint == null) return null;
        try {
            URI api = URI.create(endpoint + URLEncoder.encode(uri.toString(), StandardCharsets.UTF_8));
            PublicUrlFetcher.Response response =
                    fetcher.get(api, "application/json", OEMBED_MAX_BYTES, TIMEOUT, USER_AGENT);
            if (response.truncated()) return null;
            LinkPreviewParser.Meta meta = LinkPreviewParser.parseOembed(objectMapper.readTree(response.body()), uri);
            return meta.title() == null ? null : meta;
        } catch (RuntimeException e) {
            return null;
        }
    }

    private LinkPreviewParser.Meta page(URI uri) {
        PublicUrlFetcher.Response page = fetcher.get(
                uri, "text/html, application/xhtml+xml;q=0.9, */*;q=0.1", HTML_MAX_BYTES, TIMEOUT, USER_AGENT);
        String contentType = page.contentType().toLowerCase(Locale.ROOT);
        if (!contentType.contains("html")) {
            return null;
        }

        Document doc;
        try {
            doc = Jsoup.parse(new ByteArrayInputStream(page.body()), charset(contentType), page.uri().toString());
        } catch (IOException e) {
            return null;
        }
        LinkPreviewParser.Meta meta = LinkPreviewParser.parse(doc, page.uri());
        return meta.social() || meta.description() != null ? meta : null;
    }

    private String charset(String contentType) {
        Matcher m = CHARSET.matcher(contentType);
        if (!m.find()) return null;
        try {
            return Charset.forName(m.group(1)).name();
        } catch (RuntimeException e) {
            return null;
        }
    }

    private String thumbnail(String imageUrl) {
        try {
            PublicUrlFetcher.Response response = fetcher.get(
                    URI.create(imageUrl), IMAGE_ACCEPT, IMAGE_MAX_BYTES, TIMEOUT, USER_AGENT);
            String type = response.contentType().toLowerCase(Locale.ROOT);
            if (response.truncated() || type.contains("svg") || type.contains("html")) {
                return null;
            }
            byte[] bytes = response.body();
            int[] webp = WebpSize.of(bytes);
            if (webp != null) {
                if (bytes.length > WEBP_PASSTHROUGH_BYTES || Math.min(webp[0], webp[1]) < IMAGE_MIN_SIDE) {
                    return null;
                }
                return "data:image/webp;base64," + Base64.getEncoder().encodeToString(bytes);
            }
            int[] size = dimensions(bytes);
            if (size == null || (long) size[0] * size[1] > IMAGE_MAX_PIXELS
                    || Math.min(size[0], size[1]) < IMAGE_MIN_SIDE) {
                return null;
            }

            BufferedImage image = ImageIO.read(new ByteArrayInputStream(bytes));
            if (image == null) return null;
            if (Math.max(image.getWidth(), image.getHeight()) > THUMB_SIDE) {
                image = Thumbnails.of(image).size(THUMB_SIDE, THUMB_SIDE).keepAspectRatio(true).asBufferedImage();
            }
            BufferedImage rgb = new BufferedImage(image.getWidth(), image.getHeight(), BufferedImage.TYPE_INT_RGB);
            var g = rgb.createGraphics();
            g.drawImage(image, 0, 0, Color.WHITE, null);
            g.dispose();

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            if (!ImageIO.write(rgb, "jpg", out)) return null;
            return "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(out.toByteArray());
        } catch (IOException | RuntimeException e) {
            return null;
        }
    }

    private int[] dimensions(byte[] bytes) {
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            if (in == null) return null;
            Iterator<ImageReader> readers = ImageIO.getImageReaders(in);
            if (!readers.hasNext()) return null;
            ImageReader reader = readers.next();
            try {
                reader.setInput(in);
                return new int[] {reader.getWidth(0), reader.getHeight(0)};
            } finally {
                reader.dispose();
            }
        } catch (IOException | RuntimeException e) {
            return null;
        }
    }
}
