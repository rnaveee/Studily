package com.rnave.studily.progress;

import com.rnave.studily.progress.ProgressDtos.BadgeDto;
import com.rnave.studily.progress.ProgressDtos.FeaturedBadgesRequest;
import com.rnave.studily.progress.ProgressDtos.PurchaseResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class BadgeController {

    private final BadgeService badgeService;

    public BadgeController(BadgeService badgeService) {
        this.badgeService = badgeService;
    }

    @GetMapping("/api/badges")
    public List<BadgeDto> mine() {
        return badgeService.mine();
    }

    @GetMapping("/api/users/{id}/badges")
    public List<BadgeDto> forUser(@PathVariable Long id) {
        return badgeService.forUser(id);
    }

    @PutMapping("/api/me/featured-badges")
    public List<BadgeDto> setFeatured(@RequestBody FeaturedBadgesRequest req) {
        return badgeService.setFeatured(req.codes());
    }

    @PostMapping("/api/badges/{code}/purchase")
    public PurchaseResult purchase(@PathVariable String code) {
        return badgeService.purchase(code);
    }
}
