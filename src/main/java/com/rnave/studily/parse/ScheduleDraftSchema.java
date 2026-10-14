package com.rnave.studily.parse;

import com.anthropic.models.messages.JsonOutputFormat;

import java.util.LinkedHashMap;
import java.util.Map;

final class ScheduleDraftSchema {

    private ScheduleDraftSchema() {
    }

    static JsonOutputFormat format() {
        return JsonOutputFormat.builder()
                .schema(JsonOutputFormat.Schema.builder()
                        .additionalProperties(CourseDraftSchema.wrap(root()))
                        .build())
                .build();
    }

    private static Map<String, Object> root() {
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("isSchedule", Map.of("type", "boolean",
                "description", "True when the image is a student's weekly class schedule or timetable. "
                        + "False for anything else, in which case courses is empty and there is one warning."));
        properties.put("courses", CourseDraftSchema.array(course(),
                "One entry per distinct course on the schedule, in the order they first appear."));
        properties.put("warnings", CourseDraftSchema.array(Map.of("type", "string"),
                "Short notes about anything ambiguous, unreadable or left out, written for the student to read."));
        return CourseDraftSchema.object(properties);
    }

    private static Map<String, Object> course() {
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("name", CourseDraftSchema.nullable("string",
                "Full course title without the code, for example 'Electric Circuits I', taken from a legend, "
                        + "timeline or block label. Null when the schedule never names it."));
        properties.put("code", CourseDraftSchema.nullable("string",
                "Course code exactly as printed, for example 'ENSC 220'."));
        properties.put("color", CourseDraftSchema.nullable("string",
                "The colour this course's blocks are drawn in, as a hex value such as '#a8d5a2'. Null when "
                        + "the schedule is not colour-coded."));
        properties.put("meetingBlocks", CourseDraftSchema.array(CourseDraftSchema.block(),
                "Every weekly meeting of this course, one entry per block drawn on the schedule."));
        return CourseDraftSchema.object(properties);
    }
}
