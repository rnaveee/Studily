package com.rnave.studily.user;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.gpa.GpaScale;
import jakarta.validation.Valid;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/settings/gpa-scale")
public class GpaScaleController {

    private final UserRepository userRepository;
    private final CurrentUser currentUser;

    public GpaScaleController(UserRepository userRepository, CurrentUser currentUser) {
        this.userRepository = userRepository;
        this.currentUser = currentUser;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public GpaScaleDto get() {
        return toDto(currentUser.entity());
    }

    @PutMapping
    @Transactional
    public GpaScaleDto update(@Valid @RequestBody GpaScaleRequest body) {
        User me = currentUser.entity();
        me.setGpaScale(body.scale());
        return toDto(userRepository.save(me));
    }

    private static GpaScaleDto toDto(User user) {
        return new GpaScaleDto(GpaScale.resolve(user.getGpaScale(), user.getSchoolKey()),
                GpaScale.defaultFor(user.getSchoolKey()), user.getGpaScale() != null);
    }

    public record GpaScaleRequest(GpaScale scale) {
    }

    public record GpaScaleDto(GpaScale scale, GpaScale defaultScale, boolean explicit) {
    }
}
