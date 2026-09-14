package com.rnave.studily.academic;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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

    public static Map<Long, Integer> countsByCategory(Collection<AcademicItem> items) {
        Map<Long, Integer> counts = new HashMap<>();
        for (AcademicItem item : items) {
            Long categoryId = categoryIdOf(item);
            if (categoryId != null) {
                counts.merge(categoryId, 1, Integer::sum);
            }
        }
        return counts;
    }

    public static Double effectiveWeight(AcademicItem item, Collection<GradeCategory> categories,
                                         Map<Long, Integer> countsByCategory) {
        GradeCategory category = categoryOf(item, categories);
        if (category == null || category.getWeight() == null) {
            return item.getWeight();
        }
        int members = countsByCategory.getOrDefault(category.getId(), 0);
        return members <= 0 ? null : category.getWeight() / members;
    }

    public static CourseGrade of(Collection<AcademicItem> items) {
        return of(items, List.of());
    }

    public static CourseGrade of(Collection<AcademicItem> items, Collection<GradeCategory> categories) {
        Map<Long, Integer> counts = countsByCategory(items);

        double totalWeight = 0;
        for (GradeCategory category : categories) {
            totalWeight += category.getWeight() == null ? 0 : category.getWeight();
        }

        double weightedSum = 0;
        double gradedWeight = 0;
        double points = 0;
        double maxPoints = 0;
        int gradedCount = 0;

        for (AcademicItem item : items) {
            Double effective = effectiveWeight(item, categories, counts);
            if (carriesItsOwnWeight(item, categories) && effective != null) {
                totalWeight += effective;
            }

            Double percent = percentOf(item);
            if (percent == null) {
                continue;
            }
            gradedCount++;
            points += item.getScore();
            maxPoints += item.getMaxScore();
            if (effective != null && effective > 0) {
                weightedSum += percent * effective;
                gradedWeight += effective;
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

    private static Long categoryIdOf(AcademicItem item) {
        return item.getGradeCategory() == null ? null : item.getGradeCategory().getId();
    }

    private static GradeCategory categoryOf(AcademicItem item, Collection<GradeCategory> categories) {
        Long categoryId = categoryIdOf(item);
        if (categoryId == null) {
            return null;
        }
        return categories.stream()
                .filter(c -> c.getId().equals(categoryId))
                .findFirst()
                .orElse(null);
    }

    private static boolean carriesItsOwnWeight(AcademicItem item, Collection<GradeCategory> categories) {
        GradeCategory category = categoryOf(item, categories);
        return category == null || category.getWeight() == null;
    }
}
