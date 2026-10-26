package com.rnave.studily.gpa;

import com.rnave.studily.gpa.GpaMath.Entry;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class GpaMathTest {

    @Test
    void weightsCoursesByCredits() {
        List<Entry> entries = List.of(new Entry(95, 3.0), new Entry(60, 1.0));
        assertThat(GpaMath.gpa(GpaScale.NINE_POINT, entries)).isCloseTo((9 * 3 + 2 * 1) / 4.0, within(1e-9));
    }

    @Test
    void missingCreditsCountAsOne() {
        List<Entry> entries = List.of(new Entry(95, null), new Entry(60, 1.0));
        assertThat(GpaMath.gpa(GpaScale.NINE_POINT, entries)).isCloseTo(5.5, within(1e-9));
        assertThat(GpaMath.anyMissingCredits(entries)).isTrue();
        assertThat(GpaMath.anyMissingCredits(List.of(new Entry(95, 3.0)))).isFalse();
    }

    @Test
    void zeroCreditCoursesDoNotCount() {
        List<Entry> entries = List.of(new Entry(95, 3.0), new Entry(10, 0.0));
        assertThat(GpaMath.gpa(GpaScale.FOUR_THREE_THREE, entries)).isCloseTo(4.33, within(1e-9));
    }

    @Test
    void noGradedCoursesGivesNull() {
        assertThat(GpaMath.gpa(GpaScale.FOUR_POINT, List.of())).isNull();
        assertThat(GpaMath.gpa(GpaScale.FOUR_POINT, List.of(new Entry(90, 0.0)))).isNull();
    }

    @Test
    void ubcGpaIsTheCreditWeightedPercentAverage() {
        List<Entry> entries = List.of(new Entry(90, 3.0), new Entry(70, 1.0));
        assertThat(GpaMath.gpa(GpaScale.UBC_PERCENT, entries)).isCloseTo(85, within(1e-9));
    }
}
