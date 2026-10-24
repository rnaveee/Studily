package com.rnave.studily.config;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@ControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SpaFallbackAdvice {

    private final SpaPages pages;

    public SpaFallbackAdvice(SpaPages pages) {
        this.pages = pages;
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<?> handle(NoResourceFoundException ex, HttpServletRequest request) {
        String path = request.getRequestURI();
        String method = request.getMethod();
        boolean page = HttpMethod.GET.matches(method) || HttpMethod.HEAD.matches(method);
        if (!page || path.equals("/api") || path.startsWith("/api/")) {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("timestamp", Instant.now().toString());
            body.put("status", HttpStatus.NOT_FOUND.value());
            body.put("error", HttpStatus.NOT_FOUND.getReasonPhrase());
            body.put("message", "Not found");
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body);
        }
        SpaPages.Page resolved = pages.resolve(path);
        return ResponseEntity.status(resolved.status())
                .cacheControl(CacheControl.noCache())
                .contentType(new MediaType(MediaType.TEXT_HTML, StandardCharsets.UTF_8))
                .body(resolved.html());
    }
}
