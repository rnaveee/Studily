package com.rnave.studily.flashcard;

import com.rnave.studily.flashcard.Sm2.Grade;
import com.rnave.studily.flashcard.Sm2.Result;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class Sm2Test {

    @Test
    void firstGoodReviewSchedulesOneDay() {
        Result r = Sm2.review(0, 2.5, 0, Grade.GOOD);

        assertThat(r.repetitions()).isEqualTo(1);
        assertThat(r.intervalDays()).isEqualTo(1);
        assertThat(r.easeFactor()).isEqualTo(2.5, within(1e-9));
    }

    @Test
    void secondGoodReviewSchedulesSixDays() {
        Result r = Sm2.review(1, 2.5, 1, Grade.GOOD);

        assertThat(r.repetitions()).isEqualTo(2);
        assertThat(r.intervalDays()).isEqualTo(6);
    }

    @Test
    void matureCardIntervalGrowsByEaseFactor() {
        Result r = Sm2.review(2, 2.5, 6, Grade.GOOD);

        assertThat(r.repetitions()).isEqualTo(3);
        assertThat(r.intervalDays()).isEqualTo(15);
    }

    @Test
    void againResetsRepetitionsAndIntervalButKeepsEase() {
        Result r = Sm2.review(5, 2.2, 30, Grade.AGAIN);

        assertThat(r.repetitions()).isZero();
        assertThat(r.intervalDays()).isZero();
        assertThat(r.easeFactor()).isEqualTo(2.2, within(1e-9));
    }

    @Test
    void relearnedCardRestartsAtOneDay() {
        Result r = Sm2.review(0, 2.2, 0, Grade.GOOD);

        assertThat(r.repetitions()).isEqualTo(1);
        assertThat(r.intervalDays()).isEqualTo(1);
    }

    @Test
    void hardLowersEaseAndEasyRaisesIt() {
        Result hard = Sm2.review(2, 2.5, 6, Grade.HARD);
        Result easy = Sm2.review(2, 2.5, 6, Grade.EASY);

        assertThat(hard.easeFactor()).isEqualTo(2.36, within(1e-9));
        assertThat(easy.easeFactor()).isEqualTo(2.6, within(1e-9));
        assertThat(easy.intervalDays()).isGreaterThan(hard.intervalDays());
    }

    @Test
    void easeFactorNeverDropsBelowFloor() {
        double ef = 2.5;
        for (int i = 0; i < 30; i++) {
            ef = Sm2.review(2, ef, 6, Grade.HARD).easeFactor();
        }
        assertThat(ef).isEqualTo(Sm2.MIN_EASE_FACTOR, within(1e-9));
    }
}
