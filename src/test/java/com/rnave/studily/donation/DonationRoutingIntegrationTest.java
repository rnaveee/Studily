package com.rnave.studily.donation;

import com.rnave.studily.config.JwtService;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class DonationRoutingIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private JdbcTemplate jdbc;

    private final HttpClient client = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build();
    private final List<Long> userIds = new ArrayList<>();
    private final List<String> eventIds = new ArrayList<>();

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("app.stripe.secret-key", () -> "sk_test_routing_only");
        registry.add("app.stripe.webhook-secret", () -> StripeTestEvents.WEBHOOK_SECRET);
    }

    @BeforeEach
    void setUp() {
        userIds.clear();
        eventIds.clear();
    }

    @AfterEach
    void cleanUp() {
        for (String id : eventIds) {
            jdbc.update("DELETE FROM stripe_events WHERE event_id = ?", id);
        }
        for (Long id : userIds) {
            jdbc.update("DELETE FROM donations WHERE user_id = ?", id);
            userRepository.deleteById(id);
        }
    }

    private User user(boolean verified, Instant suspendedUntil) {
        String tag = UUID.randomUUID().toString().substring(0, 8);
        User user = new User();
        user.setEmail("route-" + tag + "@example.test");
        user.setUsername("route" + tag);
        user.setPasswordHash("x");
        user.setEmailVerified(verified);
        user.setSuspendedUntil(suspendedUntil);
        user = userRepository.save(user);
        userIds.add(user.getId());
        return user;
    }

    private String bearer(User user) {
        return "Bearer " + jwtService.generateToken(user.getId(), user.getTokenVersion());
    }

    private HttpResponse<String> send(HttpRequest.Builder builder) throws Exception {
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpRequest.Builder request(String path) {
        return HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
    }

    private HttpResponse<String> webhook(String payload, String signature) throws Exception {
        return send(request("/api/stripe/webhook")
                .header("Content-Type", "application/json; charset=utf-8")
                .header("Stripe-Signature", signature)
                .POST(HttpRequest.BodyPublishers.ofString(payload)));
    }

    @Test
    void signedWebhookNeedsNoAuthAndPassesEveryFilter() throws Exception {
        String eventId = "evt_route_" + UUID.randomUUID();
        eventIds.add(eventId);
        String payload = StripeTestEvents.envelope(eventId, "customer.created",
                "{\"id\":\"cus_1\",\"object\":\"customer\"}");
        String signature = StripeTestEvents.signatureHeader(payload, StripeTestEvents.WEBHOOK_SECRET,
                Instant.now().getEpochSecond());

        HttpResponse<String> response = webhook(payload, signature);

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM stripe_events WHERE event_id = ?",
                Integer.class, eventId)).isEqualTo(1);
    }

    @Test
    void webhookIsNotThrottledByTheGlobalRateLimiter() throws Exception {
        String payload = StripeTestEvents.envelope("evt_flood", "customer.created",
                "{\"id\":\"cus_1\",\"object\":\"customer\"}");
        String forged = StripeTestEvents.signatureHeader(payload, "whsec_wrong", Instant.now().getEpochSecond());

        for (int i = 0; i < 130; i++) {
            assertThat(webhook(payload, forged).statusCode()).isEqualTo(400);
        }
    }

    @Test
    void webhookWithoutSignatureReachesTheControllerAndIsRejected() throws Exception {
        HttpResponse<String> response = send(request("/api/stripe/webhook")
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("{}")));

        assertThat(response.statusCode()).isEqualTo(400);
    }

    @Test
    void configIsPublic() throws Exception {
        HttpResponse<String> response = send(request("/api/donations/config").GET());

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).contains("\"enabled\":true").contains("\"minCents\":200");
    }

    @Test
    void checkoutRequiresAuth() throws Exception {
        HttpResponse<String> response = send(request("/api/donations/checkout")
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("{\"amountCents\":500}")));

        assertThat(response.statusCode()).isEqualTo(401);
    }

    @Test
    void authenticatedCheckoutReachesValidation() throws Exception {
        User user = user(false, null);

        HttpResponse<String> response = send(request("/api/donations/checkout")
                .header("Content-Type", "application/json")
                .header("Authorization", bearer(user))
                .POST(HttpRequest.BodyPublishers.ofString("{\"amountCents\":1}")));

        assertThat(response.statusCode()).isEqualTo(400);
    }

    @Test
    void suspendedUserCannotStartCheckout() throws Exception {
        User user = user(true, Instant.now().plusSeconds(3600));

        HttpResponse<String> response = send(request("/api/donations/checkout")
                .header("Content-Type", "application/json")
                .header("Authorization", bearer(user))
                .POST(HttpRequest.BodyPublishers.ofString("{\"amountCents\":500}")));

        assertThat(response.statusCode()).isEqualTo(403);
        assertThat(response.body()).contains("ACCOUNT_SUSPENDED");
    }

    @Test
    void statusIsNotFoundForSomeoneElsesOrMalformedId() throws Exception {
        User owner = user(true, null);
        User other = user(true, null);
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO donations (id, user_id, amount_cents, currency, status, created_at) "
                + "VALUES (?, ?, 500, 'cad', 'PAID', now())", id, owner.getId());

        assertThat(send(request("/api/donations/" + id).header("Authorization", bearer(owner)).GET())
                .statusCode()).isEqualTo(200);
        assertThat(send(request("/api/donations/" + id).header("Authorization", bearer(other)).GET())
                .statusCode()).isEqualTo(404);
        assertThat(send(request("/api/donations/not-a-uuid").header("Authorization", bearer(other)).GET())
                .statusCode()).isEqualTo(404);
        assertThat(send(request("/api/donations/" + id).GET()).statusCode()).isEqualTo(401);
    }
}
