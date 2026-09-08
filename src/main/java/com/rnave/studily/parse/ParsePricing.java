package com.rnave.studily.parse;

import java.util.Map;

public final class ParsePricing {

    private static final Map<String, double[]> USD_PER_MTOK = Map.of(
            "claude-sonnet-5", new double[]{2.00, 10.00},
            "claude-haiku-4-5", new double[]{1.00, 5.00},
            "claude-opus-5", new double[]{5.00, 25.00});

    private static final double[] FALLBACK = {2.00, 10.00};

    private ParsePricing() {
    }

    public static double usd(String model, long inputTokens, long outputTokens) {
        double[] rates = USD_PER_MTOK.getOrDefault(model, FALLBACK);
        return (inputTokens * rates[0] + outputTokens * rates[1]) / 1_000_000d;
    }
}
