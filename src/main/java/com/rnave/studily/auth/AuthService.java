package com.rnave.studily.auth;

import com.rnave.studily.auth.AuthDtos.AuthResponse;
import com.rnave.studily.auth.AuthDtos.LoginRequest;
import com.rnave.studily.auth.AuthDtos.SignupRequest;
import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.JwtService;
import com.rnave.studily.config.LoginRateLimiter;
import com.rnave.studily.config.TooManyRequestsException;
import com.rnave.studily.config.UnauthorizedException;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserDto;
import com.rnave.studily.user.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final LoginRateLimiter loginRateLimiter;
    private final AuthEmailService authEmailService;
    private final AccountTokenService accountTokenService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService,
                       LoginRateLimiter loginRateLimiter, AuthEmailService authEmailService,
                       AccountTokenService accountTokenService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.loginRateLimiter = loginRateLimiter;
        this.authEmailService = authEmailService;
        this.accountTokenService = accountTokenService;
    }

    @Transactional
    public AuthResponse signup(SignupRequest req) {
        String email = req.email().trim().toLowerCase();
        String username = req.username().trim();
        if (userRepository.existsByEmail(email)) {
            throw new ConflictException("Email already registered");
        }
        if (userRepository.existsByUsernameIgnoreCase(username)) {
            throw new ConflictException("Username already taken");
        }
        User user = new User();
        user.setEmail(email);
        user.setUsername(username);
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setName(req.name().trim());
        user.setSchool(req.school() == null ? null : req.school().trim());
        user = userRepository.save(user);
        try {
            authEmailService.sendVerification(user);
        } catch (RuntimeException ignored) {
        }
        return new AuthResponse(jwtService.generateToken(user.getId(), user.getTokenVersion()), UserDto.from(user));
    }

    @Transactional
    public void verifyEmail(String token) {
        User user = accountTokenService.consume(token, AccountTokenType.EMAIL_VERIFY)
                .orElseThrow(() -> new UnauthorizedException("This verification link is invalid or has expired"));
        user.setEmailVerified(true);
        userRepository.save(user);
    }

    @Transactional
    public void forgotPassword(String email) {
        userRepository.findByEmail(email.trim().toLowerCase())
                .ifPresent(authEmailService::sendPasswordReset);
    }

    @Transactional
    public void resetPassword(String token, String newPassword) {
        User user = accountTokenService.consume(token, AccountTokenType.PASSWORD_RESET)
                .orElseThrow(() -> new UnauthorizedException("This reset link is invalid or has expired"));
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setTokenVersion(user.getTokenVersion() + 1);
        user.setEmailVerified(true);
        userRepository.save(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest req) {
        String email = req.email().trim().toLowerCase();
        if (!loginRateLimiter.tryConsume(email)) {
            throw new TooManyRequestsException("Too many login attempts for this account, please try again later.");
        }
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException("Invalid email or password"));
        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new UnauthorizedException("Invalid email or password");
        }
        return new AuthResponse(jwtService.generateToken(user.getId(), user.getTokenVersion()), UserDto.from(user));
    }
}
