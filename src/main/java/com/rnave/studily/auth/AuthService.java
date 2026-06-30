package com.rnave.studily.auth;

import com.rnave.studily.auth.AuthDtos.AuthResponse;
import com.rnave.studily.auth.AuthDtos.LoginRequest;
import com.rnave.studily.auth.AuthDtos.SignupRequest;
import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.JwtService;
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

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse signup(SignupRequest req) {
        String email = req.email().trim().toLowerCase();
        String username = req.username().trim();
        if (userRepository.existsByEmail(email)) {
            throw new ConflictException("Email already registered");
        }
        if (userRepository.existsByUsername(username)) {
            throw new ConflictException("Username already taken");
        }
        User user = new User();
        user.setEmail(email);
        user.setUsername(username);
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setName(req.name().trim());
        user.setSchool(req.school() == null ? null : req.school().trim());
        user = userRepository.save(user);
        return new AuthResponse(jwtService.generateToken(user.getId()), UserDto.from(user));
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest req) {
        String email = req.email().trim().toLowerCase();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException("Invalid email or password"));
        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new UnauthorizedException("Invalid email or password");
        }
        return new AuthResponse(jwtService.generateToken(user.getId()), UserDto.from(user));
    }
}
