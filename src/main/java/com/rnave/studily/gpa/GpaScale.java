package com.rnave.studily.gpa;

import java.util.List;

public enum GpaScale {

    FOUR_POINT(4.0, List.of(
            new Band(90, "A+", 4.0), new Band(85, "A", 4.0), new Band(80, "A-", 3.7),
            new Band(77, "B+", 3.3), new Band(73, "B", 3.0), new Band(70, "B-", 2.7),
            new Band(67, "C+", 2.3), new Band(63, "C", 2.0), new Band(60, "C-", 1.7),
            new Band(50, "D", 1.0), new Band(0, "F", 0.0))),

    FOUR_THREE_THREE(4.33, List.of(
            new Band(95, "A+", 4.33), new Band(90, "A", 4.0), new Band(85, "A-", 3.67),
            new Band(80, "B+", 3.33), new Band(75, "B", 3.0), new Band(70, "B-", 2.67),
            new Band(65, "C+", 2.33), new Band(60, "C", 2.0), new Band(55, "C-", 1.67),
            new Band(50, "D", 1.0), new Band(0, "F", 0.0))),

    NINE_POINT(9.0, List.of(
            new Band(90, "A+", 9), new Band(85, "A", 8), new Band(80, "A-", 7),
            new Band(77, "B+", 6), new Band(73, "B", 5), new Band(70, "B-", 4),
            new Band(65, "C+", 3), new Band(60, "C", 2), new Band(50, "D", 1),
            new Band(35, "E", 0), new Band(0, "F", 0))),

    UBC_PERCENT(100.0, List.of(
            new Band(90, "A+", 0), new Band(85, "A", 0), new Band(80, "A-", 0),
            new Band(76, "B+", 0), new Band(72, "B", 0), new Band(68, "B-", 0),
            new Band(64, "C+", 0), new Band(60, "C", 0), new Band(55, "C-", 0),
            new Band(50, "D", 0), new Band(0, "F", 0)));

    public record Band(int minPercent, String letter, double points) {
    }

    private final double maxPoints;
    private final List<Band> bands;

    GpaScale(double maxPoints, List<Band> bands) {
        this.maxPoints = maxPoints;
        this.bands = bands;
    }

    public double maxPoints() {
        return maxPoints;
    }

    public List<Band> bands() {
        return bands;
    }

    public String letterFor(double percent) {
        return bandFor(percent).letter();
    }

    public double pointsFor(double percent) {
        if (this == UBC_PERCENT) {
            return Math.max(0, Math.min(100, percent));
        }
        return bandFor(percent).points();
    }

    private Band bandFor(double percent) {
        long rounded = Math.round(percent);
        for (Band band : bands) {
            if (rounded >= band.minPercent()) {
                return band;
            }
        }
        return bands.get(bands.size() - 1);
    }

    public static GpaScale defaultFor(String schoolKey) {
        if (schoolKey == null) {
            return FOUR_POINT;
        }
        if (schoolKey.contains("uvic") || schoolKey.contains("victoria")) {
            return NINE_POINT;
        }
        if (schoolKey.contains("sfu") || schoolKey.contains("simonfraser")) {
            return FOUR_THREE_THREE;
        }
        if (schoolKey.equals("ubc") || schoolKey.contains("britishcolumbia")) {
            return UBC_PERCENT;
        }
        return FOUR_POINT;
    }

    public static GpaScale resolve(GpaScale explicit, String schoolKey) {
        return explicit != null ? explicit : defaultFor(schoolKey);
    }
}
