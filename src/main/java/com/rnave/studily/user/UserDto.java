package com.rnave.studily.user;

import java.time.Instant;

public record UserDto(
        Long id,
        String email,
        String username,
        String name,
        String school,
        String schoolId,
        Integer year,
        String major,
        String bio,
        String avatarUrl,
        boolean emailVerified,
        boolean admin,
        Instant createdAt) {

    public static UserDto from(User u) {
        return from(u, false);
    }

    public static UserDto from(User u, boolean admin) {
        return new UserDto(
                u.getId(), u.getEmail(), u.getUsername(), u.getName(), u.getSchool(),
                u.getSchoolId(), u.getYear(), u.getMajor(), u.getBio(), AvatarUrls.of(u),
                u.isEmailVerified(), admin, u.getCreatedAt());
    }
}
