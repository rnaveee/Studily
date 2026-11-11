package com.rnave.studily.bot;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PracticeSchemaTest {

    @SuppressWarnings("unchecked")
    private static Map<String, Object> properties(Map<String, Object> root) {
        return (Map<String, Object>) root.get("properties");
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> property(Map<String, Object> root, String name) {
        return (Map<String, Object>) properties(root).get(name);
    }

    @Test
    void problemSchemaAsksForEveryFieldAndNothingElse() {
        Map<String, Object> root = PracticeSchema.problemRoot();

        assertThat(root).containsEntry("type", "object").containsEntry("additionalProperties", false);
        assertThat(properties(root).keySet())
                .containsExactly("statement", "solution", "finalAnswer", "fromClass", "sourceIndexes");
        assertThat(root.get("required")).isEqualTo(List.of("statement", "solution", "finalAnswer", "fromClass",
                "sourceIndexes"));
        assertThat(property(root, "fromClass")).containsEntry("type", "boolean");
        assertThat(property(root, "sourceIndexes")).containsEntry("type", "array");
        assertThat(property(root, "sourceIndexes").get("items")).isEqualTo(Map.of("type", "integer"));
    }

    @Test
    void gradeSchemaLimitsIntentAndVerdictToTheKnownValues() {
        Map<String, Object> root = PracticeSchema.gradeRoot();

        assertThat(root).containsEntry("type", "object").containsEntry("additionalProperties", false);
        assertThat(properties(root).keySet()).containsExactly("intent", "verdict", "feedback", "steps");
        assertThat(root.get("required")).isEqualTo(List.of("intent", "verdict", "feedback", "steps"));
        assertThat(property(root, "intent")).containsEntry("enum", List.of("ANSWER", "QUESTION"));
        assertThat(property(root, "verdict")).containsEntry("enum", List.of("CORRECT", "PARTIAL", "INCORRECT"));
        assertThat(property(root, "steps")).containsEntry("type", "array");
        assertThat(property(root, "steps").get("items")).isEqualTo(Map.of("type", "string"));
    }

    @Test
    void theOutputFormatsCarryTheSameFields() {
        assertThat(PracticeSchema.problem().toString())
                .contains("statement", "solution", "finalAnswer", "fromClass", "sourceIndexes");
        assertThat(PracticeSchema.grade().toString())
                .contains("intent", "verdict", "feedback", "steps");
    }
}
