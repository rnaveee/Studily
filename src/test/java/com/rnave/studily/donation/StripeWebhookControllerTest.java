package com.rnave.studily.donation;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class StripeWebhookControllerTest {

    private DonationWebhookService webhookService;
    private MockMvc mvc;
    private String payload;

    @BeforeEach
    void setUp() {
        webhookService = mock(DonationWebhookService.class);
        StripeSettings settings = new StripeSettings("sk_test_abc", StripeTestEvents.WEBHOOK_SECRET);
        mvc = MockMvcBuilders.standaloneSetup(new StripeWebhookController(settings, webhookService)).build();
        payload = StripeTestEvents.session("evt_1", "checkout.session.completed", UUID.randomUUID(),
                "cs_1", "paid", 500, "cad", "pi_1");
    }

    @Test
    void validSignatureIsAcceptedAndProcessed() throws Exception {
        String header = StripeTestEvents.signatureHeader(payload, StripeTestEvents.WEBHOOK_SECRET,
                Instant.now().getEpochSecond());

        mvc.perform(post("/api/stripe/webhook").contentType(MediaType.APPLICATION_JSON)
                        .header("Stripe-Signature", header).content(payload))
                .andExpect(status().isOk());

        verify(webhookService).handle(any());
    }

    @Test
    void forgedSignatureIsRejected() throws Exception {
        String header = StripeTestEvents.signatureHeader(payload, "whsec_attacker_guess",
                Instant.now().getEpochSecond());

        mvc.perform(post("/api/stripe/webhook").contentType(MediaType.APPLICATION_JSON)
                        .header("Stripe-Signature", header).content(payload))
                .andExpect(status().isBadRequest());

        verify(webhookService, never()).handle(any());
    }

    @Test
    void tamperedPayloadIsRejected() throws Exception {
        String header = StripeTestEvents.signatureHeader(payload, StripeTestEvents.WEBHOOK_SECRET,
                Instant.now().getEpochSecond());

        mvc.perform(post("/api/stripe/webhook").contentType(MediaType.APPLICATION_JSON)
                        .header("Stripe-Signature", header).content(payload.replace("500", "200")))
                .andExpect(status().isBadRequest());

        verify(webhookService, never()).handle(any());
    }

    @Test
    void staleTimestampIsRejected() throws Exception {
        String header = StripeTestEvents.signatureHeader(payload, StripeTestEvents.WEBHOOK_SECRET,
                Instant.now().getEpochSecond() - 3600);

        mvc.perform(post("/api/stripe/webhook").contentType(MediaType.APPLICATION_JSON)
                        .header("Stripe-Signature", header).content(payload))
                .andExpect(status().isBadRequest());

        verify(webhookService, never()).handle(any());
    }

    @Test
    void missingSignatureHeaderIsRejected() throws Exception {
        mvc.perform(post("/api/stripe/webhook").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isBadRequest());

        verify(webhookService, never()).handle(any());
    }

    @Test
    void signatureIsCheckedOverTheRawUtf8BytesWhateverCharsetIsDeclared() throws Exception {
        String unicode = StripeTestEvents.envelope("evt_u", "customer.created",
                "{\"id\":\"cus_1\",\"object\":\"customer\",\"name\":\"Zoë Ñúñez 学生 🎓\"}");
        String header = StripeTestEvents.signatureHeader(unicode, StripeTestEvents.WEBHOOK_SECRET,
                Instant.now().getEpochSecond());

        mvc.perform(post("/api/stripe/webhook").contentType("application/json; charset=ISO-8859-1")
                        .header("Stripe-Signature", header).content(unicode.getBytes(StandardCharsets.UTF_8)))
                .andExpect(status().isOk());
        mvc.perform(post("/api/stripe/webhook").contentType(MediaType.TEXT_PLAIN)
                        .header("Stripe-Signature", header).content(unicode.getBytes(StandardCharsets.UTF_8)))
                .andExpect(status().isOk());

        verify(webhookService, times(2)).handle(any());
    }

    @Test
    void malformedJsonWithAValidSignatureIsRejected() throws Exception {
        String broken = "{\"id\":\"evt_1\",\"object\":\"event\",\"data\":";
        String header = StripeTestEvents.signatureHeader(broken, StripeTestEvents.WEBHOOK_SECRET,
                Instant.now().getEpochSecond());

        mvc.perform(post("/api/stripe/webhook").contentType(MediaType.APPLICATION_JSON)
                        .header("Stripe-Signature", header).content(broken))
                .andExpect(status().isBadRequest());

        verify(webhookService, never()).handle(any());
    }

    @Test
    void disabledFeatureReturnsServiceUnavailable() throws Exception {
        MockMvc disabled = MockMvcBuilders.standaloneSetup(
                new StripeWebhookController(new StripeSettings("", ""), webhookService)).build();

        disabled.perform(post("/api/stripe/webhook").contentType(MediaType.APPLICATION_JSON)
                        .header("Stripe-Signature", "t=1,v1=abc").content(payload))
                .andExpect(status().isServiceUnavailable());

        verify(webhookService, never()).handle(any());
    }
}
