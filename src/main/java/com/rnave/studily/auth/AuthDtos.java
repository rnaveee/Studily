package com.rnave.studily.auth;

import com.rnave.studily.user.UserDto;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class AuthDtos {

    public record SignupRequest(
            @Email @NotBlank @Size(max = 255) String email,
            @NotBlank @Size(min = 3, max = 30)
            @Pattern(regexp = "[A-Za-z0-9._-]+",
                    message = "may only contain letters, numbers, dots, dashes, and underscores")
            String username,
            @NotBlank @Size(min = 8, max = 100) String password,
            @NotBlank @Size(max = 255) String name,
            @Size(max = 255) String school) {
    }

    public record LoginRequest(
            @NotBlank @Size(max = 255) String email,
            @NotBlank @Size(max = 100) String password) {
    }

    public record AuthResponse(String token, UserDto user) {
    }

    public record VerifyEmailRequest(@NotBlank @Size(max = 512) String token) {
    }

    public record ForgotPasswordRequest(@NotBlank @Size(max = 255) String email) {
    }

    public record ResetPasswordRequest(
            @NotBlank @Size(max = 512) String token,
            @NotBlank @Size(min = 8, max = 100) String password) {
    }
}
