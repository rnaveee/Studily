package com.rnave.studily.auth;

import com.rnave.studily.auth.AuthDtos.LoginRequest;
import com.rnave.studily.auth.AuthDtos.SignupRequest;
import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.JwtService;
import com.rnave.studily.config.UnauthorizedException;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AuthServiceTest {

    private UserRepository userRepository;
    private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    private JwtService jwtService;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        passwordEncoder = mock(org.springframework.security.crypto.password.PasswordEncoder.class);
        jwtService = mock(JwtService.class);
        authService = new AuthService(userRepository, passwordEncoder, jwtService);
    }

    @Test
    void signup_savesUserAndReturnsToken() {
        SignupRequest req = new SignupRequest("New@Example.com", "newuser", "password123", "New User", "SFU");
        when(userRepository.existsByEmail("new@example.com")).thenReturn(false);
        when(userRepository.existsByUsername("newuser")).thenReturn(false);
        when(passwordEncoder.encode("password123")).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(42L);
            return u;
        });
        when(jwtService.generateToken(42L)).thenReturn("token-abc");

        var response = authService.signup(req);

        assertThat(response.token()).isEqualTo("token-abc");
        assertThat(response.user().email()).isEqualTo("new@example.com");

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        org.mockito.Mockito.verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().getEmail()).isEqualTo("new@example.com");
        assertThat(captor.getValue().getPasswordHash()).isEqualTo("hashed");
    }

    @Test
    void signup_rejectsDuplicateEmail() {
        SignupRequest req = new SignupRequest("dup@example.com", "someone", "password123", "Someone", null);
        when(userRepository.existsByEmail("dup@example.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.signup(req)).isInstanceOf(ConflictException.class);
    }

    @Test
    void signup_rejectsDuplicateUsername() {
        SignupRequest req = new SignupRequest("fresh@example.com", "taken", "password123", "Someone", null);
        when(userRepository.existsByEmail("fresh@example.com")).thenReturn(false);
        when(userRepository.existsByUsername("taken")).thenReturn(true);

        assertThatThrownBy(() -> authService.signup(req)).isInstanceOf(ConflictException.class);
    }

    @Test
    void login_succeedsWithCorrectPassword() {
        User user = new User();
        user.setId(7L);
        user.setEmail("me@example.com");
        user.setUsername("me");
        user.setPasswordHash("hashed");

        when(userRepository.findByEmail("me@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("correct", "hashed")).thenReturn(true);
        when(jwtService.generateToken(7L)).thenReturn("token-xyz");

        var response = authService.login(new LoginRequest("me@example.com", "correct"));

        assertThat(response.token()).isEqualTo("token-xyz");
    }

    @Test
    void login_rejectsUnknownEmail() {
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(new LoginRequest("nobody@example.com", "whatever")))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void login_rejectsWrongPassword() {
        User user = new User();
        user.setId(7L);
        user.setEmail("me@example.com");
        user.setPasswordHash("hashed");

        when(userRepository.findByEmail("me@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong", "hashed")).thenReturn(false);

        assertThatThrownBy(() -> authService.login(new LoginRequest("me@example.com", "wrong")))
                .isInstanceOf(UnauthorizedException.class);
    }
}
