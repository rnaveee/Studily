package com.rnave.studily.auth;

import com.rnave.studily.user.UserDto;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class AuthDtos {

    public record SignupRequest(
            @Email @NotBlank @Size(max = 255) String email,
            @NotBlank @Size(min = 3, max = 30) String username,
            @NotBlank @Size(min = 8, max = 100) String password,
            @NotBlank @Size(max = 255) String name,
            @Size(max = 255) String school) {
    }

    public record LoginRequest(
            @NotBlank String email,
            @NotBlank String password) {
    }

    public record AuthResponse(String token, UserDto user) {
    }
}
