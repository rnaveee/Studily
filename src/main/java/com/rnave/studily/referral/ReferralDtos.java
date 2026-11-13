package com.rnave.studily.referral;

public final class ReferralDtos {

    private ReferralDtos() {}

    public record ReferralSummaryDto(String code, String link, long joined, long pending, long rewardedCount, int cap) {
    }

    public record InviteDto(String inviterName) {
    }
}
