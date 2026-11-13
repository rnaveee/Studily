package com.rnave.studily.donation;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.config.ServiceUnavailableException;
import com.rnave.studily.config.TooManyRequestsException;
import com.rnave.studily.donation.DonationDtos.CheckoutResponse;
import com.stripe.StripeClient;
import com.stripe.exception.ApiConnectionException;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.param.checkout.SessionCreateParams;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Answers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DonationServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-12T12:00:00Z");

    @Mock
    private DonationRepository donations;

    @Mock
    private StripeSettings settings;

    @Mock(answer = Answers.RETURNS_DEEP_STUBS)
    private StripeClient client;

    private DonationService service;

    @BeforeEach
    void setUp() {
        service = new DonationService(donations, settings, new DonationCheckoutRateLimiter(),
                Clock.fixed(NOW, ZoneOffset.UTC), "https://studily.ca/");
    }

    private Session session(String id, String url) {
        Session session = new Session();
        session.setId(id);
        session.setUrl(url);
        return session;
    }

    private void enabled() {
        when(settings.isEnabled()).thenReturn(true);
    }

    @Test
    void configReportsDisabledAndLimits() {
        when(settings.isEnabled()).thenReturn(false);

        var config = service.config();

        assertThat(config.enabled()).isFalse();
        assertThat(config.currency()).isEqualTo("cad");
        assertThat(config.presets()).containsExactly(200, 500, 1000, 2000);
        assertThat(config.minCents()).isEqualTo(200);
        assertThat(config.maxCents()).isEqualTo(100000);
    }

    @Test
    void checkoutWhileDisabledIsServiceUnavailable() {
        when(settings.isEnabled()).thenReturn(false);

        assertThatThrownBy(() -> service.checkout(1L, "a@b.c", 500))
                .isInstanceOf(ServiceUnavailableException.class);
        verify(donations, never()).save(any());
    }

    @ParameterizedTest
    @ValueSource(longs = {-500, 0, 1, 199, 100001, 5_000_000_000L})
    void outOfRangeAmountsAreRejected(long amount) {
        enabled();

        assertThatThrownBy(() -> service.checkout(1L, "a@b.c", amount))
                .isInstanceOf(BadRequestException.class);
        verify(donations, never()).save(any());
    }

    @Test
    void nonIntegerAmountsAreRejected() {
        enabled();

        assertThatThrownBy(() -> service.checkout(1L, "a@b.c", 200.5))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.checkout(1L, "a@b.c", 500.0))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.checkout(1L, "a@b.c", null))
                .isInstanceOf(BadRequestException.class);
    }

    @ParameterizedTest
    @ValueSource(ints = {200, 201, 99999, 100000})
    void boundaryAmountsAreAccepted(int amount) throws Exception {
        enabled();
        when(settings.client()).thenReturn(client);
        when(donations.findOpenCheckout(eq(1L), eq(amount), any())).thenReturn(Optional.empty());
        when(client.checkout().sessions().create(any(SessionCreateParams.class), any(RequestOptions.class)))
                .thenReturn(session("cs_1", "https://checkout.stripe.com/c/pay/cs_1"));

        CheckoutResponse response = service.checkout(1L, "a@b.c", amount);

        assertThat(response.url()).isEqualTo("https://checkout.stripe.com/c/pay/cs_1");
    }

    @Test
    void createsPendingRowAndSessionWithIdempotencyKeyAndUrls() throws Exception {
        enabled();
        when(settings.client()).thenReturn(client);
        when(donations.findOpenCheckout(eq(1L), eq(500), any())).thenReturn(Optional.empty());
        when(client.checkout().sessions().create(any(SessionCreateParams.class), any(RequestOptions.class)))
                .thenReturn(session("cs_1", "https://checkout.stripe.com/c/pay/cs_1"));

        service.checkout(1L, "a@b.c", 500);

        ArgumentCaptor<Donation> saved = ArgumentCaptor.forClass(Donation.class);
        verify(donations, org.mockito.Mockito.times(2)).save(saved.capture());
        Donation donation = saved.getAllValues().get(0);
        assertThat(donation.getUserId()).isEqualTo(1L);
        assertThat(donation.getAmountCents()).isEqualTo(500);
        assertThat(donation.getCurrency()).isEqualTo("cad");
        assertThat(donation.getCreatedAt()).isEqualTo(NOW);
        assertThat(donation.getStripeSessionId()).isEqualTo("cs_1");
        assertThat(donation.getCheckoutUrl()).isEqualTo("https://checkout.stripe.com/c/pay/cs_1");

        ArgumentCaptor<SessionCreateParams> params = ArgumentCaptor.forClass(SessionCreateParams.class);
        ArgumentCaptor<RequestOptions> options = ArgumentCaptor.forClass(RequestOptions.class);
        verify(client.checkout().sessions()).create(params.capture(), options.capture());
        String id = donation.getId().toString();
        assertThat(options.getValue().getIdempotencyKey()).isEqualTo(id);
        SessionCreateParams p = params.getValue();
        assertThat(p.getMode()).isEqualTo(SessionCreateParams.Mode.PAYMENT);
        assertThat(p.getSubmitType()).isEqualTo(SessionCreateParams.SubmitType.DONATE);
        assertThat(p.getClientReferenceId()).isEqualTo(id);
        assertThat(p.getCustomerEmail()).isEqualTo("a@b.c");
        assertThat(p.getMetadata()).containsEntry("donationId", id).containsEntry("userId", "1");
        assertThat(p.getSuccessUrl()).isEqualTo("https://studily.ca/support-studily?donation=success&id=" + id);
        assertThat(p.getCancelUrl()).isEqualTo("https://studily.ca/support-studily?donation=cancelled");
        assertThat(p.toMap()).doesNotContainKey("payment_method_types");
        var item = p.getLineItems().get(0);
        assertThat(item.getPriceData().getCurrency()).isEqualTo("cad");
        assertThat(item.getPriceData().getUnitAmount()).isEqualTo(500L);
        assertThat(item.getPriceData().getProductData().getName()).isEqualTo("Support Studily");
        assertThat(item.getQuantity()).isEqualTo(1L);
    }

    @Test
    void reusesAnOpenPendingSessionForTheSameAmount() {
        enabled();
        Donation open = new Donation();
        open.setCheckoutUrl("https://checkout.stripe.com/c/pay/cs_old");
        when(donations.findOpenCheckout(1L, 500, NOW.minusSeconds(30 * 60))).thenReturn(Optional.of(open));

        CheckoutResponse response = service.checkout(1L, "a@b.c", 500);

        assertThat(response.url()).isEqualTo("https://checkout.stripe.com/c/pay/cs_old");
        verify(donations, never()).save(any());
        verify(settings, never()).client();
    }

    @Test
    void stripeFailureBecomesGenericProviderErrorAndExpiresTheRow() throws Exception {
        enabled();
        when(settings.client()).thenReturn(client);
        when(donations.findOpenCheckout(eq(1L), anyInt(), any())).thenReturn(Optional.empty());
        when(client.checkout().sessions().create(any(SessionCreateParams.class), any(RequestOptions.class)))
                .thenThrow(new ApiConnectionException("secret internal detail sk_live_leak"));

        assertThatThrownBy(() -> service.checkout(1L, "a@b.c", 500))
                .isInstanceOf(PaymentProviderException.class)
                .hasMessageNotContaining("sk_live_leak")
                .hasMessageNotContaining("secret internal detail");
        verify(donations).markExpired(any(UUID.class));
    }

    @Test
    void sixthCheckoutInTheWindowIsRateLimited() throws Exception {
        enabled();
        when(settings.client()).thenReturn(client);
        when(donations.findOpenCheckout(eq(1L), anyInt(), any())).thenReturn(Optional.empty());
        when(client.checkout().sessions().create(any(SessionCreateParams.class), any(RequestOptions.class)))
                .thenReturn(session("cs_1", "https://checkout.stripe.com/c/pay/cs_1"));

        for (int i = 0; i < 5; i++) {
            service.checkout(1L, "a@b.c", 500);
        }

        assertThatThrownBy(() -> service.checkout(1L, "a@b.c", 500))
                .isInstanceOf(TooManyRequestsException.class);
        service.checkout(2L, "x@y.z", 500);
    }

    @Test
    void statusIsOwnerOnlyAndMissingAndForeignLookLikeNotFound() {
        UUID id = UUID.randomUUID();
        Donation donation = new Donation();
        donation.setId(id);
        donation.setUserId(1L);
        donation.setAmountCents(500);
        donation.setStatus(DonationStatus.PAID);
        when(donations.findByIdAndUserId(id, 1L)).thenReturn(Optional.of(donation));
        when(donations.findByIdAndUserId(id, 2L)).thenReturn(Optional.empty());

        var status = service.status(1L, id);

        assertThat(status.status()).isEqualTo(DonationStatus.PAID);
        assertThat(status.amountCents()).isEqualTo(500);
        assertThatThrownBy(() -> service.status(2L, id)).isInstanceOf(NotFoundException.class);
        verify(donations, never()).findById(any());
    }
}
