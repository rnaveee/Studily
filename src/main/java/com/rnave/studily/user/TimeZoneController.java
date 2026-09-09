package com.rnave.studily.user;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/settings/timezone")
public class TimeZoneController {

    private final UserRepository userRepository;
    private final UserTimeZones timeZones;
    private final CurrentUser currentUser;

    public TimeZoneController(UserRepository userRepository, UserTimeZones timeZones,
                              CurrentUser currentUser) {
        this.userRepository = userRepository;
        this.timeZones = timeZones;
        this.currentUser = currentUser;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public TimeZoneDto get() {
        return new TimeZoneDto(timeZones.zoneFor(currentUser.entity()).getId());
    }

    @PutMapping
    @Transactional
    public TimeZoneDto update(@Valid @RequestBody TimeZoneDto body) {
        if (!UserTimeZones.isKnown(body.timezone())) {
            throw new BadRequestException("Unknown time zone: " + body.timezone());
        }
        User me = currentUser.entity();
        me.setTimezone(body.timezone());
        userRepository.save(me);
        return new TimeZoneDto(body.timezone());
    }

    public record TimeZoneDto(@NotBlank @Size(max = 64) String timezone) {}
}
