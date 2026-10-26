package com.rnave.studily.gpa;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class GpaScaleTest {

    @Test
    void ninePointMatchesUvicCalendarBoundaries() {
        GpaScale s = GpaScale.NINE_POINT;
        assertThat(s.pointsFor(100)).isEqualTo(9);
        assertThat(s.pointsFor(90)).isEqualTo(9);
        assertThat(s.pointsFor(89)).isEqualTo(8);
        assertThat(s.pointsFor(85)).isEqualTo(8);
        assertThat(s.pointsFor(84)).isEqualTo(7);
        assertThat(s.pointsFor(80)).isEqualTo(7);
        assertThat(s.pointsFor(79)).isEqualTo(6);
        assertThat(s.pointsFor(77)).isEqualTo(6);
        assertThat(s.pointsFor(76)).isEqualTo(5);
        assertThat(s.pointsFor(73)).isEqualTo(5);
        assertThat(s.pointsFor(72)).isEqualTo(4);
        assertThat(s.pointsFor(70)).isEqualTo(4);
        assertThat(s.pointsFor(69)).isEqualTo(3);
        assertThat(s.pointsFor(65)).isEqualTo(3);
        assertThat(s.pointsFor(64)).isEqualTo(2);
        assertThat(s.pointsFor(60)).isEqualTo(2);
        assertThat(s.pointsFor(59)).isEqualTo(1);
        assertThat(s.pointsFor(50)).isEqualTo(1);
        assertThat(s.pointsFor(49)).isEqualTo(0);
        assertThat(s.letterFor(49)).isEqualTo("E");
        assertThat(s.letterFor(34)).isEqualTo("F");
        assertThat(s.letterFor(0)).isEqualTo("F");
    }

    @Test
    void fourThreeThreeUsesSfuValues() {
        GpaScale s = GpaScale.FOUR_THREE_THREE;
        assertThat(s.pointsFor(95)).isEqualTo(4.33);
        assertThat(s.pointsFor(94)).isEqualTo(4.0);
        assertThat(s.pointsFor(90)).isEqualTo(4.0);
        assertThat(s.pointsFor(89)).isEqualTo(3.67);
        assertThat(s.pointsFor(80)).isEqualTo(3.33);
        assertThat(s.pointsFor(75)).isEqualTo(3.0);
        assertThat(s.pointsFor(70)).isEqualTo(2.67);
        assertThat(s.pointsFor(65)).isEqualTo(2.33);
        assertThat(s.pointsFor(60)).isEqualTo(2.0);
        assertThat(s.pointsFor(55)).isEqualTo(1.67);
        assertThat(s.pointsFor(50)).isEqualTo(1.0);
        assertThat(s.pointsFor(49)).isEqualTo(0.0);
        assertThat(s.letterFor(95)).isEqualTo("A+");
        assertThat(s.letterFor(49)).isEqualTo("F");
    }

    @Test
    void fourPointCapsAtFour() {
        GpaScale s = GpaScale.FOUR_POINT;
        assertThat(s.pointsFor(100)).isEqualTo(4.0);
        assertThat(s.pointsFor(85)).isEqualTo(4.0);
        assertThat(s.pointsFor(84)).isEqualTo(3.7);
        assertThat(s.pointsFor(80)).isEqualTo(3.7);
        assertThat(s.pointsFor(77)).isEqualTo(3.3);
        assertThat(s.pointsFor(73)).isEqualTo(3.0);
        assertThat(s.pointsFor(70)).isEqualTo(2.7);
        assertThat(s.pointsFor(67)).isEqualTo(2.3);
        assertThat(s.pointsFor(63)).isEqualTo(2.0);
        assertThat(s.pointsFor(60)).isEqualTo(1.7);
        assertThat(s.pointsFor(50)).isEqualTo(1.0);
        assertThat(s.pointsFor(49)).isEqualTo(0.0);
    }

    @Test
    void ubcLettersFollowTheCalendarAndPointsAreThePercent() {
        GpaScale s = GpaScale.UBC_PERCENT;
        assertThat(s.letterFor(90)).isEqualTo("A+");
        assertThat(s.letterFor(89)).isEqualTo("A");
        assertThat(s.letterFor(80)).isEqualTo("A-");
        assertThat(s.letterFor(76)).isEqualTo("B+");
        assertThat(s.letterFor(75)).isEqualTo("B");
        assertThat(s.letterFor(72)).isEqualTo("B");
        assertThat(s.letterFor(71)).isEqualTo("B-");
        assertThat(s.letterFor(68)).isEqualTo("B-");
        assertThat(s.letterFor(67)).isEqualTo("C+");
        assertThat(s.letterFor(64)).isEqualTo("C+");
        assertThat(s.letterFor(63)).isEqualTo("C");
        assertThat(s.letterFor(60)).isEqualTo("C");
        assertThat(s.letterFor(59)).isEqualTo("C-");
        assertThat(s.letterFor(55)).isEqualTo("C-");
        assertThat(s.letterFor(54)).isEqualTo("D");
        assertThat(s.letterFor(50)).isEqualTo("D");
        assertThat(s.letterFor(49)).isEqualTo("F");
        assertThat(s.pointsFor(83.4)).isEqualTo(83.4);
        assertThat(s.pointsFor(120)).isEqualTo(100);
    }

    @Test
    void percentsRoundToTheNearestWholeNumberBeforeLookup() {
        assertThat(GpaScale.NINE_POINT.letterFor(89.5)).isEqualTo("A+");
        assertThat(GpaScale.NINE_POINT.letterFor(89.4)).isEqualTo("A");
    }

    @Test
    void defaultScaleComesFromSchoolKey() {
        assertThat(GpaScale.defaultFor("uvic")).isEqualTo(GpaScale.NINE_POINT);
        assertThat(GpaScale.defaultFor("victoria")).isEqualTo(GpaScale.NINE_POINT);
        assertThat(GpaScale.defaultFor("sfu")).isEqualTo(GpaScale.FOUR_THREE_THREE);
        assertThat(GpaScale.defaultFor("simonfraser")).isEqualTo(GpaScale.FOUR_THREE_THREE);
        assertThat(GpaScale.defaultFor("ubc")).isEqualTo(GpaScale.UBC_PERCENT);
        assertThat(GpaScale.defaultFor("britishcolumbia")).isEqualTo(GpaScale.UBC_PERCENT);
        assertThat(GpaScale.defaultFor("mcgill")).isEqualTo(GpaScale.FOUR_POINT);
        assertThat(GpaScale.defaultFor(null)).isEqualTo(GpaScale.FOUR_POINT);
    }

    @Test
    void explicitScaleOverridesTheSchoolDefault() {
        assertThat(GpaScale.resolve(GpaScale.FOUR_POINT, "uvic")).isEqualTo(GpaScale.FOUR_POINT);
        assertThat(GpaScale.resolve(null, "uvic")).isEqualTo(GpaScale.NINE_POINT);
    }
}
