package com.rnave.studily.progress;

public final class LevelMath {

    private LevelMath() {
    }

    public static long xpToNext(int level) {
        return 450L + 50L * level;
    }

    public static long totalFor(int level) {
        return (level - 1L) * (450L + 25L * level);
    }

    public static int levelFor(long xp) {
        if (xp <= 0) {
            return 1;
        }
        int level = (int) Math.floor((-425 + Math.sqrt(425.0 * 425.0 + 100.0 * (450.0 + xp))) / 50.0);
        level = Math.max(1, level);
        while (level > 1 && totalFor(level) > xp) {
            level--;
        }
        while (totalFor(level + 1) <= xp) {
            level++;
        }
        return level;
    }

    public static long xpIntoLevel(long xp, int level) {
        return xp - totalFor(level);
    }
}
