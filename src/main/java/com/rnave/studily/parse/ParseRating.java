package com.rnave.studily.parse;

public enum ParseRating {
    ACCURATE(true),
    MINOR_FIXES(true),
    INACCURATE(false);

    private final boolean worked;

    ParseRating(boolean worked) {
        this.worked = worked;
    }

    public boolean worked() {
        return worked;
    }
}
