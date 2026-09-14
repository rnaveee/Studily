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
        properties.put("gradeCategories", array(category(),
                "One entry per row of the grading scheme, such as 'Quizzes, Assignments and Labs 15%' "
                        + "or 'Exam 1 25%'. Empty when the document states no grading scheme."));
        properties.put("items", array(item(),
                "Everything the student has to hand in or sit, with a date: lab reports and other lab "
                        + "deliverables, assignments, quizzes, projects and exams. Every entry in a "
                        + "schedule table's Due column belongs here. Empty when none are stated."));
        properties.put("warnings", array(Map.of("type", "string"),
                "Short notes about anything ambiguous, guessed or left out, written for the student to read."));
        return object(properties);
    }

    private static Map<String, Object> category() {
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("name", Map.of("type", "string",
                "description", "The row's label exactly as printed, for example "
                        + "'Quizzes, Assignments and Labs', 'Exam 1' or 'Project'."));
        properties.put("weight", nullable("number",
                "Percentage of the final grade this row is worth, for example 15 for 15%. Null when "
                        + "the row states no percentage."));
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
                "Labs, lab reports, quizzes and projects all count as ASSIGNMENT."));
        properties.put("title", Map.of("type", "string",
                "description", "Title as printed, for example 'Exam 1 - Drawing', 'Assignment 3' or 'Lab 2'."));
        properties.put("dueAt", nullable("string",
                "Due date and time as 'yyyy-MM-ddTHH:mm', for example '2026-10-14T23:59'. When the "
                        + "date is a range, such as '15 to 19-SEP', use the last day of that range. "
                        + "Use 23:59 when only a date is given. Null when no date can be determined, "
                        + "but still report the item."));
        properties.put("category", nullable("string",
                "The name of the gradeCategories row this item is graded under, spelled exactly as it "
                        + "appears there. Null when no row covers it."));
        properties.put("weight", nullable("number",
                "Percentage of the final grade, for example 25 for 25%. Null whenever category is set, "
                        + "and null when the outline gives this item no percentage of its own."));
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
