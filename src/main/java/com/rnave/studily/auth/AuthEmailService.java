package com.rnave.studily.auth;

import com.rnave.studily.config.SlidingWindowRateLimiter;
import com.rnave.studily.mail.MailService;
import com.rnave.studily.user.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

@Service
public class AuthEmailService {

    private static final long WINDOW_MS = 60 * 60_000;

    private final MailService mailService;
    private final AccountTokenService tokenService;
    private final String baseUrl;
    private final SlidingWindowRateLimiter perEmailLimiter = new SlidingWindowRateLimiter(3, WINDOW_MS);

    public AuthEmailService(MailService mailService, AccountTokenService tokenService,
                            @Value("${app.base-url}") String baseUrl) {
        this.mailService = mailService;
        this.tokenService = tokenService;
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    public boolean sendVerification(User user) {
        if (!perEmailLimiter.tryConsume("verify:" + user.getEmail())) {
            return false;
        }
        String link = baseUrl + "/verify-email?token=" + tokenService.issue(user, AccountTokenType.EMAIL_VERIFY);
        return mailService.send(
                user.getEmail(),
                "Verify your Studily email",
                template(
                        "Verify your email",
                        "Hi " + HtmlUtils.htmlEscape(firstName(user)) + ", confirm this email address to unlock "
                                + "messaging and friends on Studily. This link expires in 24 hours.",
                        link,
                        "Verify email"));
    }

    public boolean sendPasswordReset(User user) {
        if (!perEmailLimiter.tryConsume("reset:" + user.getEmail())) {
            return false;
        }
        String link = baseUrl + "/reset-password?token=" + tokenService.issue(user, AccountTokenType.PASSWORD_RESET);
        return mailService.send(
                user.getEmail(),
                "Reset your Studily password",
                template(
                        "Reset your password",
                        "Hi " + HtmlUtils.htmlEscape(firstName(user)) + ", we received a request to reset your "
                                + "Studily password. This link expires in 1 hour. If you didn't ask for this, "
                                + "you can safely ignore this email.",
                        link,
                        "Reset password"));
    }

    private static String firstName(User user) {
        String name = user.getName();
        if (name == null || name.isBlank()) {
            return user.getUsername();
        }
        return name.trim().split("\\s+")[0];
    }

    private static String template(String heading, String body, String link, String cta) {
        return "<div style=\"font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"
                + "max-width:440px;margin:0 auto;padding:32px 24px;color:#1a1a1a\">"
                + "<p style=\"font-size:20px;font-weight:700;margin:0 0 4px\">Studily</p>"
                + "<h1 style=\"font-size:17px;margin:24px 0 12px\">" + heading + "</h1>"
                + "<p style=\"font-size:14px;line-height:1.6;color:#444;margin:0 0 24px\">" + body + "</p>"
                + "<a href=\"" + link + "\" style=\"display:inline-block;background:#5548c8;color:#fff;"
                + "font-size:14px;font-weight:600;text-decoration:none;padding:10px 20px;border-radius:8px\">"
                + cta + "</a>"
                + "<p style=\"font-size:12px;line-height:1.6;color:#888;margin:24px 0 0\">"
                + "If the button doesn't work, copy this link into your browser:<br>"
                + "<span style=\"word-break:break-all\">" + link + "</span></p>"
                + "</div>";
    }

    @Scheduled(fixedRate = 10 * WINDOW_MS)
    void evictStale() {
        perEmailLimiter.evictStale();
    }
}
