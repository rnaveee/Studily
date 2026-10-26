package com.rnave.studily.exam;

public final class NeededOnExam {

    private NeededOnExam() {
    }

    public static Double percent(Double currentPercent, double totalWeight, Double examWeight, Double target) {
        if (currentPercent == null || target == null || examWeight == null || examWeight <= 0) {
            return null;
        }
        double base = Math.max(100, totalWeight);
        if (examWeight > base) {
            return null;
        }
        return (target * base - currentPercent * (base - examWeight)) / examWeight;
    }
}
