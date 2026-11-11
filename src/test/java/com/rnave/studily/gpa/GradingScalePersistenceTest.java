package com.rnave.studily.gpa;

import com.rnave.studily.gpa.GradingScaleService.CustomBandDto;
import com.rnave.studily.gpa.GradingScaleService.CustomBandRequest;
import com.rnave.studily.gpa.GradingScaleService.CustomScaleRequest;
import com.rnave.studily.gpa.GradingScaleService.GpaScaleDto;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class GradingScalePersistenceTest {

    @Autowired
    private GradingScaleService service;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CustomGradingScaleRepository customRepository;

    private User user;

    @AfterEach
    void cleanUp() {
        if (user != null && user.getId() != null) {
            customRepository.deleteById(user.getId());
            userRepository.deleteById(user.getId());
        }
    }

    @Test
    void savingOverlappingCutoffsWithNewLettersReplacesRowsWithoutKeyCollision() {
        String tag = UUID.randomUUID().toString().substring(0, 8);
        user = new User();
        user.setEmail("gs-" + tag + "@example.test");
        user.setUsername("gs" + tag);
        user.setPasswordHash("x");
        user = userRepository.save(user);

        service.saveCustom(user, new CustomScaleRequest("First", List.of(
                new CustomBandRequest(90, "A", 4.0), new CustomBandRequest(70, "C", 2.0),
                new CustomBandRequest(0, "F", 0.0))));

        GpaScaleDto second = service.saveCustom(user, new CustomScaleRequest("Second", List.of(
                new CustomBandRequest(0, "E", 0.0), new CustomBandRequest(70, "B", 3.0),
                new CustomBandRequest(90, "S", 4.0))));

        assertThat(second.custom().name()).isEqualTo("Second");
        GpaScaleDto read = service.prefs(userRepository.findById(user.getId()).orElseThrow());
        assertThat(read.scale()).isEqualTo(GpaScale.CUSTOM);
        assertThat(read.custom().bands()).extracting(CustomBandDto::letter).containsExactly("S", "B", "E");
        assertThat(read.custom().bands()).extracting(CustomBandDto::minPercent).containsExactly(90, 70, 0);
    }
}
