package com.rnave.studily.auth;

import com.rnave.studily.auth.AuthDtos.LoginRequest;
import com.rnave.studily.auth.AuthDtos.SignupRequest;
import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.JwtService;
import com.rnave.studily.config.LoginRateLimiter;
import com.rnave.studily.config.TooManyRequestsException;
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
    private LoginRateLimiter loginRateLimiter;
    private AuthEmailService authEmailService;
    private AccountTokenService accountTokenService;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        passwordEncoder = mock(org.springframework.security.crypto.password.PasswordEncoder.class);
        jwtService = mock(JwtService.class);
        loginRateLimiter = mock(LoginRateLimiter.class);
        authEmailService = mock(AuthEmailService.class);
        accountTokenService = mock(AccountTokenService.class);
        when(loginRateLimiter.tryConsume(anyString())).thenReturn(true);
        authService = new AuthService(userRepository, passwordEncoder, jwtService, loginRateLimiter,
                authEmailService, accountTokenService);
    }

    @Test
    void signup_savesUserAndReturnsToken() {
        SignupRequest req = new SignupRequest("New@Example.com", "newuser", "password123", "New User", "SFU");
        when(userRepository.existsByEmail("new@example.com")).thenReturn(false);
        when(userRepository.existsByUsernameIgnoreCase("newuser")).thenReturn(false);
        when(passwordEncoder.encode("password123")).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(42L);
            return u;
        });
        when(jwtService.generateToken(42L, 0)).thenReturn("token-abc");

        var response = authService.signup(req);

        assertThat(response.token()).isEqualTo("token-abc");
        assertThat(response.user().email()).isEqualTo("new@example.com");

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        org.mockito.Mockito.verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().getEmail()).isEqualTo("new@example.com");
        assertThat(captor.getValue().getPasswordHash()).isEqualTo("hashed");
        assertThat(captor.getValue().isEmailVerified()).isFalse();
        org.mockito.Mockito.verify(authEmailService).sendVerification(any(User.class));
    }

    @Test
    void verifyEmail_marksUserVerified() {
        User user = new User();
        user.setId(5L);
        when(accountTokenService.consume("tok", AccountTokenType.EMAIL_VERIFY)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        authService.verifyEmail("tok");

        assertThat(user.isEmailVerified()).isTrue();
    }

    @Test
    void verifyEmail_rejectsBadToken() {
        when(accountTokenService.consume("bad", AccountTokenType.EMAIL_VERIFY)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.verifyEmail("bad")).isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void forgotPassword_staysSilentForUnknownEmail() {
        when(userRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        authService.forgotPassword("ghost@example.com");

        org.mockito.Mockito.verifyNoInteractions(authEmailService);
    }

    @Test
    void resetPassword_updatesHashAndRevokesOldTokens() {
        User user = new User();
        user.setId(5L);
        user.setPasswordHash("old");
        user.setTokenVersion(3);
        when(accountTokenService.consume("tok", AccountTokenType.PASSWORD_RESET)).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("newpassword1")).thenReturn("newhash");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        authService.resetPassword("tok", "newpassword1");

        assertThat(user.getPasswordHash()).isEqualTo("newhash");
        assertThat(user.getTokenVersion()).isEqualTo(4);
        assertThat(user.isEmailVerified()).isTrue();
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
        when(userRepository.existsByUsernameIgnoreCase("taken")).thenReturn(true);

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
        when(jwtService.generateToken(7L, 0)).thenReturn("token-xyz");

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
    void login_rejectsWhenAccountIsThrottled() {
        when(loginRateLimiter.tryConsume("me@example.com")).thenReturn(false);

        assertThatThrownBy(() -> authService.login(new LoginRequest("me@example.com", "correct")))
                .isInstanceOf(TooManyRequestsException.class);
        org.mockito.Mockito.verify(userRepository, org.mockito.Mockito.never()).findByEmail(anyString());
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
