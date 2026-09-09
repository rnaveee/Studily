package com.rnave.studily.parse;

import com.anthropic.core.JsonValue;
import com.anthropic.models.messages.JsonOutputFormat;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class CourseDraftSchema {

    private CourseDraftSchema() {
    }

    static JsonOutputFormat format() {
        return JsonOutputFormat.builder()
                .schema(JsonOutputFormat.Schema.builder()
                        .additionalProperties(wrap(root()))
                        .build())
                .build();
    }

    private static Map<String, Object> root() {
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("name", nullable("string",
                "Course title without the code, for example 'Electric Circuits I'."));
        properties.put("code", nullable("string",
                "Course code exactly as printed, for example 'ENSC 204'."));
        properties.put("professor", nullable("string",
                "The instructor of record, for example 'Dr. Shervin Jannesar'. Never a teaching assistant."));
        properties.put("location", nullable("string",
                "Default room for the course, for example 'B9200'."));
        properties.put("meetingBlocks", array(block(),
                "Recurring weekly class times, one entry per weekday. Empty when the document establishes no weekly pattern."));
        properties.put("items", array(item(),
                "Graded assignments, quizzes, projects and exams that have a date. Empty when none are stated."));
        properties.put("warnings", array(Map.of("type", "string"),
                "Short notes about anything ambiguous, guessed or left out, written for the student to read."));
        return object(properties);
    }

    private static Map<String, Object> block() {
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("day", enumOf(
                List.of("SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"),
                "Day of the week this class meets."));
        properties.put("kind", enumOf(
                List.of("LECTURE", "LAB", "TUTORIAL"),
                "What kind of meeting this is."));
        properties.put("startTime", nullable("string",
                "Start time in 24-hour HH:mm format, for example '12:30'. Null when the document "
                        + "never states what time this class runs."));
        properties.put("endTime", nullable("string",
                "End time in 24-hour HH:mm format, for example '14:20'. Null when the document "
                        + "never states what time this class runs."));
        properties.put("location", nullable("string",
                "Room for this meeting, for example 'B 9201'."));
        return object(properties);
    }

    private static Map<String, Object> item() {
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("type", enumOf(List.of("EXAM", "ASSIGNMENT"),
                "Quizzes, labs and projects all count as ASSIGNMENT."));
        properties.put("title", Map.of("type", "string",
                "description", "Title as printed, for example 'Exam 1 - Drawing' or 'Assignment 3'."));
        properties.put("dueAt", nullable("string",
                "Due date and time as 'yyyy-MM-ddTHH:mm', for example '2026-10-14T23:59'. "
                        + "Use 23:59 when only a date is given, and the last day when a range is "
                        + "given. Null when no date can be determined."));
        properties.put("weight", nullable("number",
                "Percentage of the final grade, for example 25 for 25%. Null when the outline does not "
                        + "give this item its own percentage."));
        properties.put("location", nullable("string",
                "Room, when the document gives one for this item."));
        return object(properties);
    }

    private static Map<String, Object> object(Map<String, Object> properties) {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");
        schema.put("properties", properties);
        schema.put("required", List.copyOf(properties.keySet()));
        schema.put("additionalProperties", false);
        return schema;
    }

    private static Map<String, Object> array(Map<String, Object> items, String description) {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "array");
        schema.put("description", description);
        schema.put("items", items);
        return schema;
    }

    private static Map<String, Object> nullable(String type, String description) {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", List.of(type, "null"));
        schema.put("description", description);
        return schema;
    }

    private static Map<String, Object> enumOf(List<String> values, String description) {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "string");
        schema.put("enum", values);
        schema.put("description", description);
        return schema;
    }

    private static Map<String, JsonValue> wrap(Map<String, Object> schema) {
        Map<String, JsonValue> out = new LinkedHashMap<>();
        schema.forEach((key, value) -> out.put(key, JsonValue.from(value)));
        return out;
    }
}
