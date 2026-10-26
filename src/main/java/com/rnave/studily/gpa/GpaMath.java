package com.rnave.studily.gpa;

import java.util.Collection;

public final class GpaMath {

    public static final double MISSING_CREDITS = 1.0;

    private GpaMath() {
    }

    public record Entry(double percent, Double credits) {

        double weight() {
            return credits == null ? MISSING_CREDITS : credits;
        }
    }

    public static Double gpa(GpaScale scale, Collection<Entry> entries) {
        double weighted = 0;
        double totalCredits = 0;
        for (Entry entry : entries) {
            double weight = entry.weight();
            weighted += scale.pointsFor(entry.percent()) * weight;
            totalCredits += weight;
        }
        if (totalCredits <= 0) {
            return null;
        }
        return weighted / totalCredits;
    }

    public static boolean anyMissingCredits(Collection<Entry> entries) {
        return entries.stream().anyMatch(e -> e.credits() == null);
    }
}
