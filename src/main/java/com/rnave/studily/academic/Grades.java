package com.rnave.studily.academic;

import java.util.Collection;

public final class Grades {

    private Grades() {
    }

    public record CourseGrade(
            Double percent,
            double gradedWeight,
            double totalWeight,
            int gradedCount,
            int itemCount) {
    }

    public static Double percentOf(AcademicItem item) {
        Double score = item.getScore();
        Double max = item.getMaxScore();
        if (score == null || max == null || max <= 0) {
            return null;
        }
        return score / max * 100;
    }

    public static CourseGrade of(Collection<AcademicItem> items) {
        double weightedSum = 0;
        double gradedWeight = 0;
        double totalWeight = 0;
        double points = 0;
        double maxPoints = 0;
        int gradedCount = 0;

        for (AcademicItem item : items) {
            double weight = item.getWeight() == null ? 0 : item.getWeight();
            totalWeight += weight;

            Double percent = percentOf(item);
            if (percent == null) {
                continue;
            }
            gradedCount++;
            points += item.getScore();
            maxPoints += item.getMaxScore();
            if (weight > 0) {
                weightedSum += percent * weight;
                gradedWeight += weight;
            }
        }

        Double percent = null;
        if (gradedWeight > 0) {
            percent = weightedSum / gradedWeight;
        } else if (maxPoints > 0) {
            percent = points / maxPoints * 100;
        }

        return new CourseGrade(percent, gradedWeight, totalWeight, gradedCount, items.size());
    }
}
