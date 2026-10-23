package com.rnave.studily.progress;

public enum ChestTier {
    WOOD,
    SILVER,
    GOLD,
    DIAMOND;

    public ChestTier lower() {
        return this == WOOD ? WOOD : values()[ordinal() - 1];
    }

    public static ChestTier defaultFor(ChestSource source) {
        return switch (source) {
            case LEVEL -> GOLD;
            case STREAK -> SILVER;
            case SESSION, FLASHCARD -> WOOD;
            case WELCOME, SURVEY -> DIAMOND;
        };
    }
}
