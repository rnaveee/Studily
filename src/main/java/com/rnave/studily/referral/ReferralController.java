package com.rnave.studily.referral;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.referral.ReferralDtos.InviteDto;
import com.rnave.studily.referral.ReferralDtos.ReferralSummaryDto;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

@RestController
public class ReferralController {

    private final ReferralService referralService;
    private final CurrentUser currentUser;

    public ReferralController(ReferralService referralService, CurrentUser currentUser) {
        this.referralService = referralService;
        this.currentUser = currentUser;
    }

    @GetMapping("/api/referrals/me")
    public ReferralSummaryDto me() {
        return referralService.me(currentUser.id());
    }

    @GetMapping("/api/public/invites/{code}")
    public InviteDto invite(@PathVariable String code) {
        return referralService.invite(code).orElseThrow(() -> new NotFoundException("Invite not found"));
    }

    @GetMapping(value = "/api/public/invites/{code}/preview.png", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> preview(@PathVariable String code) {
        return referralService.invite(code)
                .map(invite -> ResponseEntity.ok()
                        .cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePublic())
                        .contentType(MediaType.IMAGE_PNG)
                        .body(InvitePreviewImage.png(invite.inviterName())))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
