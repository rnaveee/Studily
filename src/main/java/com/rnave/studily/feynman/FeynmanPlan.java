package com.rnave.studily.feynman;

import java.util.List;

record FeynmanPlan(String topic, List<Concept> concepts) {

    record Concept(String name, String summary, List<String> keyPoints, List<String> misconceptions,
                   String source, Integer document, Integer page) {

        Concept(String name, String summary, List<String> keyPoints, List<String> misconceptions, String source) {
            this(name, summary, keyPoints, misconceptions, source, null, null);
        }
    }
}
