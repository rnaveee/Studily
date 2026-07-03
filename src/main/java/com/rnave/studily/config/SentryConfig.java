package com.rnave.studily.config;

import io.sentry.Sentry;
import io.sentry.spring.jakarta.SentryExceptionResolver;
import io.sentry.spring.jakarta.tracing.SpringMvcTransactionNameProvider;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

@Configuration
public class SentryConfig {

    @Value("${app.sentry.dsn:}")
    private String dsn;

    @Value("${app.sentry.environment:development}")
    private String environment;

    @Value("${app.sentry.traces-sample-rate:0.2}")
    private double tracesSampleRate;

    @PostConstruct
    void init() {
        if (dsn.isBlank()) {
            return;
        }
        Sentry.init(options -> {
            options.setDsn(dsn);
            options.setEnvironment(environment);
            options.setTracesSampleRate(tracesSampleRate);
            options.setSendDefaultPii(false);
        });
    }

    @Bean
    public SentryExceptionResolver sentryExceptionResolver() {
        return new SentryExceptionResolver(
                Sentry.getCurrentScopes(), new SpringMvcTransactionNameProvider(), Ordered.LOWEST_PRECEDENCE);
    }
}
