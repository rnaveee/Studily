package com.rnave.studily.feynman;

import com.rnave.studily.feynman.FeynmanDtos.ConceptScoreDto;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class FeynmanScoringTest {

    private static final FeynmanPlan PLAN = new FeynmanPlan("Motion", List.of(
            new FeynmanPlan.Concept("Newton's first law", "s", List.of(), List.of(), null),
            new FeynmanPlan.Concept("Net force", "s", List.of(), List.of(), null)));

    @Test
    void matchConcept_ignoresCaseAndExtraSpaces() {
        assertThat(FeynmanScoring.matchConcept(PLAN, "  newton's   FIRST law ")).contains("Newton's first law");
        assertThat(FeynmanScoring.matchConcept(PLAN, "Net force")).contains("Net force");
    }

    @Test
    void matchConcept_rejectsUnknownBlankAndNullNames() {
        assertThat(FeynmanScoring.matchConcept(PLAN, "Newton's third law")).isEmpty();
        assertThat(FeynmanScoring.matchConcept(PLAN, "   ")).isEmpty();
        assertThat(FeynmanScoring.matchConcept(PLAN, null)).isEmpty();
    }

    @Test
    void clamp_keepsScoresBetweenZeroAndOneHundred() {
        assertThat(FeynmanScoring.clamp(-5)).isZero();
        assertThat(FeynmanScoring.clamp(55)).isEqualTo(55);
        assertThat(FeynmanScoring.clamp(130)).isEqualTo(100);
        assertThat(FeynmanScoring.clamp(null)).isZero();
    }

    @Test
    void overall_isZeroWithNoScoresAndRoundsTheMean() {
        assertThat(FeynmanScoring.overall(List.of())).isZero();
        assertThat(FeynmanScoring.overall(List.of(
                new ConceptScoreDto("a", 50, false),
                new ConceptScoreDto("b", 75, false)))).isEqualTo(63);
    }

    @Test
    void overallUsesLatestAssessmentPerConcept() {
        FeynmanPlan plan = new FeynmanPlan("Motion", List.of(
                new FeynmanPlan.Concept("Newton's first law", "s", List.of(), List.of(), null),
                new FeynmanPlan.Concept("Net force", "s", List.of(), List.of(), null),
                new FeynmanPlan.Concept("Friction", "s", List.of(), List.of(), null)));
        List<FeynmanAssessment> assessments = List.of(
                assessment("Net force", 50, true),
                assessment("Newton's first law", 80, false),
                assessment("net force", 90, false));

        List<ConceptScoreDto> scores = FeynmanScoring.conceptScores(plan, assessments);

        assertThat(scores).extracting(ConceptScoreDto::concept).containsExactly("Newton's first law", "Net force");
        assertThat(scores.get(1).score()).isEqualTo(90);
        assertThat(scores.get(1).didNotKnow()).isTrue();
        assertThat(scores.get(0).didNotKnow()).isFalse();
        assertThat(FeynmanScoring.overall(scores)).isEqualTo(85);
    }

    private static FeynmanAssessment assessment(String concept, int score, boolean didNotKnow) {
        FeynmanAssessment a = new FeynmanAssessment();
        a.setConcept(concept);
        a.setScore(score);
        a.setDidNotKnow(didNotKnow);
        return a;
    }
}
