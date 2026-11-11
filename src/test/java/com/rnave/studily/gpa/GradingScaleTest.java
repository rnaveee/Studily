package com.rnave.studily.gpa;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.gpa.GradingScale.Band;
import com.rnave.studily.gpa.GradingScale.Mode;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GradingScaleTest {

    private static GradingScale nduScale() {
        return GradingScale.custom(List.of(
                new Band(90, "A", 4.0), new Band(85, "B+", 3.5), new Band(80, "B", 3.0),
                new Band(75, "C+", 2.5), new Band(70, "C", 2.0), new Band(65, "D+", 1.5),
                new Band(60, "D", 1.0), new Band(0, "F", 0)));
    }

    private static void assertRejected(List<Band> bands) {
        assertThatThrownBy(() -> GradingScale.custom(bands)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void nduScaleCountsSeventyPercentAsCWorthTwoPoints() {
        GradingScale scale = nduScale();
        assertThat(scale.letterFor(70)).isEqualTo("C");
        assertThat(scale.pointsFor(70)).isEqualTo(2.0);
        assertThat(scale.letterFor(69)).isEqualTo("D+");
        assertThat(scale.pointsFor(69)).isEqualTo(1.5);
    }

    @Test
    void halfPercentRoundsUpIntoTheBand() {
        GradingScale scale = nduScale();
        assertThat(scale.letterFor(69.5)).isEqualTo("C");
        assertThat(scale.letterFor(69.4)).isEqualTo("D+");
    }

    @Test
    void percentAboveHundredGetsTheTopBand() {
        assertThat(nduScale().letterFor(104)).isEqualTo("A");
        assertThat(nduScale().pointsFor(104)).isEqualTo(4.0);
    }

    @Test
    void percentBelowZeroFallsToTheLowestBand() {
        assertThat(nduScale().letterFor(-5)).isEqualTo("F");
    }

    @Test
    void customScaleIsKeyedCustomInPointsMode() {
        GradingScale scale = nduScale();
        assertThat(scale.key()).isEqualTo(GpaScale.CUSTOM);
        assertThat(scale.mode()).isEqualTo(Mode.POINTS);
    }

    @Test
    void unsortedInputIsReturnedSortedDescending() {
        GradingScale scale = GradingScale.custom(List.of(
                new Band(0, "F", 0), new Band(80, "A", 4), new Band(50, "C", 2)));
        assertThat(scale.bands()).extracting(Band::minPercent).containsExactly(80, 50, 0);
    }

    @Test
    void lettersAreTrimmed() {
        GradingScale scale = GradingScale.custom(List.of(new Band(50, "  P ", 4), new Band(0, " F", 0)));
        assertThat(scale.bands()).extracting(Band::letter).containsExactly("P", "F");
    }

    @Test
    void pointsAreRoundedHalfUpToTwoDecimals() {
        GradingScale scale = GradingScale.custom(List.of(
                new Band(50, "A", 2.675), new Band(25, "B", 1.005), new Band(0, "F", 0.004)));
        assertThat(scale.bands()).extracting(Band::points).containsExactly(2.68, 1.01, 0.0);
    }

    @Test
    void equalPointsOnAdjacentBandsAreAllowed() {
        GradingScale scale = GradingScale.custom(List.of(
                new Band(95, "A+", 4.0), new Band(90, "A", 4.0), new Band(0, "F", 0)));
        assertThat(scale.pointsFor(96)).isEqualTo(4.0);
        assertThat(scale.letterFor(92)).isEqualTo("A");
    }

    @Test
    void nullListIsRejected() {
        assertRejected(null);
    }

    @Test
    void singleBandIsRejected() {
        assertRejected(List.of(new Band(0, "F", 0)));
    }

    @Test
    void twentyOneBandsAreRejected() {
        List<Band> bands = new ArrayList<>();
        for (int i = 0; i < 21; i++) {
            bands.add(new Band(i * 4, "G" + i, 0));
        }
        assertRejected(bands);
    }

    @Test
    void twentyBandsAreAccepted() {
        List<Band> bands = new ArrayList<>();
        for (int i = 0; i < 20; i++) {
            bands.add(new Band(i * 5, "G" + i, i * 0.1));
        }
        assertThat(GradingScale.custom(bands).bands()).hasSize(20);
    }

    @Test
    void nullBandIsRejected() {
        List<Band> bands = new ArrayList<>();
        bands.add(new Band(0, "F", 0));
        bands.add(null);
        assertRejected(bands);
    }

    @Test
    void minPercentBelowZeroIsRejected() {
        assertRejected(List.of(new Band(-1, "X", 0), new Band(0, "F", 0)));
    }

    @Test
    void minPercentAboveHundredIsRejected() {
        assertRejected(List.of(new Band(101, "X", 4), new Band(0, "F", 0)));
    }

    @Test
    void duplicateMinPercentIsRejected() {
        assertRejected(List.of(new Band(50, "A", 4), new Band(50, "B", 3), new Band(0, "F", 0)));
    }

    @Test
    void missingZeroBandIsRejected() {
        assertRejected(List.of(new Band(50, "A", 4), new Band(10, "F", 0)));
    }

    @Test
    void blankLetterIsRejected() {
        assertRejected(List.of(new Band(50, "   ", 4), new Band(0, "F", 0)));
    }

    @Test
    void nullLetterIsRejected() {
        assertRejected(List.of(new Band(50, null, 4), new Band(0, "F", 0)));
    }

    @Test
    void fiveCharacterLetterIsRejected() {
        assertRejected(List.of(new Band(50, "ABCDE", 4), new Band(0, "F", 0)));
    }

    @Test
    void fourCharacterLetterIsAccepted() {
        assertThat(GradingScale.custom(List.of(new Band(50, "ABCD", 4), new Band(0, "F", 0))).bands()).hasSize(2);
    }

    @Test
    void duplicateLetterAfterTrimIsRejected() {
        assertRejected(List.of(new Band(50, "A", 4), new Band(25, " A ", 2), new Band(0, "F", 0)));
    }

    @Test
    void negativePointsAreRejected() {
        assertRejected(List.of(new Band(50, "A", 1), new Band(0, "F", -0.01)));
    }

    @Test
    void pointsAboveTwentyAreRejected() {
        assertRejected(List.of(new Band(50, "A", 20.01), new Band(0, "F", 0)));
    }

    @Test
    void pointsOfExactlyTwentyAreAccepted() {
        assertThat(GradingScale.custom(List.of(new Band(50, "A", 20), new Band(0, "F", 0))).bands()).hasSize(2);
    }

    @Test
    void nanPointsAreRejected() {
        assertRejected(List.of(new Band(50, "A", Double.NaN), new Band(0, "F", 0)));
    }

    @Test
    void infinitePointsAreRejected() {
        assertRejected(List.of(new Band(50, "A", Double.POSITIVE_INFINITY), new Band(0, "F", 0)));
        assertRejected(List.of(new Band(50, "A", 1), new Band(0, "F", Double.NEGATIVE_INFINITY)));
    }

    @Test
    void pointsThatIncreaseAsPercentDropsAreRejected() {
        assertRejected(List.of(new Band(80, "A", 3), new Band(50, "B", 3.5), new Band(0, "F", 0)));
    }

    @Test
    void pointsThatRoundToEqualAreNotTreatedAsIncreasing() {
        GradingScale scale = GradingScale.custom(List.of(
                new Band(50, "A", 2.004), new Band(25, "B", 2.0), new Band(0, "F", 0)));
        assertThat(scale.bands()).extracting(Band::points).containsExactly(2.0, 2.0, 0.0);
    }

    @Test
    void ubcPresetIsPercentModeAndClamps() {
        GradingScale ubc = GpaScale.UBC_PERCENT.preset();
        assertThat(ubc.mode()).isEqualTo(Mode.PERCENT);
        assertThat(ubc.pointsFor(105)).isEqualTo(100);
        assertThat(ubc.pointsFor(-3)).isEqualTo(0);
        assertThat(ubc.pointsFor(72.5)).isEqualTo(72.5);
    }

    @Test
    void customEnumHasNoPreset() {
        assertThatThrownBy(GpaScale.CUSTOM::preset).isInstanceOf(IllegalStateException.class);
    }
}
