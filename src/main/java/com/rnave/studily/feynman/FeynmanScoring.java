package com.rnave.studily.feynman;

import com.rnave.studily.feynman.FeynmanDtos.ConceptScoreDto;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

final class FeynmanScoring {

    private FeynmanScoring() {
    }

    static String key(String name) {
        return name == null ? "" : name.strip().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    static Optional<String> matchConcept(FeynmanPlan plan, String name) {
        String wanted = key(name);
        if (wanted.isEmpty() || plan.concepts() == null) {
            return Optional.empty();
        }
        return plan.concepts().stream()
                .map(FeynmanPlan.Concept::name)
                .filter(n -> key(n).equals(wanted))
                .findFirst();
    }

    static List<ConceptScoreDto> conceptScores(FeynmanPlan plan, List<FeynmanAssessment> assessments) {
        Map<String, Integer> latest = new HashMap<>();
        Map<String, Boolean> struggled = new HashMap<>();
        for (FeynmanAssessment a : assessments) {
            String k = key(a.getConcept());
            latest.put(k, a.getScore());
            struggled.merge(k, a.isDidNotKnow(), Boolean::logicalOr);
        }
        List<ConceptScoreDto> scores = new ArrayList<>();
        for (FeynmanPlan.Concept concept : plan.concepts()) {
            String k = key(concept.name());
            if (latest.containsKey(k)) {
                scores.add(new ConceptScoreDto(concept.name(), latest.get(k), struggled.get(k)));
            }
        }
        return scores;
    }

    static int overall(List<ConceptScoreDto> scores) {
        if (scores.isEmpty()) {
            return 0;
        }
        return (int) Math.round(scores.stream().mapToInt(ConceptScoreDto::score).average().orElse(0));
    }

    static int clamp(Integer score) {
        return score == null ? 0 : Math.max(0, Math.min(100, score));
    }
}
