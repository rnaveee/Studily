package com.rnave.studily.gpa;

import com.rnave.studily.config.BadRequestException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public record GradingScale(GpaScale key, Mode mode, List<Band> bands) {

    public enum Mode { POINTS, PERCENT }

    public record Band(int minPercent, String letter, double points) {
    }

    private static final int MIN_BANDS = 2;
    private static final int MAX_BANDS = 20;
    private static final int MAX_LETTER = 4;
    private static final double MAX_POINTS = 20;

    public String letterFor(double percent) {
        return bandFor(percent).letter();
    }

    public double pointsFor(double percent) {
        if (mode == Mode.PERCENT) {
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

    public static GradingScale custom(List<Band> rawBands) {
        if (rawBands == null || rawBands.size() < MIN_BANDS || rawBands.size() > MAX_BANDS) {
            throw new BadRequestException("A custom scale needs " + MIN_BANDS + " to " + MAX_BANDS + " grades");
        }
        List<Band> bands = new ArrayList<>();
        Set<Integer> minimums = new HashSet<>();
        Set<String> letters = new HashSet<>();
        for (Band raw : rawBands) {
            if (raw == null) {
                throw new BadRequestException("Every grade needs a letter, a minimum % and points");
            }
            if (raw.minPercent() < 0 || raw.minPercent() > 100) {
                throw new BadRequestException("Minimum % must be between 0 and 100");
            }
            if (!minimums.add(raw.minPercent())) {
                throw new BadRequestException("Two grades have the same minimum %: " + raw.minPercent());
            }
            String letter = raw.letter() == null ? "" : raw.letter().trim();
            if (letter.isEmpty() || letter.length() > MAX_LETTER) {
                throw new BadRequestException("Each letter must be 1 to " + MAX_LETTER + " characters");
            }
            if (!letters.add(letter)) {
                throw new BadRequestException("Two grades use the letter " + letter);
            }
            double points = raw.points();
            if (!Double.isFinite(points) || points < 0 || points > MAX_POINTS) {
                throw new BadRequestException("Points must be between 0 and " + (int) MAX_POINTS);
            }
            double rounded = BigDecimal.valueOf(points).setScale(2, RoundingMode.HALF_UP).doubleValue();
            bands.add(new Band(raw.minPercent(), letter, rounded));
        }
        if (!minimums.contains(0)) {
            throw new BadRequestException("One grade must start at 0%");
        }
        bands.sort(Comparator.comparingInt(Band::minPercent).reversed());
        for (int i = 1; i < bands.size(); i++) {
            if (bands.get(i).points() > bands.get(i - 1).points()) {
                throw new BadRequestException("A lower grade can't be worth more points than a higher one ("
                        + bands.get(i).letter() + " vs " + bands.get(i - 1).letter() + ")");
            }
        }
        return new GradingScale(GpaScale.CUSTOM, Mode.POINTS, List.copyOf(bands));
    }
}
