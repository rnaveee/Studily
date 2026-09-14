package com.rnave.studily.academic;

import java.util.List;
import java.util.regex.Pattern;

public final class ItemTypes {

    private static final Pattern EXAM_TITLE =
            Pattern.compile("\\b(exam|midterm|final|test)\\b", Pattern.CASE_INSENSITIVE);

    private static final List<String> COLORS = List.of(
            "#3b82f6", "#ef4444", "#10b981", "#f59e0b",
            "#8b5cf6", "#ec4899", "#7968dc", "#0ea5e9");

    private ItemTypes() {
    }

    public static ItemType fromName(String name) {
        if (name == null || name.isBlank()) {
            return ItemType.ASSIGNMENT;
        }
        return EXAM_TITLE.matcher(name).find() ? ItemType.EXAM : ItemType.ASSIGNMENT;
    }

    public static String nextColor(List<String> taken) {
        for (String color : COLORS) {
            if (!taken.contains(color)) {
                return color;
            }
        }
        return COLORS.get(taken.size() % COLORS.size());
    }
}
