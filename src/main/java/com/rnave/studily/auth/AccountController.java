package com.rnave.studily.auth;

import com.rnave.studily.auth.AuthDtos.AuthResponse;
import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.JwtService;
import com.rnave.studily.config.TooManyRequestsException;
import com.rnave.studily.config.UnauthorizedException;
import com.rnave.studily.conversation.ConversationRepository;
import com.rnave.studily.conversation.ConversationType;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserDto;
import com.rnave.studily.user.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me")
public class AccountController {

    private final CurrentUser currentUser;
    private final UserRepository userRepository;
    private final ConversationRepository conversationRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthEmailService authEmailService;

    public AccountController(CurrentUser currentUser, UserRepository userRepository,
                             ConversationRepository conversationRepository, PasswordEncoder passwordEncoder,
                             JwtService jwtService, AuthEmailService authEmailService) {
        this.currentUser = currentUser;
        this.userRepository = userRepository;
        this.conversationRepository = conversationRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.authEmailService = authEmailService;
    }

    @PostMapping("/verification-email")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void sendVerificationEmail() {
        User user = currentUser.entity();
        if (user.isEmailVerified()) {
            throw new ConflictException("Your email is already verified");
        }
        if (!authEmailService.sendVerification(user)) {
            throw new TooManyRequestsException(
                    "Couldn't send a verification email right now — please try again later.");
        }
    }

    @PutMapping("/password")
    @Transactional
    public AuthResponse changePassword(@Valid @RequestBody ChangePasswordRequest req) {
        User user = currentUser.entity();
        if (!passwordEncoder.matches(req.currentPassword(), user.getPasswordHash())) {
            throw new UnauthorizedException("Current password is incorrect");
        }
        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        user.setTokenVersion(user.getTokenVersion() + 1);
        user = userRepository.save(user);
        return new AuthResponse(jwtService.generateToken(user.getId(), user.getTokenVersion()), UserDto.from(user));
    }

    @PostMapping("/delete")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void deleteAccount(@Valid @RequestBody DeleteAccountRequest req) {
        User user = currentUser.entity();
        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new UnauthorizedException("Password is incorrect");
        }
        conversationRepository.deleteAll(
                conversationRepository.findForUserByType(user.getId(), ConversationType.DIRECT));
        userRepository.delete(user);
    }

    public record ChangePasswordRequest(
            @NotBlank String currentPassword,
            @NotBlank @Size(min = 8, max = 100) String newPassword) {
    }

    public record DeleteAccountRequest(@NotBlank String password) {
    }
}
