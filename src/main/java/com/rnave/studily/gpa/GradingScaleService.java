package com.rnave.studily.gpa;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class GradingScaleService {

    private static final int MAX_NAME = 40;

    private final CustomGradingScaleRepository customRepository;
    private final UserRepository userRepository;

    public GradingScaleService(CustomGradingScaleRepository customRepository, UserRepository userRepository) {
        this.customRepository = customRepository;
        this.userRepository = userRepository;
    }

    public record CustomBandRequest(Integer minPercent, String letter, Double points) {
    }

    public record CustomScaleRequest(String name, List<CustomBandRequest> bands) {
    }

    public record CustomBandDto(int minPercent, String letter, double points) {
    }

    public record CustomScaleDto(String name, List<CustomBandDto> bands) {
    }

    public record GpaScaleDto(GpaScale scale, GpaScale defaultScale, boolean explicit, CustomScaleDto custom) {
    }

    @Transactional(readOnly = true)
    public GradingScale scaleFor(User user) {
        if (user.getGpaScale() == GpaScale.CUSTOM) {
            Optional<CustomGradingScale> custom = customRepository.findById(user.getId());
            if (custom.isPresent()) {
                return GradingScale.custom(toBands(custom.get()));
            }
            return GpaScale.defaultFor(user.getSchoolKey()).preset();
        }
        return GpaScale.resolve(user.getGpaScale(), user.getSchoolKey()).preset();
    }

    @Transactional(readOnly = true)
    public GpaScaleDto prefs(User user) {
        return buildPrefs(user, customRepository.findById(user.getId()).orElse(null));
    }

    @Transactional
    public GpaScaleDto select(User user, GpaScale scale) {
        CustomGradingScale custom = customRepository.findById(user.getId()).orElse(null);
        if (scale == GpaScale.CUSTOM && custom == null) {
            throw new BadRequestException("Create a custom scale first");
        }
        user.setGpaScale(scale);
        userRepository.save(user);
        return buildPrefs(user, custom);
    }

    @Transactional
    public GpaScaleDto saveCustom(User user, CustomScaleRequest req) {
        if (req == null || req.bands() == null) {
            throw new BadRequestException("A custom scale needs grades");
        }
        List<GradingScale.Band> raw = new ArrayList<>();
        for (CustomBandRequest band : req.bands()) {
            if (band == null || band.minPercent() == null || band.letter() == null || band.points() == null) {
                throw new BadRequestException("Every grade needs a letter, a minimum % and points");
            }
            raw.add(new GradingScale.Band(band.minPercent(), band.letter(), band.points()));
        }
        GradingScale validated = GradingScale.custom(raw);
        String name = req.name() == null ? null : req.name().trim();
        if (name != null && name.isEmpty()) {
            name = null;
        }
        if (name != null && name.length() > MAX_NAME) {
            throw new BadRequestException("Scale name must be at most " + MAX_NAME + " characters");
        }

        CustomGradingScale entity = customRepository.findById(user.getId()).orElseGet(() -> {
            CustomGradingScale created = new CustomGradingScale();
            created.setUserId(user.getId());
            return created;
        });
        entity.setName(name);
        entity.setUpdatedAt(Instant.now());
        entity.getBands().clear();
        for (GradingScale.Band band : validated.bands()) {
            entity.getBands().add(new CustomGradeBand((short) band.minPercent(), band.letter(),
                    BigDecimal.valueOf(band.points()).setScale(2)));
        }
        entity = customRepository.save(entity);

        user.setGpaScale(GpaScale.CUSTOM);
        userRepository.save(user);
        return buildPrefs(user, entity);
    }

    @Transactional
    public GpaScaleDto deleteCustom(User user) {
        customRepository.findById(user.getId()).ifPresent(customRepository::delete);
        if (user.getGpaScale() == GpaScale.CUSTOM) {
            user.setGpaScale(null);
            userRepository.save(user);
        }
        return buildPrefs(user, null);
    }

    private static GpaScaleDto buildPrefs(User user, CustomGradingScale custom) {
        GpaScale defaultScale = GpaScale.defaultFor(user.getSchoolKey());
        boolean customMissing = user.getGpaScale() == GpaScale.CUSTOM && custom == null;
        GpaScale effective = customMissing ? defaultScale : GpaScale.resolve(user.getGpaScale(), user.getSchoolKey());
        boolean explicit = user.getGpaScale() != null && !customMissing;
        CustomScaleDto dto = custom == null ? null : new CustomScaleDto(custom.getName(),
                custom.getBands().stream()
                        .map(b -> new CustomBandDto(b.getMinPercent(), b.getLetter(), b.getPoints().doubleValue()))
                        .toList());
        return new GpaScaleDto(effective, defaultScale, explicit, dto);
    }

    private static List<GradingScale.Band> toBands(CustomGradingScale custom) {
        return custom.getBands().stream()
                .map(b -> new GradingScale.Band(b.getMinPercent(), b.getLetter(), b.getPoints().doubleValue()))
                .toList();
    }
}
