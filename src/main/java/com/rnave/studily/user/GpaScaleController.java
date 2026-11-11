package com.rnave.studily.user;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.gpa.GpaScale;
import com.rnave.studily.gpa.GradingScaleService;
import com.rnave.studily.gpa.GradingScaleService.CustomScaleRequest;
import com.rnave.studily.gpa.GradingScaleService.GpaScaleDto;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/settings/gpa-scale")
public class GpaScaleController {

    private final GradingScaleService gradingScaleService;
    private final CurrentUser currentUser;

    public GpaScaleController(GradingScaleService gradingScaleService, CurrentUser currentUser) {
        this.gradingScaleService = gradingScaleService;
        this.currentUser = currentUser;
    }

    @GetMapping
    public GpaScaleDto get() {
        return gradingScaleService.prefs(currentUser.entity());
    }

    @PutMapping
    public GpaScaleDto update(@Valid @RequestBody GpaScaleRequest body) {
        return gradingScaleService.select(currentUser.entity(), body.scale());
    }

    @PutMapping("/custom")
    public GpaScaleDto saveCustom(@RequestBody CustomScaleRequest body) {
        return gradingScaleService.saveCustom(currentUser.entity(), body);
    }

    @DeleteMapping("/custom")
    public GpaScaleDto deleteCustom() {
        return gradingScaleService.deleteCustom(currentUser.entity());
    }

    public record GpaScaleRequest(GpaScale scale) {
    }
}
