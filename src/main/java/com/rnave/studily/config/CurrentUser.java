package com.rnave.studily.config;

import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class CurrentUser {

    private final UserRepository userRepository;

    public CurrentUser(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public Long id() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Long userId)) {
            throw new UnauthorizedException("Not authenticated");
        }
        return userId;
    }

    public User entity() {
        return userRepository.findById(id())
                .orElseThrow(() -> new UnauthorizedException("Authenticated user no longer exists"));
    }

    public Optional<User> maybe() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Long userId)) {
            return Optional.empty();
        }
        return userRepository.findById(userId);
    }
}
