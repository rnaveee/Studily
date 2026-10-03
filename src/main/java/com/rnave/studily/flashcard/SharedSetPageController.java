package com.rnave.studily.flashcard;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.ResponseBody;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Optional;

@Controller
public class SharedSetPageController {

    private final FlashcardSetService flashcardSetService;
    private final String baseUrl;
    private volatile String template;

    public SharedSetPageController(FlashcardSetService flashcardSetService,
                                   @Value("${app.base-url}") String baseUrl) {
        this.flashcardSetService = flashcardSetService;
        this.baseUrl = baseUrl.replaceAll("/+$", "");
    }

    @GetMapping(value = "/sets/{id}", produces = MediaType.TEXT_HTML_VALUE)
    @ResponseBody
    public ResponseEntity<String> page(@PathVariable String id) throws IOException {
        String html = template();
        if (html == null) {
            return ResponseEntity.notFound().build();
        }
        String body = parseId(id)
                .flatMap(flashcardSetService::publicPreview)
                .map(preview -> SetPageMeta.render(html, preview, baseUrl + "/sets/" + id))
                .orElse(html);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noCache())
                .contentType(new MediaType(MediaType.TEXT_HTML, StandardCharsets.UTF_8))
                .body(body);
    }

    private String template() throws IOException {
        String cached = template;
        if (cached != null) return cached;
        ClassPathResource resource = new ClassPathResource("static/index.html");
        if (!resource.exists()) return null;
        try (InputStream in = resource.getInputStream()) {
            cached = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
        template = cached;
        return cached;
    }

    private static Optional<Long> parseId(String id) {
        try {
            return Optional.of(Long.parseLong(id));
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }
}
