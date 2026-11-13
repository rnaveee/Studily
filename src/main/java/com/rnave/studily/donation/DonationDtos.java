package com.rnave.studily.donation;

import java.util.List;

public final class DonationDtos {

    private DonationDtos() {
    }

    public record CheckoutRequest(Number amountCents) {
    }

    public record CheckoutResponse(String url) {
    }

    public record ConfigResponse(boolean enabled, String currency, List<Integer> presets, int minCents, int maxCents) {
    }

    public record StatusResponse(DonationStatus status, int amountCents) {
    }
}
