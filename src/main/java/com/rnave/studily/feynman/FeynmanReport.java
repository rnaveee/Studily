package com.rnave.studily.feynman;

import java.util.List;

record FeynmanReport(String summary, List<String> strengths, List<Gap> gaps) {

    record Gap(String concept, String detail) {
    }
}
