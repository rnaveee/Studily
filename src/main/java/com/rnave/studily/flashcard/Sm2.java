package com.rnave.studily.flashcard;

/**
 * SM-2 spaced-repetition scheduling (SuperMemo 2, as popularized by Anki),
 * with Anki's four answer buttons mapped onto SM-2 quality scores.
 */
public final class Sm2 {

    public static final double MIN_EASE_FACTOR = 1.3;

    public enum Grade {
        AGAIN(0),
        HARD(3),
        GOOD(4),
        EASY(5);

        private final int quality;

        Grade(int quality) {
            this.quality = quality;
        }
    }

    public record Result(int repetitions, double easeFactor, int intervalDays) {}

    private Sm2() {}

    public static Result review(int repetitions, double easeFactor, int intervalDays, Grade grade) {
        if (grade == Grade.AGAIN) {
            // Failed recall: restart the repetition sequence; SM-2 leaves the ease factor
            // unchanged on failure. Interval 0 keeps the card due now, so it comes back
            // within the same study session.
            return new Result(0, easeFactor, 0);
        }

        int q = grade.quality;
        double ef = Math.max(MIN_EASE_FACTOR,
                easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

        int reps = repetitions + 1;
        int interval;
        if (reps == 1) {
            interval = 1;
        } else if (reps == 2) {
            interval = 6;
        } else {
            interval = (int) Math.round(intervalDays * ef);
        }
        return new Result(reps, ef, interval);
    }
}
