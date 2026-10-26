package com.rnave.studily.canvas;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CourseLabelTest {

    @Test
    void splitsTheNameFromTheCodeAndKeepsTheSection() {
        CourseLabel label = CourseLabel.parse("Fundamentals of Digital Logic and Design - ENSC252 D100");

        assertThat(label.name()).isEqualTo("Fundamentals of Digital Logic and Design");
        assertThat(label.code()).isEqualTo("ENSC252 D100");
    }

    @Test
    void usesTheCodeAsTheNameWhenThereIsNoNamePart() {
        assertThat(CourseLabel.parse("ENSC252 D100")).isEqualTo(new CourseLabel("ENSC252 D100", "ENSC252 D100"));
        assertThat(CourseLabel.parse("CMPT 354 D100")).isEqualTo(new CourseLabel("CMPT 354 D100", "CMPT 354 D100"));
        assertThat(CourseLabel.parse("MATH 152")).isEqualTo(new CourseLabel("MATH 152", "MATH 152"));
    }

    @Test
    void readsAShortNameBeforeTheCode() {
        CourseLabel label = CourseLabel.parse("Database Systems I - CMPT354 D100");

        assertThat(label.name()).isEqualTo("Database Systems I");
        assertThat(label.code()).isEqualTo("CMPT354 D100");
    }

    @Test
    void readsTheNameWhenItComesAfterTheCode() {
        CourseLabel label = CourseLabel.parse("CMPT 354 - Database Systems");

        assertThat(label.name()).isEqualTo("Database Systems");
        assertThat(label.code()).isEqualTo("CMPT 354");
    }

    @Test
    void keepsTheWholeTextAsTheNameWhenThereIsNoCode() {
        assertThat(CourseLabel.parse("Some Club")).isEqualTo(new CourseLabel("Some Club", null));
    }

    @Test
    void handlesMissingText() {
        assertThat(CourseLabel.parse(null)).isEqualTo(new CourseLabel(null, null));
        assertThat(CourseLabel.parse("   ")).isEqualTo(new CourseLabel(null, null));
    }

    @Test
    void onlyCodeIsTrueWhenTheCodeCoversTheWholeText() {
        assertThat(CourseLabel.onlyCode("ENSC252")).isTrue();
        assertThat(CourseLabel.onlyCode("ENSC 252")).isTrue();
        assertThat(CourseLabel.onlyCode(" ensc252 d100 ")).isTrue();
        assertThat(CourseLabel.onlyCode("ENSC 252 Digital Logic")).isFalse();
        assertThat(CourseLabel.onlyCode("Fundamentals of Digital Logic and Design")).isFalse();
        assertThat(CourseLabel.onlyCode("Intro - ENSC252")).isFalse();
        assertThat(CourseLabel.onlyCode(null)).isFalse();
    }
}
