package com.rnave.studily.flashcard;

import com.rnave.studily.config.SpaPages;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.ResponseBody;

import java.nio.charset.StandardCharsets;
import java.util.Optional;

@Controller
public class SharedSetPageController {

    private final FlashcardSetService flashcardSetService;
    private final SpaPages spaPages;
    private final String baseUrl;

    public SharedSetPageController(FlashcardSetService flashcardSetService,
                                   SpaPages spaPages,
                                   @Value("${app.base-url}") String baseUrl) {
        this.flashcardSetService = flashcardSetService;
        this.spaPages = spaPages;
        this.baseUrl = baseUrl.replaceAll("/+$", "");
    }

    @GetMapping(value = "/sets/{id}", produces = MediaType.TEXT_HTML_VALUE)
    @ResponseBody
    public ResponseEntity<String> page(@PathVariable String id) {
        String html = spaPages.shell().orElse(null);
        if (html == null) {
            return ResponseEntity.notFound().build();
        }
        String body = parseId(id)
                .flatMap(flashcardSetService::publicPreview)
                .map(preview -> SetPageMeta.render(html, preview, baseUrl + "/sets/" + preview.id(),
                        baseUrl + "/api/public/flashcard-sets/" + preview.id() + "/preview.png?v="
                                + SetPreviewImage.version(preview)))
                .orElse(html);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noCache())
                .contentType(new MediaType(MediaType.TEXT_HTML, StandardCharsets.UTF_8))
                .body(body);
    }

    private static Optional<Long> parseId(String id) {
        try {
            return Optional.of(Long.parseLong(id));
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }
}
