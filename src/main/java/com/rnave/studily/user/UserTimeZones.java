package com.rnave.studily.user;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZoneId;
import java.util.LinkedHashSet;
import java.util.Set;

@Component
public class UserTimeZones {

    private final UserRepository userRepository;
    private final ZoneId fallback;

    public UserTimeZones(UserRepository userRepository, @Value("${app.timezone}") String timezone) {
        this.userRepository = userRepository;
        this.fallback = ZoneId.of(timezone);
    }

    public ZoneId fallback() {
        return fallback;
    }

    public ZoneId zoneFor(User user) {
        return user == null ? fallback : parse(user.getTimezone());
    }

    public ZoneId parse(String zoneId) {
        if (zoneId == null || zoneId.isBlank()) {
            return fallback;
        }
        try {
            return ZoneId.of(zoneId);
        } catch (Exception e) {
            return fallback;
        }
    }

    public static boolean isKnown(String zoneId) {
        return zoneId != null && ZoneId.getAvailableZoneIds().contains(zoneId);
    }

    @Transactional(readOnly = true)
    public Set<ZoneId> zonesInUse() {
        Set<ZoneId> zones = new LinkedHashSet<>();
        zones.add(fallback);
        for (String id : userRepository.findDistinctTimezones()) {
            zones.add(parse(id));
        }
        return zones;
    }
}
