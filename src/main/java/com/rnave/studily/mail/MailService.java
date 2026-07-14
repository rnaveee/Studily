package com.rnave.studily.mail;

import tools.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);
    private static final URI RESEND_URI = URI.create("https://api.resend.com/emails");

    private final String apiKey;
    private final String from;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public MailService(
            @Value("${app.mail.resend-api-key}") String apiKey,
            @Value("${app.mail.from}") String from,
            ObjectMapper objectMapper) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.from = from;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
        if (this.apiKey.isEmpty()) {
            log.warn("RESEND_API_KEY not set — outgoing email is disabled");
        }
    }

    public boolean enabled() {
        return !apiKey.isEmpty();
    }

    public boolean send(String to, String subject, String html) {
        return send(to, subject, html, null);
    }

    public boolean send(String to, String subject, String html, String replyTo) {
        if (!enabled()) {
            log.warn("Email disabled, dropping message to {} ({})", to, subject);
            return false;
        }
        try {
            Map<String, Object> payload = new HashMap<>(Map.of(
                    "from", from,
                    "to", List.of(to),
                    "subject", subject,
                    "html", html));
            if (replyTo != null && !replyTo.isBlank()) {
                payload.put("reply_to", replyTo);
            }
            String body = objectMapper.writeValueAsString(payload);
            HttpRequest request = HttpRequest.newBuilder(RESEND_URI)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(15))
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                return true;
            }
            log.error("Resend rejected email to {}: HTTP {} {}", to, response.statusCode(), response.body());
            return false;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        } catch (Exception e) {
            log.error("Failed to send email to {}", to, e);
            return false;
        }
    }
}
