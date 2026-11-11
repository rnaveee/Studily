package com.rnave.studily.rag;

public record Scope(long userId, Long courseId, Long chatId) {

    public Scope {
        if ((courseId == null) == (chatId == null)) {
            throw new IllegalArgumentException("A scope is exactly one course or one chat");
        }
    }

    public static Scope course(long userId, long courseId) {
        return new Scope(userId, courseId, null);
    }

    public static Scope chat(long userId, long chatId) {
        return new Scope(userId, null, chatId);
    }

    public boolean isCourse() {
        return courseId != null;
    }
}
