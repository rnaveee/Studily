package com.rnave.studily.canvas;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public record CanvasRef(Kind kind, long courseId, long itemId) {

    public enum Kind {
        ASSIGNMENT, QUIZ, CALENDAR_EVENT
    }

    private static final Pattern COURSE_PATH = Pattern.compile(
            "/courses/(\\d+)/(assignments|quizzes|calendar_events)/(\\d+)");

    public static CanvasRef parse(String url) {
        if (url == null) {
            return null;
        }
        Matcher m = COURSE_PATH.matcher(url);
        if (!m.find()) {
            return null;
        }
        Kind kind = switch (m.group(2).toLowerCase(Locale.ROOT)) {
            case "assignments" -> Kind.ASSIGNMENT;
            case "quizzes" -> Kind.QUIZ;
            default -> Kind.CALENDAR_EVENT;
        };
        try {
            return new CanvasRef(kind, Long.parseLong(m.group(1)), Long.parseLong(m.group(3)));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public String externalUid() {
        return switch (kind) {
            case ASSIGNMENT -> "canvas-assignment-" + itemId;
            case QUIZ -> "canvas-quiz-" + itemId;
            case CALENDAR_EVENT -> "canvas-event-" + itemId;
        };
    }
}
