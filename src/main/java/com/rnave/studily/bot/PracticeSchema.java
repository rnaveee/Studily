package com.rnave.studily.bot;

import com.anthropic.models.messages.JsonOutputFormat;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static com.rnave.studily.parse.CourseDraftSchema.array;
import static com.rnave.studily.parse.CourseDraftSchema.object;
import static com.rnave.studily.parse.CourseDraftSchema.wrap;

final class PracticeSchema {

    private PracticeSchema() {
    }

    static JsonOutputFormat problem() {
        return format(problemRoot());
    }

    static JsonOutputFormat grade() {
        return format(gradeRoot());
    }

    static Map<String, Object> problemRoot() {
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("statement", Map.of("type", "string",
                "description", "The problem the student will solve. Self-contained: every given value with its "
                        + "units, and the question. Never the solution or the answer."));
        properties.put("solution", Map.of("type", "string",
                "description", "A complete worked solution: each step with its reasoning and arithmetic, "
                        + "ending with the final answer."));
        properties.put("finalAnswer", Map.of("type", "string",
                "description", "The final answer alone, with its units, such as '4.2 m/s'."));
        properties.put("fromClass", Map.of("type", "boolean",
                "description", "True only when the problem reproduces or closely adapts a real problem from "
                        + "the excerpts."));
        properties.put("sourceIndexes", array(Map.of("type", "integer"),
                "The numbers of the excerpts the problem comes from. Only numbers that appear in the excerpts."));
        return object(properties);
    }

    static Map<String, Object> gradeRoot() {
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("intent", Map.of("type", "string",
                "enum", List.of("ANSWER", "QUESTION"),
                "description", "ANSWER when the student is attempting the problem with a final answer or "
                        + "working. QUESTION when they ask about a concept, a method or for a hint."));
        properties.put("verdict", Map.of("type", "string",
                "enum", List.of("CORRECT", "PARTIAL", "INCORRECT"),
                "description", "How the answer compares with the reference. For a QUESTION, use INCORRECT."));
        properties.put("feedback", Map.of("type", "string",
                "description", "Specific, kind feedback on where the working went wrong. Empty for a QUESTION."));
        properties.put("steps", array(Map.of("type", "string"),
                "One short note per step of the student's working, in order, saying whether it is right and why. "
                        + "Empty when there is no working to check."));
        return object(properties);
    }

    private static JsonOutputFormat format(Map<String, Object> root) {
        return JsonOutputFormat.builder()
                .schema(JsonOutputFormat.Schema.builder()
                        .additionalProperties(wrap(root))
                        .build())
                .build();
    }
}
