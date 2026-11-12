package com.rnave.studily.feynman;

import com.anthropic.models.messages.JsonOutputFormat;

import java.util.LinkedHashMap;
import java.util.Map;

import static com.rnave.studily.parse.CourseDraftSchema.array;
import static com.rnave.studily.parse.CourseDraftSchema.nullable;
import static com.rnave.studily.parse.CourseDraftSchema.object;
import static com.rnave.studily.parse.CourseDraftSchema.wrap;

final class FeynmanSchema {

    private FeynmanSchema() {
    }

    static JsonOutputFormat plan() {
        return format(planRoot());
    }

    static JsonOutputFormat turn() {
        return format(turnRoot());
    }

    static JsonOutputFormat report() {
        return format(reportRoot());
    }

    private static JsonOutputFormat format(Map<String, Object> root) {
        return JsonOutputFormat.builder()
                .schema(JsonOutputFormat.Schema.builder()
                        .additionalProperties(wrap(root))
                        .build())
                .build();
    }

    private static Map<String, Object> planRoot() {
        Map<String, Object> concept = new LinkedHashMap<>();
        concept.put("name", Map.of("type", "string",
                "description", "A short, unique name for the concept, such as \"Newton's first law\"."));
        concept.put("summary", Map.of("type", "string",
                "description", "What the concept is, in one or two plain sentences from the material."));
        concept.put("keyPoints", array(Map.of("type", "string"),
                "Everything a complete explanation must include, as short points from the material."));
        concept.put("misconceptions", array(Map.of("type", "string"),
                "Mistakes students commonly make about it. Empty when none are likely."));
        concept.put("source", nullable("string", "Where it is in the material, such as \"Slide 4\"."));
        concept.put("document", nullable("integer",
                "The number N from the \"Document N:\" heading of the document that teaches this concept."));
        concept.put("page", nullable("integer",
                "The number of the one page or slide in that document that best shows this concept, from its \"=== Slide N ===\" or \"=== Page N ===\" marker. Null when the document has no such markers."));

        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("topic", Map.of("type", "string",
                "description", "The lecture's topic in a few words, such as \"Newton's laws\"."));
        properties.put("concepts", array(object(concept),
                "The concepts to teach back, in the order the material covers them, at most 15."));
        return object(properties);
    }

    private static Map<String, Object> turnRoot() {
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("assessed", Map.of("type", "boolean",
                "description", "True when the student's last message was an attempt to explain a concept, or they said they didn't know it."));
        properties.put("concept", nullable("string",
                "The name of the concept from the plan that the student just explained or said they didn't know, written exactly as in the plan. Null when assessed is false."));
        properties.put("score", nullable("integer",
                "0 to 100 for how well they explained it in their own words. 0 when they said they didn't know it. Null when assessed is false."));
        properties.put("gaps", array(Map.of("type", "string"),
                "Short notes on what they missed or got wrong. Empty when nothing is missing."));
        properties.put("didNotKnow", Map.of("type", "boolean",
                "description", "True only when the student said they didn't know the concept."));
        properties.put("messages", array(Map.of("type", "string"),
                "Your chat bubbles in order, one to three."));
        properties.put("focusConcept", nullable("string",
                "The plan concept your bubbles are about: the one you're explaining, following up on or asking the student to explain next, written exactly as in the plan."));
        properties.put("lectureComplete", Map.of("type", "boolean",
                "description", "True when every concept in the plan has been assessed and the session is over."));
        return object(properties);
    }

    private static Map<String, Object> reportRoot() {
        Map<String, Object> gap = new LinkedHashMap<>();
        gap.put("concept", Map.of("type", "string", "description", "The concept with the gap."));
        gap.put("detail", Map.of("type", "string",
                "description", "What they missed or got wrong, and the right idea from the material."));

        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("summary", Map.of("type", "string",
                "description", "Two or three sentences to the student on their overall understanding."));
        properties.put("strengths", array(Map.of("type", "string"), "Up to five things they explained well."));
        properties.put("gaps", array(object(gap), "Gaps in their understanding, most important first, up to eight."));
        return object(properties);
    }
}
