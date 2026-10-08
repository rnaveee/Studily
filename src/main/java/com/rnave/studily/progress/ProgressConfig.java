package com.rnave.studily.progress;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.ZoneOffset;
import java.util.random.RandomGenerator;

@Configuration
public class ProgressConfig {

    @Bean
    public Clock clock() {
        return Clock.tickMillis(ZoneOffset.UTC);
    }

    @Bean
    public RandomGenerator progressRandom() {
        return new SecureRandom();
    }
}
