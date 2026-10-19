package com.rnave.studily.moderation;

public enum ReportReason {
    SPAM,
    INAPPROPRIATE_AVATAR,
    INAPPROPRIATE_BIO,
    HARASSMENT,
    THREATS,
    HATE_SPEECH,
    INAPPROPRIATE_CONTENT,
    OTHER;

    public boolean allowedFor(ReportKind kind) {
        return switch (kind) {
            case USER -> this != INAPPROPRIATE_CONTENT;
            case MESSAGE -> this != INAPPROPRIATE_AVATAR && this != INAPPROPRIATE_BIO;
        };
    }
}
