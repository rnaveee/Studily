package com.rnave.studily.admin;

import com.rnave.studily.user.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class AdminGuard {

    private final String adminUsername;

    public AdminGuard(@Value("${app.admin.username:}") String adminUsername) {
        this.adminUsername = adminUsername == null ? "" : adminUsername.trim();
    }

    public boolean isAdmin(User user) {
        return user != null && isAdmin(user.getUsername());
    }

    public boolean isAdmin(String username) {
        return !adminUsername.isBlank()
                && username != null
                && adminUsername.equalsIgnoreCase(username.trim());
    }

    public String adminUsername() {
        return adminUsername;
    }
}
