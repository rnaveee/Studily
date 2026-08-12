package com.rnave.studily.user;

import com.rnave.studily.config.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/settings/privacy")
public class PrivacyPrefsController {

    private final UserRepository userRepository;
    private final CurrentUser currentUser;

    public PrivacyPrefsController(UserRepository userRepository, CurrentUser currentUser) {
        this.userRepository = userRepository;
        this.currentUser = currentUser;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public PrivacyDto get() {
        return new PrivacyDto(currentUser.entity().isReadReceipts());
    }

    @PutMapping
    @Transactional
    public PrivacyDto update(@Valid @RequestBody PrivacyDto body) {
        User me = currentUser.entity();
        me.setReadReceipts(body.readReceipts());
        return new PrivacyDto(userRepository.save(me).isReadReceipts());
    }

    public record PrivacyDto(@NotNull Boolean readReceipts) {
    }
}
