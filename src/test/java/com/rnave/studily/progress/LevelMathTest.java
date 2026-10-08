package com.rnave.studily.progress;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LevelMathTest {

    @Test
    void xpToNext_followsFourFiftyPlusFiftyPerLevel() {
        assertThat(LevelMath.xpToNext(1)).isEqualTo(500);
        assertThat(LevelMath.xpToNext(2)).isEqualTo(550);
        assertThat(LevelMath.xpToNext(13)).isEqualTo(1100);
    }

    @Test
    void totalFor_matchesSpecTable() {
        assertThat(LevelMath.totalFor(1)).isZero();
        assertThat(LevelMath.totalFor(2)).isEqualTo(500);
        assertThat(LevelMath.totalFor(5)).isEqualTo(2300);
        assertThat(LevelMath.totalFor(10)).isEqualTo(6300);
        assertThat(LevelMath.totalFor(20)).isEqualTo(18050);
        assertThat(LevelMath.totalFor(50)).isEqualTo(83300);
        assertThat(LevelMath.totalFor(100)).isEqualTo(292050);
    }

    @Test
    void totalFor_isSumOfXpToNextBelowLevel() {
        long sum = 0;
        for (int level = 1; level <= 150; level++) {
            assertThat(LevelMath.totalFor(level)).as("level %d", level).isEqualTo(sum);
            sum += LevelMath.xpToNext(level);
        }
    }

    @Test
    void levelFor_zeroXp_isLevelOne() {
        assertThat(LevelMath.levelFor(0)).isEqualTo(1);
    }

    @Test
    void levelFor_negativeXp_isLevelOne() {
        assertThat(LevelMath.levelFor(-10)).isEqualTo(1);
    }

    @Test
    void levelFor_atExactBoundaries_reachesLevel() {
        assertThat(LevelMath.levelFor(500)).isEqualTo(2);
        assertThat(LevelMath.levelFor(2300)).isEqualTo(5);
        assertThat(LevelMath.levelFor(6300)).isEqualTo(10);
        assertThat(LevelMath.levelFor(18050)).isEqualTo(20);
        assertThat(LevelMath.levelFor(292050)).isEqualTo(100);
    }

    @Test
    void levelFor_oneBelowBoundaries_staysOnPreviousLevel() {
        assertThat(LevelMath.levelFor(499)).isEqualTo(1);
        assertThat(LevelMath.levelFor(2299)).isEqualTo(4);
        assertThat(LevelMath.levelFor(6299)).isEqualTo(9);
        assertThat(LevelMath.levelFor(18049)).isEqualTo(19);
        assertThat(LevelMath.levelFor(292049)).isEqualTo(99);
    }

    @Test
    void levelFor_everyBoundaryUpToLevelTwoHundred_isExact() {
        for (int level = 2; level <= 200; level++) {
            long total = LevelMath.totalFor(level);
            assertThat(LevelMath.levelFor(total)).as("at %d", total).isEqualTo(level);
            assertThat(LevelMath.levelFor(total - 1)).as("at %d", total - 1).isEqualTo(level - 1);
        }
    }

    @Test
    void xpIntoLevel_subtractsTotalForLevel() {
        assertThat(LevelMath.xpIntoLevel(2724, 5)).isEqualTo(424);
        assertThat(LevelMath.xpIntoLevel(0, 1)).isZero();
    }
}
