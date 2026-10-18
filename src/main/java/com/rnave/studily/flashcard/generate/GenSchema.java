package com.rnave.studily.flashcard.generate;

import com.anthropic.models.messages.JsonOutputFormat;

import java.util.LinkedHashMap;
import java.util.Map;

import static com.rnave.studily.parse.CourseDraftSchema.array;
import static com.rnave.studily.parse.CourseDraftSchema.nullable;
import static com.rnave.studily.parse.CourseDraftSchema.object;
import static com.rnave.studily.parse.CourseDraftSchema.wrap;

final class GenSchema {

    private GenSchema() {
    }

    static JsonOutputFormat format() {
        return JsonOutputFormat.builder()
                .schema(JsonOutputFormat.Schema.builder()
                        .additionalProperties(wrap(root()))
                        .build())
                .build();
    }

    private static Map<String, Object> root() {
        Map<String, Object> card = new LinkedHashMap<>();
        card.put("front", Map.of("type", "string",
                "description", "A clear question or term that makes sense on its own."));
        card.put("back", Map.of("type", "string",
                "description", "The short, precise answer, taken from the document."));
        card.put("frontImage", nullable("string",
                "A figure-N reference shown in the document, only when the question depends on that picture."));
        card.put("backImage", nullable("string",
                "A figure-N or page-N reference shown in the document that illustrates the answer, or null."));
        card.put("sourcePage", nullable("integer",
                "Number of the page, slide or section the card comes from."));

        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("title", Map.of("type", "string",
                "description", "A short title for the set, such as the lecture's topic."));
        properties.put("cards", array(object(card), "The flashcards, at most 60."));
        return object(properties);
    }
}
