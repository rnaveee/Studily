package com.rnave.studily.moderation;

import com.rnave.studily.user.User;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Set;

@Component
public class BannedEmails {

    private static final Set<String> GMAIL_DOMAINS = Set.of("gmail.com", "googlemail.com");

    private final BannedEmailRepository repository;

    public BannedEmails(BannedEmailRepository repository) {
        this.repository = repository;
    }

    public static String normalize(String email) {
        if (email == null) {
            return "";
        }
        String value = email.trim().toLowerCase(Locale.ROOT);
        int at = value.lastIndexOf('@');
        if (at < 0) {
            return value;
        }
        String local = value.substring(0, at);
        String domain = value.substring(at + 1);
        int plus = local.indexOf('+');
        if (plus >= 0) {
            local = local.substring(0, plus);
        }
        if (GMAIL_DOMAINS.contains(domain)) {
            local = local.replace(".", "");
            domain = "gmail.com";
        }
        return local + "@" + domain;
    }

    public static String hash(String email) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(normalize(email).getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    @Transactional(readOnly = true)
    public boolean isBanned(String email) {
        return repository.existsByEmailHash(hash(email));
    }

    @Transactional
    public void ban(User user) {
        if (repository.existsByUserId(user.getId())) {
            return;
        }
        BannedEmail entry = new BannedEmail();
        entry.setEmailHash(hash(user.getEmail()));
        entry.setUserId(user.getId());
        repository.save(entry);
    }

    @Transactional
    public void unban(Long userId) {
        repository.deleteByUserId(userId);
    }
}
