package com.rnave.studily.feynman;

import java.util.List;

record FeynmanTurn(boolean assessed, String concept, Integer score, List<String> gaps, boolean didNotKnow,
                   List<String> messages, boolean lectureComplete, String focusConcept) {

    FeynmanTurn(boolean assessed, String concept, Integer score, List<String> gaps, boolean didNotKnow,
                List<String> messages, boolean lectureComplete) {
        this(assessed, concept, score, gaps, didNotKnow, messages, lectureComplete, null);
    }
}
