package com.rnave.studily.donation;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.donation.DonationDtos.CheckoutRequest;
import com.rnave.studily.donation.DonationDtos.CheckoutResponse;
import com.rnave.studily.donation.DonationDtos.ConfigResponse;
import com.rnave.studily.donation.DonationDtos.StatusResponse;
import com.rnave.studily.user.User;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/donations")
public class DonationController {

    private final DonationService donationService;
    private final CurrentUser currentUser;

    public DonationController(DonationService donationService, CurrentUser currentUser) {
        this.donationService = donationService;
        this.currentUser = currentUser;
    }

    @GetMapping("/config")
    public ConfigResponse config() {
        return donationService.config();
    }

    @PostMapping("/checkout")
    public CheckoutResponse checkout(@RequestBody CheckoutRequest request) {
        User user = currentUser.entity();
        return donationService.checkout(user.getId(), user.getEmail(), request.amountCents());
    }

    @GetMapping("/{id}")
    public StatusResponse status(@PathVariable String id) {
        UUID donationId;
        try {
            donationId = UUID.fromString(id);
        } catch (IllegalArgumentException e) {
            throw new NotFoundException("Donation not found");
        }
        return donationService.status(currentUser.id(), donationId);
    }

    @ExceptionHandler(PaymentProviderException.class)
    public ResponseEntity<Map<String, Object>> handleProvider(PaymentProviderException ex) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("timestamp", Instant.now().toString());
        map.put("status", HttpStatus.BAD_GATEWAY.value());
        map.put("error", HttpStatus.BAD_GATEWAY.getReasonPhrase());
        map.put("message", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(map);
    }
}
