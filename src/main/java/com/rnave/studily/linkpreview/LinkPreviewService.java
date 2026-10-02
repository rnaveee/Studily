package com.rnave.studily.linkpreview;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.PublicUrlFetcher;
import net.coobird.thumbnailator.Thumbnails;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.Charset;
import java.time.Duration;
import java.util.Base64;
import java.util.Collections;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class LinkPreviewService {

    private static final int URL_MAX = 2048;
    private static final int HTML_MAX_BYTES = 1024 * 1024;
    private static final int IMAGE_MAX_BYTES = 3 * 1024 * 1024;
    private static final long IMAGE_MAX_PIXELS = 40_000_000L;
    private static final int IMAGE_MIN_SIDE = 48;
    private static final int THUMB_SIDE = 480;
    private static final Duration TIMEOUT = Duration.ofSeconds(5);
    private static final long TTL_MS = Duration.ofHours(24).toMillis();
    private static final long MISS_TTL_MS = Duration.ofMinutes(30).toMillis();
    private static final int CACHE_SIZE = 500;
    private static final Pattern CHARSET = Pattern.compile("charset=\"?([\\w.:-]+)", Pattern.CASE_INSENSITIVE);

    private record Cached(LinkPreviewDto preview, long expiresAt) {
    }

    private final PublicUrlFetcher fetcher;
    private final Map<String, Cached> cache = Collections.synchronizedMap(
            new LinkedHashMap<>(64, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, Cached> eldest) {
                    return size() > CACHE_SIZE;
                }
            });

    public LinkPreviewService(PublicUrlFetcher fetcher) {
        this.fetcher = fetcher;
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
        PublicUrlFetcher.Response page = fetcher.get(
                uri, "text/html, application/xhtml+xml;q=0.9, */*;q=0.1", HTML_MAX_BYTES, TIMEOUT);
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
        if (meta.title() == null && meta.description() == null) {
            return null;
        }

        String image = meta.imageUrl() == null ? null : thumbnail(meta.imageUrl());
        return new LinkPreviewDto(uri.toString(), meta.siteName(), meta.title(), meta.description(), image);
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
                    URI.create(imageUrl), "image/avif, image/webp, image/*;q=0.9", IMAGE_MAX_BYTES, TIMEOUT);
            String type = response.contentType().toLowerCase(Locale.ROOT);
            if (response.truncated() || type.contains("svg") || type.contains("html")) {
                return null;
            }
            byte[] bytes = response.body();
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
