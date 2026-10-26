package com.rnave.studily.exam;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class NeededOnExamTest {

    @Test
    void assumesTheRestOfTheCourseFinishesAtTheCurrentAverage() {
        assertThat(NeededOnExam.percent(80.0, 100, 40.0, 85.0)).isCloseTo(92.5, within(1e-9));
    }

    @Test
    void matchesTheGradeCalculatorsFinalExamFormula() {
        double base = 100;
        double finalWeight = 30;
        double percent = 72;
        double target = 80;
        double calculator = (((target * base) / 100 - (percent * (base - finalWeight)) / 100) / finalWeight) * 100;
        assertThat(NeededOnExam.percent(percent, base, finalWeight, target)).isCloseTo(calculator, within(1e-9));
    }

    @Test
    void canExceedOneHundredWhenTheTargetIsOutOfReach() {
        assertThat(NeededOnExam.percent(60.0, 100, 20.0, 90.0)).isGreaterThan(100);
    }

    @Test
    void canGoNegativeWhenTheTargetIsAlreadySafe() {
        assertThat(NeededOnExam.percent(95.0, 100, 20.0, 70.0)).isLessThan(0);
    }

    @Test
    void usesTotalWeightWhenItExceedsOneHundred() {
        assertThat(NeededOnExam.percent(80.0, 120, 30.0, 80.0)).isCloseTo(80.0, within(1e-9));
    }

    @Test
    void isNullWhenAnythingIsUnknown() {
        assertThat(NeededOnExam.percent(null, 100, 30.0, 80.0)).isNull();
        assertThat(NeededOnExam.percent(80.0, 100, null, 80.0)).isNull();
        assertThat(NeededOnExam.percent(80.0, 100, 0.0, 80.0)).isNull();
        assertThat(NeededOnExam.percent(80.0, 100, 30.0, null)).isNull();
        assertThat(NeededOnExam.percent(80.0, 100, 130.0, 80.0)).isNull();
    }
}
