package com.rnave.studily.support;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.GlobalRateLimitFilter;
import com.rnave.studily.config.SlidingWindowRateLimiter;
import com.rnave.studily.config.TooManyRequestsException;
import com.rnave.studily.mail.MailService;
import com.rnave.studily.user.User;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.HtmlUtils;

@RestController
@RequestMapping("/api/support")
public class SupportController {

    private static final long WINDOW_MS = 60 * 60_000;

    private final MailService mailService;
    private final CurrentUser currentUser;
    private final String supportEmail;
    private final SlidingWindowRateLimiter perIpLimiter = new SlidingWindowRateLimiter(3, WINDOW_MS);

    public SupportController(MailService mailService, CurrentUser currentUser,
                             @Value("${app.support.email}") String supportEmail) {
        this.mailService = mailService;
        this.currentUser = currentUser;
        this.supportEmail = supportEmail;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void submit(@Valid @RequestBody SupportRequest req, HttpServletRequest http) {
        if (!perIpLimiter.tryConsume(GlobalRateLimitFilter.clientIp(http))) {
            throw new TooManyRequestsException(
                    "You've sent a few reports already — please try again in an hour.");
        }
        User user = currentUser.maybe().orElse(null);
        String replyTo = user != null ? user.getEmail() : normalize(req.email());
        String sender = user != null
                ? "@%s (%s)".formatted(user.getUsername(), user.getEmail())
                : replyTo != null ? replyTo : "anonymous visitor";
        String html = "<div style=\"font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"
                + "max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a\">"
                + "<p style=\"font-size:13px;color:#888;margin:0 0 16px\">From "
                + HtmlUtils.htmlEscape(sender) + "</p>"
                + "<p style=\"font-size:14px;line-height:1.6;white-space:pre-wrap;margin:0\">"
                + HtmlUtils.htmlEscape(req.message().trim()) + "</p>"
                + "</div>";
        boolean sent = mailService.send(
                supportEmail,
                "[Studily %s] from %s".formatted(req.category().label(), sender),
                html,
                replyTo);
        if (!sent) {
            throw new IllegalArgumentException(
                    "Couldn't send your report — please try again later, or email " + supportEmail + " directly.");
        }
    }

    private static String normalize(String email) {
        return email == null || email.isBlank() ? null : email.trim();
    }

    @Scheduled(fixedRate = 10 * WINDOW_MS)
    void evictStale() {
        perIpLimiter.evictStale();
    }

    public enum Category {
        BUG("Bug"), FEEDBACK("Feedback"), OTHER("Other");

        private final String label;

        Category(String label) {
            this.label = label;
        }

        public String label() {
            return label;
        }
    }

    public record SupportRequest(
            Category category,
            @NotBlank @Size(max = 5000) String message,
            @Email @Size(max = 255) String email) {

        public SupportRequest {
            if (category == null) {
                category = Category.OTHER;
            }
        }
    }
}
